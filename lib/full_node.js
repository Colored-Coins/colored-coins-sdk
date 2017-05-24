var ChainAdapterRpc = require('blockexplorer-rpc')
var request = require('request')
var events = require('events')
var io = require('socket.io-client')
var util = require('util')

var FullNode = function(settings) {
  var self = this
  self.settings = settings || {}
  self.socket = io(self.settings.host + '/events')
  self.connected = false
  self.triedToConnectOnce = false
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

FullNode.prototype._post = function(method, params, cb) {
  var path = this.settings.host + '/' + method
  request.post(path, {form: params}, function (err, response, body) {
    handleResponse(err, response, body, cb)
  })
}

FullNode.prototype.onProgress = function(blockexplorer, callback) {
  var self = this
  self.socket.on('info', function(info) {
    blockexplorer.get('getinfo', {}, function(err, explorerInfo) {
      if (self.triedToConnectOnce && !self.connected && !info.bitcoindbusy && info.cctimestamp) {
        self.connected = true
        callback({
          'lastBlockTime': info.cctimestamp * 1000,
          'mempool': info.ccheight >= explorerInfo.blocks
        })
      }
    })
  })
}

FullNode.prototype.onConnect = function(blockexplorer, callback) {
  var self = this
  self.socket.on('info', function(info) {
    if (!self.connected && !info.bitcoindbusy) {
      blockexplorer.get('getinfo', {}, function(err, explorerInfo) {
        if (info.ccheight >= explorerInfo.blocks) {
          self.connected = true
          callback()
        }
        self.triedToConnectOnce = true
      })
    }
  })
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
