/* eslint-env mocha */
var ColoredCoins = require('..')
var assert = require('assert')
var jf = require('jsonfile')
var path = require('path')

describe('Test ColoredCoins SDK', function () {
  var cc

  var fromAddress = 'mxNTyQ3WdFMQE7SGVpSQGXnSDevGMLq7dg'
  var toAddress = 'mgNcWJp4hPd7MN6ets2P8HcB5k99aCs8cy'
  var assetId = 'Ua3Kt8WJtsx61VC8DUJiRmseQ45NfW2dwLbG6s'
  var utxo = '661380f92f9094786657dc35753a51db4dba04526b57b799385ee401293860fd:1'
  var expectedAssetName = 'random asset'
  var signedTxHex = '0100000001d542409c9006cf73af5a09fa6814156b635b57a7c8929c7ad6d514254bb6d108020000006a47304402207b67c24b1602aef5e9da57685a1bf19ad4267f331ef061cfeace70ba7ab119b302206928a96dc9a86c443190759fddf2e372aed450305954a2db9deb36dc2a6115fd01210240042f2cfb410b4fab76a33dd36376fc752b03ee6f14708da6cd4d306670068bffffffff0358020000000000001976a9140964477fbc5bcce8c2ddbd8b4c705ef60c5a91e788ac00000000000000000a6a084343010501000110207a0100000000001976a9143dccfff7d33c163957d94949789baf660bed5a6c88ac00000000'
  var issuerAssetId = 'La39iBSrbqSvsvtJj7SPJSsCqw6njDewER7dQk'
  var issuerJson = {
    social: {
      facebook: {
        page_id: 1790094654575050
      }
    }
  }

  before(function (done) {
    this.timeout(15000)
    var settings
    try {
      settings = jf.readFileSync(path.join(__dirname, '/settings.json'))
    } catch (e) {
      settings = {
        network: 'testnet'
      }
    }
    // read from command line arguments
    cc = new ColoredCoins(settings)
    cc.on('connect', done)
    cc.init()
  })

  it('should create an issuance transaction', function (done) {
    this.timeout(15000)
    var args = {
      issueAddress: fromAddress,
      amount: 1,
      fee: 1000,
      transfer: [
        {
          address: toAddress,
          amount: 1
        }
      ]
    }
    cc.buildTransaction('issue', args, function (err, ans) {
      assert.ifError(err)
      assert.equal(typeof ans.txHex, 'string')
      assert(ans.txHex.length)
      assert.equal(typeof ans.assetId, 'string')
      assert(ans.assetId.length)
      assert(Array.isArray(ans.coloredOutputIndexes))
      assert(ans.coloredOutputIndexes.length)
      done()
    })
  })

  it('should create a transfer transaction', function (done) {
    this.timeout(15000)
    var args = {
      from: [fromAddress],
      fee: 1000,
      to: [
        {
          address: toAddress,
          amount: 1,
          assetId: assetId
        }
      ]
    }
    cc.buildTransaction('send', args, function (err, ans) {
      assert.ifError(err)
      assert.equal(typeof ans.txHex, 'string')
      assert(ans.txHex.length)
      assert(Array.isArray(ans.coloredOutputIndexes))
      assert(ans.coloredOutputIndexes.length)
      assert(Array.isArray(ans.multisigOutputs))
      done()
    })
  })

  it('should create a burn transaction', function (done) {
    this.timeout(15000)
    var args = {
      from: [fromAddress],
      fee: 1000,
      burn: [
        {
          amount: 1,
          assetId: assetId
        }
      ]
    }
    cc.buildTransaction('burn', args, function (err, ans) {
      assert.ifError(err)
      assert.equal(typeof ans.txHex, 'string')
      assert(ans.txHex.length)
      assert(Array.isArray(ans.coloredOutputIndexes))
      assert(Array.isArray(ans.multisigOutputs))
      done()
    })
  })

  it('should transmit a transaction', function (done) {
    this.timeout(15000)
    cc.transmit(signedTxHex, function (err, ans) {
      assert(err)
      done()
    })
  })

  it('should get address info', function (done) {
    this.timeout(15000)
    cc.getAddressInfo(fromAddress, function (err, ans) {
      assert.ifError(err)
      assert.equal(ans.address, fromAddress)
      assert(Array.isArray(ans.utxos))
      assert(ans.utxos.length)
      done()
    })
  })

  it('should get stakeholders', function (done) {
    this.timeout(15000)
    cc.getStakeHolders(assetId, function (err, ans) {
      assert.ifError(err)
      assert.equal(ans.assetId, assetId)
      assert(Array.isArray(ans.holders))
      assert(ans.holders.length)
      done()
    })
  })

  it('should get assetmetadata', function (done) {
    this.timeout(15000)
    cc.getAssetMetadata(assetId, utxo, function (err, ans) {
      assert.ifError(err)
      assert.equal(ans.assetId, assetId)
      assert.equal(ans.assetName, expectedAssetName)
      assert.equal(typeof ans.issuanceTxid, 'string')
      assert(ans.issuanceTxid.length)
      done()
    })
  })

  it('should verify issuer', function (done) {
    this.timeout(15000)
    cc.verifyIssuer(issuerAssetId, issuerJson, function (err, ans) {
      assert.ifError(err)
      assert.deepEqual(ans, {
        verifications: {
          social: {
            facebook: 'https://www.facebook.com/permalink.php?story_fbid=1790490524535463&id=1790094654575050'
          }
        }
      })
      done()
    })
  })

  it('should get error when issue address does not have BTC', function (done) {
    cc.issueAsset({amount: 36, issueAddres: cc.hdwallet.getAddress(), fee: 1000}, function (err, result) {
      assert(err)
      assert.equal(err.name, 'NotEnoughFundsError')
      done()
    })
  })

  it('should create and transmit an issuance transaction', function (done) {
    this.timeout(15000)
    var args = {
      issueAddress: cc.hdwallet.getAddress(0, 0),
      amount: 36,
      fee: 1000
    }
    cc.issueAsset(args, function (err, result) {
      assert.ifError(err)
      assert(result.txHex)
      assert(result.txid)
      assert(result.assetId)
      assetId = result.assetId
      done()
    })
  })

  it('should create and transmit a transfer transaction', function (done) {
    this.timeout(15000)
    var args = {
      from: [cc.hdwallet.getAddress(0, 0)],
      to: [
        {
          assetId: assetId,
          address: cc.hdwallet.getAddress(),
          amount: 12
        }
      ],
      fee: 1000
    }
    cc.sendAsset(args, function (err, result) {
      assert.ifError(err)
      assert(result.txHex)
      assert(result.txid)
      done()
    })
  })

  it('should create and transmit a burn transaction', function (done) {
    this.timeout(15000)
    var args = {
      from: [cc.hdwallet.getAddress(0, 0)],
      burn: [
        {
          assetId: assetId,
          amount: 3
        }
      ],
      fee: 1000
    }
    cc.burnAsset(args, function (err, result) {
      assert.ifError(err)
      assert(result.txHex)
      assert(result.txid)
      done()
    })
  })

  it('should get assets in wallet', function (done) {
    this.timeout(15000)
    cc.getAssets(function (err, res) {
      assert.ifError(err)
      assert(Array.isArray(res))
      res.forEach(elem => {
        assert(elem.txid)
        assert(typeof elem.index !== 'undefined')
        assert(typeof elem.assetIndex !== 'undefined')
        assert(elem.assetId)
        assert(elem.amount)
        assert(elem.issueTxid)
        assert(typeof elem.divisibility !== 'undefined')
        assert(typeof elem.lockStatus !== 'undefined')
      })
      done()
    })
  })

  it('should get issued assets', function (done) {
    this.timeout(15000)
    cc.getIssuedAssets(function (err, res) {
      assert.ifError(err)
      assert(Array.isArray(res))
      res.forEach(elem => {
        assert(elem.txid)
        assert(elem.assetId)
        assert(elem.amount)
        assert(elem.issueTxid)
        assert(typeof elem.divisibility !== 'undefined')
        assert(typeof elem.lockStatus !== 'undefined')
      })
      assert(res.find(elem => elem.assetId === assetId))
      done()
    })
  })

  it('should get all transactions of wallet addresses', function (done) {
    this.timeout(15000)
    cc.getTransactions(function (err, transactions) {
      assert.ifError(err)
      assert(Array.isArray(transactions))
      transactions.forEach(transaction => {
        assert(transaction.hex)
        assert(transaction.txid)
        assert(transaction.blockheight)
        assert(transaction.blocktime)
        assert(typeof transaction.fee !== 'undefined')
        assert(transaction.totalsent)
        assert(typeof transaction.confirmations !== 'undefined')
        assert(Array.isArray(transaction.vin) && transaction.vin.length)
        assert(Array.isArray(transaction.vout) && transaction.vout.length)
      })
      done()
    })
  })

  it('should receive a \'newTransaction\' event when eventsSecure = true', function (done) {
    this.timeout(15000)
    cc.events = true
    cc.eventsSecure = true

    var txids = []
    var txid
    var once = 0
    cc.on('newTransaction', function (transaction) {
      txids.push(transaction.txid)
      if (txid && ~txids.indexOf(txid) && !once++) return done()
    })
    var args = {
      amount: 36,
      issueAddress: cc.hdwallet.getAddress(0, 0),
      fee: 1000
    }
    cc.issueAsset(args, function (err, ans) {
      assert.ifError(err)
      txid = ans.txid
      if (txid && ~txids.indexOf(txid) && !once++) return done()
    })
  })

  it('should receive a \'newTransaction\' event when eventsSecure = false', function (done) {
    this.timeout(15000)
    cc.eventsSecure = false

    var txids = []
    var txid
    var once = 0
    cc.on('newTransaction', function (transaction) {
      txids.push(transaction.txid)
      if (txid && ~txids.indexOf(txid) && !once++) return done()
    })
    var args = {
      amount: 36,
      issueAddress: cc.hdwallet.getAddress(0, 0),
      fee: 1000
    }
    cc.issueAsset(args, function (err, ans) {
      assert.ifError(err)
      txid = ans.txid
      if (txid && ~txids.indexOf(txid) && !once++) return done()
    })
  })

  it('should receive a \'newCCTransaction\' event when eventsSecure = true', function (done) {
    this.timeout(15000)
    cc.eventsSecure = true

    var txids = []
    var txid
    var once = 0
    cc.on('newCCTransaction', function (transaction) {
      txids.push(transaction.txid)
      if (txid && ~txids.indexOf(txid) && !once++) return done()
    })
    var args = {
      amount: 36,
      issueAddress: cc.hdwallet.getAddress(0, 0),
      fee: 1000
    }
    cc.issueAsset(args, function (err, ans) {
      assert.ifError(err)
      txid = ans.txid
      if (txid && ~txids.indexOf(txid) && !once++) return done()
    })
  })

  it('should receive a \'newCCTransaction\' event when eventsSecure = false', function (done) {
    this.timeout(15000)
    cc.eventsSecure = false

    var txids = []
    var txid
    var once = 0
    cc.on('newCCTransaction', function (transaction) {
      txids.push(transaction.txid)
      if (txid && ~txids.indexOf(txid) && !once++) return done()
    })
    var args = {
      amount: 36,
      issueAddress: cc.hdwallet.getAddress(0, 0),
      fee: 1000
    }
    cc.issueAsset(args, function (err, ans) {
      assert.ifError(err)
      txid = ans.txid
      if (txid && ~txids.indexOf(txid) && !once++) return done()
    })
  })
})
