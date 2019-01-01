module.exports = {
  networks: {
    live: {
      network_id: 1, // Ethereum public network
      host: "localhost",
      port: 8545,
      gas: 6712388
    },
    testnet: {
      network_id: 3, // Official Ethereum test network (Ropsten)
      host: "localhost",
      port: 8545,
      gas: 6712388
    },
    rinkeby: {
      network_id: 4, // Rinkeby Ethereum test network
      host: "localhost",
      port: 8545,
      gas: 6712388
    },
    coverage: {
      host: "localhost",
      network_id: "*",
      port: 8555,
      gas: 0xfffffffffff,
      gasPrice: 0x01
    },
    development: {
      host: "localhost",
      network_id: "*",
      port: 8545,
      gas: 6712388
    }
  }
};
