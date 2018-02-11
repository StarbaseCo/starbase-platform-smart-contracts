const TokenMold = artifacts.require('./TokenMold.sol');

const name = 'Example Token';
const symbol = 'ETK';
const decimals = 18;

module.exports = function(deployer) {
    deployer.deploy(TokenMold, name, symbol, decimals);
};
