var util = require('util')
var async = require('async')
var events = require('events')
var request = require('request')
var HDWallet = require('hdwallet')
var ColoredCoinsRpc = require('coloredcoins-rpc')
var BlockExplorerRpc = require('blockexplorer-rpc')
var ColoredCoinsBuilder = require('cc-transaction-builder')
var BlockExplorer = require('../lib/block_explorer')
var FullNode = require('../lib/full_node')

var mainnetColoredCoinsHost = 'https://api.coloredcoins.org/v3'
var testnetColoredCoinsHost = 'https://testnet.api.coloredcoins.org/v3'

var mainnetBlockExplorerHost = 'https://explorer.coloredcoins.org'
var testnetBlockExplorerHost = 'https://testnet.explorer.coloredcoins.org'

var verifierPath = 'https://www.coloredcoins.org/explorer/verify/api.php'

var ColoredCoins = function (settings) {
  var self = this
  settings = settings || {}
  if (settings.network === 'testnet') {
    settings.coloredCoinsHost = settings.coloredCoinsHost || testnetColoredCoinsHost
    settings.blockExplorerHost = settings.blockExplorerHost || testnetBlockExplorerHost
  } else {
    settings.coloredCoinsHost = settings.coloredCoinsHost || mainnetColoredCoinsHost
    settings.blockExplorerHost = settings.blockExplorerHost || mainnetBlockExplorerHost
  }
  self.cc = new ColoredCoinsRpc(settings.coloredCoinsHost)
  self.ccb = new ColoredCoinsBuilder({ network: settings.network })
  self.blockexplorer = new BlockExplorerRpc(settings.blockExplorerHost)
  if (settings.fullNodeHost) {
    self.chainAdapter = new FullNode({ host: settings.fullNodeHost })
  } else {
    self.chainAdapter = new BlockExplorer({ host: settings.blockExplorerHost })
  }
  self.redisPort = settings.redisPort || 6379
  self.redisHost = settings.redisHost || '127.0.0.1'
  self.redisUrl = settings.redisUrl
  self.hdwallet = new HDWallet(settings)
  self.network = self.hdwallet.network
  self.eventsSecure = settings.eventsSecure || false
  self.allTransactions = settings.allTransactions || false
  self.events = settings.events || false
  self.addresses = []

  self.reindex = !!settings.reindex || false
}

util.inherits(ColoredCoins, events.EventEmitter)

ColoredCoins.encryptPrivateKey = HDWallet.encryptPrivateKey
ColoredCoins.decryptPrivateKey = HDWallet.decryptPrivateKey
ColoredCoins.createNewKey = HDWallet.createNewKey

ColoredCoins.prototype.init = function (cb) {
  var self = this

  function handleError (err) {
    self.emit('error')
    if (cb) return cb(err)
  }

  self.hdwallet.init(function (err) {
    if (err) return handleError(err)
    self.ds = self.hdwallet.ds
    self.hdwallet.on('registerAddress', function (address) {
      if (!~self.addresses.indexOf(address)) {
        self.addresses.push(address)
        self.chainAdapter.importAddresses([address], false, function(err) {
          if (err) {
            return handleError(err)
          }
        })
      }
    })
    self.hdwallet.getAddresses(function (err, addresses) {
      if (err) return handleError
      self.addresses = addresses
      self.chainAdapter.importAddresses(addresses, self.reindex, function(err) {
        if (err) {
          return handleError(err)
        }
      })
      self.emit('connect')
      if (cb) cb()
    })
  })
}

ColoredCoins.prototype.buildTransaction = function (type, ccArgs, callback) {
  var functionName

  ccArgs.flags = ccArgs.flags || {}
  ccArgs.flags.injectPreviousOutput = true
  ccArgs.flags.splitChange = typeof ccArgs.flags.splitChange !== 'undefined' ? ccArgs.flags.splitChange : true
  var tx
  try {
    if (type === 'send') {
      tx = this.ccb.buildSendTransaction(ccArgs)
    } else if (type === 'burn') {
      tx = this.ccb.buildBurnTransaction(ccArgs)
    } else if (type === 'issue') {
      tx = this.ccb.buildIssueTransaction(ccArgs)
    } else {
      return callback('Unknown type.')
    }
  } catch (err) {
    return callback(err)
  }
  return callback(null, tx)
}

