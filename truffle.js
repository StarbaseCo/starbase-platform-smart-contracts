require('dotenv').config();

const { INFURA_API_KEY, MNEMONIC } = process.env;
const HDWalletProvider = require('truffle-hdwallet-provider');

const NETWORK_IDS = {
  mainnet: 1, // Ethereum public network
  ropsten: 3, // Official Ethereum test network (Ropsten)
  rinkeby: 4,
  kovan: 42,
};

module.exports = {
  networks: {
    development: {
      host: 'localhost',
      port: 8545,
      network_id: '*',
    },
  },
};

Object.keys(NETWORK_IDS).forEach(networkName => {
  const url = `https://${networkName}.infura.io/${INFURA_API_KEY}`;

  module.exports.networks[networkName] = {
    provider: () => new HDWalletProvider(MNEMONIC, url),
    network_id: NETWORK_IDS[networkName],
    gas: 4698712,
  };
});
