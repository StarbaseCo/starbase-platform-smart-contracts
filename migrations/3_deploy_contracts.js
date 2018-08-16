require("dotenv").config();

const StarStaking = artifacts.require("./StarStaking.sol");

const { STAR_CONTRACT_TEST_ADDRESS } = process.env;
const DAYS_IN_SECONDS = 86400;

module.exports = function(deployer, network, [_, wallet]) {
  if (network === "rinkeby") {
    web3.eth.getBlock("latest", false, (error, result) => {
      if (!error) {
        const startTime = result.timestamp + 120; // two mins in the future
        const endTime = startTime + DAYS_IN_SECONDS * 365; // one year

        deployer.deploy(
          StarStaking,
          STAR_CONTRACT_TEST_ADDRESS,
          startTime,
          endTime
        );
      } else {
        console.error(error);
      }
    });
  }
};
