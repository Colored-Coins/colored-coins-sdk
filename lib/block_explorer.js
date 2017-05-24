var ChainAdapterRpc = require('blockexplorer-rpc')

var BlockExplorer = function(settings) {
  var self = this
  self.settings = settings || {}

  self.rpc = new ChainAdapterRpc(settings.host)
}

BlockExplorer.prototype.onProgress = function(blockexplorer, callback) {}

BlockExplorer.prototype.onConnect = function(blockexplorer, callback) {
  return callback()
}

BlockExplorer.prototype.getAddressesUtxos = function(addresses, callback) {
  this.rpc.post('getaddressesutxos', {addresses: addresses}, function(err, addressesUtxos) {
    if (err) return callback(err)
    var utxosTxidsAndIndexes = {}
    var utxos = []
    addressesUtxos.forEach(addressUtxos => {
      addressUtxos.utxos.forEach(utxo => {
        // ensure no duplications (multisig utxos may appear in more than one address-utxos pair)
        if (!utxosTxidsAndIndexes[utxo.txid + ':' + utxo.index]) {
          utxos.push(utxo)
          utxosTxidsAndIndexes[utxo.txid + ':' + utxo.index] = true
        }
      })
    })
    callback(null, utxos)
  })
}

BlockExplorer.prototype.getUtxos = function (utxos, callback) {
  this.rpc.post('getutxos', {utxos: utxos}, callback)
}

BlockExplorer.prototype.getAddressesTransactions = function(addresses, callback) {
  this.rpc.post('getaddressesinfowithtransactions', {addresses: addresses}, callback)
}

BlockExplorer.prototype.importAddresses = function(addresses, reindex, callback) {
  callback(null)
}

BlockExplorer.prototype.transmit = function (signedTxHex, callback) {
  this.rpc.post('transmit', {txHex: signedTxHex}, callback)
}

BlockExplorer.prototype.onNewTransaction = function(callback) {
  this.rpc.on('newtransaction', function (data) {
    callback(data.newtransaction)
  })
}

BlockExplorer.prototype.joinNewTransaction = function() {
  this.rpc.join('newtransaction')
}

BlockExplorer.prototype.onNewCCTransaction = function(callback) {
  this.rpc.on('newcctransaction', function (data) {
    callback(data.newcctransaction)
  })
}

BlockExplorer.prototype.joinNewCCTransaction = function() {
  this.rpc.join('newcctransaction')
}

BlockExplorer.prototype.onRevertedTransaction = function(callback) {
  this.rpc.on('revertedtransaction', function (data) {
    callback(data.revertedtransaction)
  })
}

BlockExplorer.prototype.joinRevertedTransaction = function() {
  this.rpc.join('revertedtransaction')
}

BlockExplorer.prototype.onRevertedCCTransaction = function(callback) {
  this.rpc.on('revertedcctransaction', function (data) {
    callback(data.revertedcctransaction)
  })
}

BlockExplorer.prototype.joinRevertedCCTransaction = function() {
  this.rpc.join('revertedcctransaction')
}

module.exports = BlockExplorer
