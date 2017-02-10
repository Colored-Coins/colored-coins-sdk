# Colored-Coins SDK
[![Build Status](https://travis-ci.org/Colored-Coins/colored-coins-sdk.svg?branch=badges)](https://travis-ci.org/Colored-Coins/colored-coins-sdk)
[![Coverage Status](https://coveralls.io/repos/github/Colored-Coins/colored-coins-sdk/badge.svg?branch=badges)](https://coveralls.io/github/Colored-Coins/colored-coins-sdk?branch=badges)
[![npm version](https://badge.fury.io/js/coloredcoins.svg)](http://badge.fury.io/js/coloredcoins)

[![Standard - JavaScript Style Guide](https://cdn.rawgit.com/feross/standard/master/badge.svg)](https://github.com/feross/standard)

Easy to use SDK for issuing and transferring digital assets using blockchain technology.
Coupled with state-of-the-art [BIP32](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki) & [BIP44](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki) hierarchical deterministic wallet to hold your assets.

## Installation

```sh
$ npm i coloredcoins
```
## Usage

```js
var ColoredCoins = require('coloredcoins')
var cc = new ColoredCoins()
cc.init(function (err) {
  console.log('Colored-Coins SDK is now initialized.')
})
```

## Testing
```shell
$ mocha
```
Note: without some configuration, some tests (all those which actually need funding) will fail. <br>
In order for all the tests to pass, you'll need to have some funds, i.e. Bitcoins (or testnet-coins when `network` is `'testnet'`). <br>
Do this by creating a JSON file, which includes `privateSeed` \ `privateSeedWIF` \ `mnemonic` where which the address in the [BIP44](https://github.com/bitcoin/bips/blob/badges/bip-0044.mediawiki) path m/44'/0'/0'/0/0 for mainnet (m/44'/1'/0'/0/0 for tetsnet) has enough Bitcoins (or testnet-coins):
```shell
$ cd /path/to/coloredcoins
$ echo '{"network":"testnet", "privateSeed":"YourPrivateSeed"}' >> test/settings.json
$ mocha
```

## License

[MIT](https://opensource.org/licenses/MIT)