ColoredCoins.prototype.signAndTransmit = function (assetInfo, callback) {
  var self = this
  async.waterfall([
    function (cb) {
      self.sign(assetInfo.txHex, cb)
    },
    function (signedTxHex, cb) {
      assetInfo.txHex = signedTxHex
      self.transmit(signedTxHex, cb)
    }
  ],
  function (err, result) {
    if (err) return callback(err)
    assetInfo.txid = result.txid
    callback(null, assetInfo)
  })
}

ColoredCoins.prototype.sign = function (txHex, callback) {
  this.hdwallet.sign(txHex, callback)
}

ColoredCoins.prototype.transmit = function (signedTxHex, callback) {
  this.chainAdapter.transmit(signedTxHex, callback)
}

ColoredCoins.prototype.issueAsset = function (args, callback) {
  var self = this

  var transmit = args.transmit !== false
  args.transfer = args.transfer || []
  var hdwallet = self.hdwallet

  var assetInformation

  async.waterfall([
    function (cb) {
      if (args.issueAddress) {
        self._getUtxosForAddresses([args.issueAddress], function(err, utxos) {
          if (err) {
            return cb(err)
          } else {
            args.utxos = utxos
            return cb()
          }
        })
      } else {
        var privateKey = hdwallet.getPrivateKey(args.accountIndex)
        var publicKey = privateKey.pub
        args.issueAddress = publicKey.getAddress(self.network).toString()
        return cb()
      }
    },
    function (cb) {
      self.buildTransaction('issue', args, cb)
    },
    function (assetInfo, cb) {
      if (typeof assetInfo === 'function') return assetInfo('wrong server response')
      if (!assetInfo || !assetInfo.txHex) return cb('wrong server response')
      if (!transmit) {
        return self.sign(assetInfo.txHex, cb)
      }
      assetInformation = assetInfo
      self.signAndTransmit(assetInfo, cb)
    },
    function (res, cb) {
      if (!transmit) {
        return cb(null, {signedTxHex: res})
      }
      res.receivingAddresses = args.transfer
      res.issueAddress = args.issueAddress
      res.assetId = assetInformation.assetId
      res.txHex = assetInformation.txHex
      cb(null, res)
    }
  ],
  callback)
}

ColoredCoins.prototype.sendAsset = function (args, callback) {
  var self = this
  var transmit = args.transmit !== false
  async.waterfall([
    function (cb) {
      if (args.from && Array.isArray(args.from) && args.from.length) {
        self._getUtxosForAddresses(args.from, function(err, utxos) {
          if (err) {
            return cb(err)
          } else {
            delete args.from
            args.utxos = utxos
            return cb()
          }
        })
      } else if (args.sendutxo && Array.isArray(args.sendutxo) && args.sendutxo.length) {
        args.utxos = args.sendutxo
        delete args.sendutxo
        return cb()
      } else {
        return cb('Should have from as array of addresses or sendutxo as array of utxos.')
      }
    },
    function (cb) {
      self.buildTransaction('send', args, cb)
    },
    function (assetInfo, cb) {
      if (!transmit) {
        return self.sign(assetInfo.txHex, cb)
      }
      self.signAndTransmit(assetInfo, cb)
    },
    function (res, cb) {
      if (!transmit) {
        return cb(null, {signedTxHex: res})
      }
      cb(null, res)
    }
  ],
  callback)
}

