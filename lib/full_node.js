var request = require('request')
var events = require('events')
var io = require('socket.io-client')
var util = require('util')

var FullNode = function(settings) {
  var self = this
  self.settings = settings || {}
  self.socket = io(self.settings.host + '/events')
  self.connected = false
}

function handleResponse (err, response, body, cb) {
  if (err) return cb(err)
  if (response.statusCode === 204) return cb({code: 204, message: 'no content'})
  if (response.statusCode !== 200) return cb(body)
  if (body && typeof body === 'string') {
    body = JSON.parse(body)
  }
  cb(null, body)
}

function bitcoinsToSatoshis (amount) {
  var parts = amount.toString().split(".")
  var decimal = parts[1]
  var missingDigits = 8 - decimal.length
  if (missingDigits) {
    for (var i = 0; i < missingDigits; i++) {
      decimal += '0'
    }
  }
  return parseInt(decimal) + (parseInt(parts[0]) * 100000000)
}

function extendUtxo (utxo) {
  utxo.index = utxo.vout
  utxo.value = bitcoinsToSatoshis(utxo.amount)
  utxo.scriptPubKey = { 'hex': utxo.scriptPubKey, 'addresses': [utxo.address] }
  return utxo
}

FullNode.prototype._onInfo = function (blockexplorer, type, callback) {
  var self = this
  self.socket.on('info', function (info) {
    if (self.connected) {
      return
    }
    blockexplorer.get('getinfo', {}, function (err, explorerInfo) {
      if (info.bitcoindbusy) {
        return
      }
      var lastBlockTime
      var lastBlockHeight
      var isSynced
      if (!info.ccheight) {
        lastBlockTime = info.timestamp
        lastBlockHeight = info.blocks
      } else {
        lastBlockTime = Math.min(info.cctimestamp, info.timestamp)
        lastBlockHeight = Math.min(info.ccheight, info.blocks)
      }

      isSynced = lastBlockHeight >= explorerInfo.blocks
      if (type === 'progress' && !isSynced) {
        return callback({
          lastBlockTime: lastBlockTime * 1000, // to milliseconds
          mempool: lastBlockHeight >= explorerInfo.blocks
        })
      }
      if (type === 'connect' && isSynced) {
        self.connected = true
        callback()
      }
    })
  })
}

FullNode.prototype._post = function(method, params, cb) {
  var path = this.settings.host + '/' + method
  request.post(path, {form: params}, function (err, response, body) {
    handleResponse(err, response, body, cb)
  })
}

FullNode.prototype.onProgress = function(blockexplorer, callback) {
  this._onInfo(blockexplorer, 'progress', callback)
}

FullNode.prototype.onConnect = function(blockexplorer, callback) {
  this._onInfo(blockexplorer, 'connect', callback)
}

FullNode.prototype.getAddressesUtxos = function(addresses, callback) {
  this._post('getAddressesUtxos', {addresses: addresses}, function(err, utxos) {
    if (err) return callback(err)
    callback(null, utxos.map(extendUtxo))
  })
}

FullNode.prototype.getUtxos = function (utxos, callback) {
  this._post('getUtxos', {utxos: utxos}, function (err, utxos) {
    if (err) return callback(err)
    callback(null, utxos.map(extendUtxo))
  })
}

FullNode.prototype.getAddressesTransactions = function(addresses, callback) {
  addresses = addresses
  this._post('getAddressesTransactions', {addresses: addresses}, function(err, transactions) {
    if (err) return callback(err)
    callback(null, [{ 'transactions': transactions }])
  })
}

FullNode.prototype.importAddresses = function(addresses, reindex, callback) {
  this._post('importAddresses', {addresses: addresses, reindex: reindex}, callback)
}

FullNode.prototype.transmit = function (signedTxHex, callback) {
  this._post('transmit', {txHex: signedTxHex}, callback)
}

FullNode.prototype.onNewTransaction = function(callback) {
  this.socket.on('newtransaction', callback)
}

FullNode.prototype.joinNewTransaction = function() {}

FullNode.prototype.onNewCCTransaction = function(callback) {
  this.socket.on('newcctransaction', callback)
}

FullNode.prototype.joinNewCCTransaction = function() {}

FullNode.prototype.onRevertedTransaction = function(callback) {}

FullNode.prototype.joinRevertedTransaction = function() {}

FullNode.prototype.onRevertedCCTransaction = function(callback) {}

FullNode.prototype.joinRevertedCCTransaction = function() {}

module.exports = FullNode
