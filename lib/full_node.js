var ChainAdapterRpc = require('blockexplorer-rpc')
var request = require('request')
var bitcoin = require('bitcoinjs-lib')

var FullNode = function(settings) {
  var self = this
  self.settings = settings || {}
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

function bitcoinsToSatoshis(amount) {
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

FullNode.prototype._post = function(method, params, cb) {
  var path = this.settings.host + '/' + method
  request.post(path, {form: params}, function (err, response, body) {
    handleResponse(err, response, body, cb)
  })
}

FullNode.prototype.getAddressesUtxos = function(addresses, callback) {
  this._post('getAddressesUtxos', {addresses: addresses}, function(err, utxos) {
    if (err) {
      return callback(err)
    } else {
      callback(null, utxos.map(function(utxo) {
        utxo.index = utxo.vout
        utxo.value = bitcoinsToSatoshis(utxo.amount)
        utxo.scriptPubKey = { 'hex': utxo.scriptPubKey, 'addresses': [utxo.address] }
        return utxo
      }))
    }
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

module.exports = FullNode