ColoredCoins.prototype.burnAsset = function (args, callback) {
  var self = this
  var transmit = args.transmit !== false
  args.transfer = args.transfer || []

  async.waterfall([
    function (cb) {
      if (args.from && Array.isArray(args.from) && args.from.length) {
        self._getUtxosForAddresses(args.from, function(err, utxos) {
          if (err) {
            return cb(err)
          } else {
            delete args.from
            args.utxos = utxos
            return cb()
          }
        })
      } else if (args.sendutxo && Array.isArray(args.sendutxo) && args.sendutxo.length) {
        args.utxos = args.sendutxo
        delete args.sendutxo
        return cb()
      } else {
        return cb('Should have from as array of addresses or sendutxo as array of utxos.')
      }
    },
    function (cb) {
      self.buildTransaction('burn', args, cb)
    },
    function (assetInfo, cb) {
      if (!transmit) {
        return self.sign(assetInfo.txHex, cb)
      }
      self.signAndTransmit(assetInfo, cb)
    },
    function (res, cb) {
      if (!transmit) {
        return cb(null, {signedTxHex: res})
      }
      cb(null, res)
    }
  ],
  callback)
}

ColoredCoins.prototype.getUtxos = function (callback) {
  var self = this
  self.hdwallet.getAddresses(function(err, addresses) {
    if (err) {
      callback(err)
    } else {
      self._getUtxosForAddresses(addresses, callback)
    }
  })
}

ColoredCoins.prototype._getUtxosForAddresses = function (addresses, callback) {
  this.chainAdapter.getAddressesUtxos(addresses, callback)
}

ColoredCoins.prototype.getAssets = function (callback) {
  this.getUtxos((err, utxos) => {
    if (err) return callback(err)
    var assets = []
    utxos.forEach(function (utxo) {
      if (utxo.assets) {
        utxo.assets.forEach(function (asset, i) {
          assets.push({
            address: utxo.scriptPubKey.addresses[0],
            txid: utxo.txid,
            index: utxo.index,
            assetId: asset.assetId,
            amount: asset.amount,
            issueTxid: asset.issueTxid,
            divisibility: asset.divisibility,
            lockStatus: asset.lockStatus,
            aggregationPolicy: asset.aggregationPolicy,
            assetIndex: i
          })
        })
      }
    })
    callback(null, assets)
  })
}

ColoredCoins.prototype.getTransactions = function (addresses, callback) {
  var self = this

  if (typeof addresses === 'function') {
    callback = addresses
    addresses = null
  }

  if (!addresses) {
    self.hdwallet.getAddresses(function (err, addresses) {
      if (err) return callback(err)
      self.getTransactionsFromAddresses(addresses, callback)
    })
  } else {
    self.getTransactionsFromAddresses(addresses, callback)
  }
}

ColoredCoins.prototype.getTransactionsFromAddresses = function (addresses, callback) {
  this.chainAdapter.getAddressesTransactions(addresses, function (err, addressesInfos) {
    if (err) return callback(err)
    var txids = {}
    var transactions = []
    addressesInfos.forEach(addressInfo => {
      addressInfo.transactions.forEach(transaction => {
        if (!txids[transaction.txid]) {
          transactions.push(transaction)
          txids[transaction.txid] = true
        }
      })
    })
    callback(null, transactions)
  })
}

ColoredCoins.prototype.getAssetMetadata = function (assetId, utxo, full, callback) {
  var self = this

  if (typeof full === 'undefined') {
    full = true // default value
  }
  if (typeof full === 'function') {
    callback = full
    full = true
  }

  var metadata
  async.waterfall([
    function (cb) {
      // get the metadata from cache
      if (full) return cb(null, null)
      getCachedAssetMetadata(self.ds, assetId, utxo, cb)
    },
    function (md, cb) {
      metadata = md
      // if got metadata from cache
      if (metadata) {
        return cb()
      }
      var params = [assetId]
      if (utxo) {
        params.push(utxo)
      }
      self.cc.get('assetmetadata', params, function (err, md) {
        if (err) return cb(err)
        metadata = md
        // cache data
        cacheAssetMetadata(self.ds, assetId, utxo, getPartialMetadata(metadata))
        cb()
      })
    }
  ],
  function (err) {
    if (err) return callback(err)
    // return the metadata (if !full, just the partial)
    var partial = getPartialMetadata(metadata)
    if (!full) {
      metadata = partial
    } else {
      for (var attr in partial) {
        metadata[attr] = partial[attr]
      }
    }
    return callback(null, metadata)
  })
}

var getCachedAssetMetadata = function (ds, assetId, utxo, callback) {
  utxo = utxo || 0
  ds.hget(assetId, utxo, function (err, metadataStr) {
    if (err) return callback(err)
    if (!metadataStr) return callback(null, null)
    return callback(null, JSON.parse(metadataStr))
  })
}

