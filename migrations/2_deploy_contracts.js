const CompanyToken = artifacts.require('./CompanyToken.sol');
const TokenSale = artifacts.require('./TokenSale.sol');
const StandardToken = artifacts.require('./StandardToken.sol');
const Whitelist = artifacts.require('./Whitelist.sol');

const name = 'Example Token';
const symbol = 'ETK';
const decimals = 18;

const BigNumber = web3.BigNumber;
const dayInSecs = 86400;

const startTime = web3.eth.getBlock('latest').timestamp + 20; // twenty secs in the future
const endTime = startTime + dayInSecs * 60; // 60 days
const rate = new BigNumber(10);
const starRate = new BigNumber(20);
const crowdsaleCap = new BigNumber(20000000); // 20M

module.exports = function(deployer, network, [_, wallet]) {
    return deployer
        .then(() => {
            return deployer.deploy(StandardToken);
        })
        .then(() => {
            return deployer.deploy(CompanyToken, name, symbol, decimals);
        })
        .then(() => {
            return deployer.deploy(Whitelist);
        })
        .then(() => {
            return deployer.deploy(
                TokenSale,
                startTime,
                endTime,
                Whitelist.address,
                StandardToken.address,
                CompanyToken.address,
                rate,
                starRate,
                wallet,
                crowdsaleCap
            );
        })
        .then(() => {
            return CompanyToken.deployed().then(instance =>
                instance.transferOwnership(TokenSale.address)
            );
        });
};
