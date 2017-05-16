var ChainAdapterRpc = require('blockexplorer-rpc')

var BlockExplorer = function(settings) {
  var self = this
  self.settings = settings || {}

  self.rpc = new ChainAdapterRpc(settings.host)
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

BlockExplorer.prototype.getAddressesTransactions = function(addresses, callback) {
  this.rpc.post('getaddressesinfowithtransactions', {addresses: addresses}, callback)
}

BlockExplorer.prototype.importAddresses = function(addresses, reindex, callback) {
  callback(null)
}

BlockExplorer.prototype.transmit = function (signedTxHex, callback) {
  this.rpc.post('transmit', {txHex: signedTxHex}, callback)
}

module.exports = BlockExplorer