var cacheAssetMetadata = function (ds, assetId, utxo, metadata) {
  utxo = utxo || 0
  ds.hset(assetId, utxo, JSON.stringify(metadata))
}

var getPartialMetadata = function (metadata) {
  var ans = {
    assetId: metadata.assetId
  }
  var utxoMetadata = metadata.metadataOfUtxo || metadata.metadataOfIssuence
  if (utxoMetadata && utxoMetadata.data) {
    ans.assetName = utxoMetadata.data.assetName
    ans.description = utxoMetadata.data.description
    ans.issuer = utxoMetadata.data.issuer
    if (utxoMetadata.data.urls) {
      utxoMetadata.data.urls.forEach(function (url) {
        if (url.name === 'icon') ans.icon = url.url
        if (url.name === 'large_icon') ans.large_icon = url.url
      })
    }
  } else {
    ans.assetName = metadata.assetName
    ans.description = metadata.description
    ans.issuer = metadata.issuer
    ans.icon = metadata.icon
    ans.large_icon = metadata.large_icon
  }
  return ans
}

ColoredCoins.prototype.on = function (eventKey, callback) {
  switch (eventKey) {
    case 'newTransaction':
      return this.onNewTransaction(callback)
    case 'newCCTransaction':
      return this.onNewCCTransaction(callback)
    case 'revertedTransaction':
      return this.onRevertedTransaction(callback)
    case 'revertedCCTransaction':
      return this.onRevertedCCTransaction(callback)
    default:
      return this.blockexplorer.on.call(this, eventKey, callback)
  }
}

ColoredCoins.prototype.onRevertedTransaction = function (callback) {
  this.blockexplorer.on('revertedtransaction', function (data) {
    callback(data.revertedtransaction)
  })
  this.blockexplorer.join('revertedtransaction')
}

ColoredCoins.prototype.onRevertedCCTransaction = function (callback) {
  this.blockexplorer.on('revertedcctransaction', function (data) {
    callback(data.revertedcctransaction)
  })
  this.blockexplorer.join('revertedcctransaction')
}

ColoredCoins.prototype.onNewTransaction = function (callback) {
  var self = this

  if (!self.events) return
  if (self.eventsSecure || self.allTransactions) {
    self.blockexplorer.on('newtransaction', function (data) {
      if (isLocalTransaction(self.addresses, data.newtransaction)) {
        self.hdwallet.discover()
        callback(data.newtransaction)
      } else if (self.allTransactions) {
        callback(data.newtransaction)
      }
    })
    self.blockexplorer.join('newtransaction')
  } else {
    var addresses = []
    var transactions = []
    self.hdwallet.on('registerAddress', function (address) {
      registerAddress(self, address, addresses, transactions, callback)
    })
    self.addresses.forEach(function (address) {
      registerAddress(self, address, addresses, transactions, callback)
    })
  }
}

ColoredCoins.prototype.onNewCCTransaction = function (callback) {
  var self = this

  if (!self.events) return false
  if (self.eventsSecure || self.allTransactions) {
    self.blockexplorer.on('newcctransaction', function (data) {
      if (isLocalTransaction(self.addresses, data.newcctransaction)) {
        self.hdwallet.discover()
        callback(data.newcctransaction)
      } else if (self.allTransactions) {
        callback(data.newcctransaction)
      }
    })
    self.blockexplorer.join('newcctransaction')
  } else {
    self.onNewTransaction(function (transaction) {
      if (transaction.colored) {
        callback(transaction)
      }
    })
  }
}

var isLocalTransaction = function (addresses, transaction) {
  var localTx = false

  if (!localTx && transaction.vin) {
    transaction.vin.forEach(function (input) {
      if (!localTx && input.previousOutput && input.previousOutput.addresses) {
        input.previousOutput.addresses.forEach(function (address) {
          if (!localTx && ~addresses.indexOf(address)) {
            localTx = true
          }
        })
      }
    })
  }

  if (!localTx && transaction.vout) {
    transaction.vout.forEach(function (output) {
      if (!localTx && output.scriptPubKey && output.scriptPubKey.addresses) {
        output.scriptPubKey.addresses.forEach(function (address) {
          if (!localTx && ~addresses.indexOf(address)) {
            localTx = true
          }
        })
      }
    })
  }

  return localTx
}

