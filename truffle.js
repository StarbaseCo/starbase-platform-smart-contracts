require('babel-register');
require('babel-polyfill');

module.exports = {
    // See <http://truffleframework.com/docs/advanced/configuration>
    // to customize your Truffle configuration!
    networks: {
        live: {
            network_id: 1, // Ethereum public network
            host: 'localhost',
            port: 8545
        },
        testnet: {
            network_id: 3, // Official Ethereum test network (Ropsten)
            host: 'localhost',
            port: 8545
        },
        rinkeby: {
            network_id: 4,
            host: 'localhost',
            port: 8545
        },
        development: {
            host: 'localhost',
            port: 8545,
            network_id: '*'
        }
    }
};
