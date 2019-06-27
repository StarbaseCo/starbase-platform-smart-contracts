#!/usr/bin/env bash

rm -rf flats/*.sol

./node_modules/.bin/truffle-flattener contracts/BonusTokenDistribution.sol > flats/BonusTokenDistribution.sol
./node_modules/.bin/truffle-flattener contracts/StarEthRate.sol > flats/StarEthRate.sol
./node_modules/.bin/truffle-flattener contracts/StarStaking.sol > flats/StarStaking.sol
./node_modules/.bin/truffle-flattener contracts/TokenSale.sol > flats/TokenSale.sol
./node_modules/.bin/truffle-flattener contracts/CompanyToken.sol > flats/CompanyToken.sol
./node_modules/.bin/truffle-flattener contracts/Whitelist.sol > flats/Whitelist.sol
./node_modules/.bin/truffle-flattener contracts/FundsSplitter.sol > flats/FundsSplitter.sol