var registerAddress = function (self, address, addresses, transactions, callback) {
  if (!~addresses.indexOf(address)) {
    var channel = 'address/' + address
    self.blockexplorer.on(channel, function (data) {
      self.hdwallet.discover()
      var transaction = data.transaction
      if (!~transactions.indexOf(transaction.txid)) {
        transactions.push(transaction.txid)
        callback(transaction)
      }
    })
    addresses.push(address)
    self.blockexplorer.join(channel)
  }
}

ColoredCoins.prototype.getIssuedAssetsFromTransactions = function (addresses, transactions) {
  var issuances = []
  transactions.forEach(function (transaction) {
    if (transaction.colored && transaction.ccdata && transaction.ccdata.length && transaction.ccdata[0].type === 'issuance') {
      var issuance = {
        issueTxid: transaction.txid,
        txid: transaction.txid,
        lockStatus: transaction.ccdata[0].lockStatus,
        divisibility: transaction.ccdata[0].divisibility,
        aggregationPolicy: transaction.ccdata[0].aggregationPolicy,
        amount: transaction.ccdata[0].amount
      }
      var assetId
      var indexes = []
      var inputsAssetIds = {}
      transaction.vin.forEach(input => {
        if (input.assets) {
          input.assets.forEach(asset => {
            inputsAssetIds[asset.assetId] = true
          })
        }
      })
      // the issued asset is the one with the assetId which is not found in the transaction's inputs
      transaction.vout.forEach((output, index) => {
        if (output.assets) {
          output.assets.forEach(asset => {
            if (!inputsAssetIds[asset.assetId]) {
              assetId = asset.assetId
              indexes.push(index)
            }
          })
        }
      })
      if (!assetId) {
        return
      }
      issuance.assetId = assetId
      issuance.outputIndexes = indexes
      if (!transaction.vin || !transaction.vin.length || !transaction.vin[0].previousOutput || !transaction.vin[0].previousOutput.addresses || !transaction.vin[0].previousOutput.addresses.length) {
        return
      }

      var address = transaction.vin[0].previousOutput.addresses[0]
      if (~addresses.indexOf(address)) {
        issuance.address = address
        issuances.push(issuance)
      }
    }
  })
  return issuances
}

ColoredCoins.prototype.getIssuedAssets = function (transactions, callback) {
  var self = this
  if (typeof transactions === 'function') {
    callback = transactions
    transactions = null
  }

  self.hdwallet.getAddresses(function (err, addresses) {
    if (err) return callback(err)
    if (!transactions) {
      self.getTransactions(addresses, function (err, transactions) {
        if (err) return callback(err)
        return callback(null, self.getIssuedAssetsFromTransactions(addresses, transactions))
      })
    } else {
      return callback(null, self.getIssuedAssetsFromTransactions(addresses, transactions))
    }
  })
}

ColoredCoins.prototype.getAddressInfo = function (address, cb) {
  this.cc.get('addressinfo', [address], cb)
}

ColoredCoins.prototype.getStakeHolders = function (assetId, numConfirmations, cb) {
  if (typeof numConfirmations === 'function') {
    cb = numConfirmations
    numConfirmations = 0
  }
  this.cc.get('stakeholders', [assetId, numConfirmations], cb)
}

ColoredCoins.prototype.verifyIssuer = function (assetId, json, cb) {
  if (typeof json === 'function') {
    cb = json
    json = null
  }
  var args = {
    asset_id: assetId,
    json: json
  }
  request.post(verifierPath, {form: args}, function (err, response, body) {
    if (err) return cb(err)
    if (response.statusCode === 204) return cb('No Content')
    if (response.statusCode !== 200) return cb(body)
    if (body && typeof body === 'string') {
      body = JSON.parse(body)
    }
    cb(null, body)
  })
}

module.exports = ColoredCoins
