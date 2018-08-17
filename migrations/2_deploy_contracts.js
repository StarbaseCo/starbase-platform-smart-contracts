// const CompanyToken = artifacts.require("./CompanyToken.sol");
// const TokenSale = artifacts.require("./TokenSale.sol");
// const TokenSaleCloneFactory = artifacts.require("./TokenSaleCloneFactory.sol");
// const StandardToken = artifacts.require("./StandardToken.sol");
// const Whitelist = artifacts.require("./Whitelist.sol");

// const name = "Example Token";
// const symbol = "ETK";
// const decimals = 18;

// const BigNumber = web3.BigNumber;
// const dayInSecs = 86400;

// const startTime = web3.eth.getBlock("latest").timestamp + 20; // twenty secs in the future
// const endTime = startTime + dayInSecs * 60; // 60 days
// const rate = new BigNumber(10);
// const starRate = new BigNumber(20);
// const crowdsaleCap = new BigNumber(20000000); // 20M

module.exports = function(deployer, network, [_, wallet]) {
  //   return deployer
  //     .then(() => {
  //       return deployer.deploy(StandardToken);
  //     })
  //     .then(() => {
  //       return deployer.deploy(CompanyToken, name, symbol, decimals);
  //     })
  //     .then(() => {
  //       return deployer.deploy(Whitelist);
  //     })
  //     .then(() => {
  //       return deployer.deploy(TokenSale);
  //     })
  //     .then(() => {
  //       return deployer.deploy(
  //         TokenSaleCloneFactory,
  //         TokenSale.address,
  //         StandardToken.address
  //       );
  //     })
  //     .then(() => {
  //       return TokenSaleCloneFactory.deployed().then(inst => inst.create(
  //         startTime,
  //         endTime,
  //         Whitelist.address,
  //         CompanyToken.address,
  //         rate,
  //         starRate,
  //         wallet,
  //         crowdsaleCap
  //       ))
  //     })
  //     .then(tx => {
  //       const event = tx.logs.find(
  //         event => event.event === "ContractInstantiation"
  //       );
  //       tokenSaleInstatiation = event.args.instantiation;
  //       return CompanyToken.deployed().then(instance =>
  //         instance.transferOwnership(tokenSaleInstatiation)
  //       );
  //     });
};
