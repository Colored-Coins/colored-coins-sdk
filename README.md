# Colored-Coins SDK
[![Build Status](https://travis-ci.org/Colored-Coins/colored-coins-sdk.svg?branch=master)](https://travis-ci.org/Colored-Coins/colored-coins-sdk)
[![Coverage Status](https://coveralls.io/repos/github/Colored-Coins/colored-coins-sdk/badge.svg?branch=master)](https://coveralls.io/github/Colored-Coins/colored-coins-sdk?branch=master)
[![npm version](https://badge.fury.io/js/coloredcoins-sdk.svg)](http://badge.fury.io/js/coloredcoins-sdk)
[![Slack channel](http://slack.coloredcoins.org/badge.svg)](http://slack.coloredcoins.org)

[![Standard - JavaScript Style Guide](https://cdn.rawgit.com/feross/standard/master/badge.svg)](https://github.com/feross/standard)

Easy to use SDK for issuing and transferring digital assets using [Colored-Coins protocol](https://github.com/Colored-Coins/Colored-Coins-Protocol-Specification) on top of blockchain technology.
Coupled with state-of-the-art [BIP32](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki) & [BIP44](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki) hierarchical deterministic wallet to hold your assets.

## Installation

```sh
$ npm i coloredcoins-sdk
```
## Usage

```js
var ColoredCoins = require('coloredcoins-sdk')
var cc = new ColoredCoins()
cc.init(function (err) {
  // Colored-Coins SDK is now ready
})
```

## Testing
```shell
$ mocha
```
Note: without some configuration, some tests (all those which actually need funding) will fail. <br>
In order for all the tests to pass, you'll need to have some funds, i.e. Bitcoins (or testnet-coins when `network` is `'testnet'`). <br>
Do this by creating a JSON file, which includes `privateSeed` \ `privateSeedWIF` \ `mnemonic` where which the address in the [BIP44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki) path m/44'/0'/0'/0/0 for mainnet (m/44'/1'/0'/0/0 for tetsnet) has enough Bitcoins (or testnet-coins):
```shell
$ cd /path/to/coloredcoins-sdk
$ echo '{"network":"testnet", "privateSeed":"YourPrivateSeed"}' >> test/settings.json
$ mocha
```

## License

[MIT](https://opensource.org/licenses/MIT)