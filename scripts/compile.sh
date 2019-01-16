#!/usr/bin/env bash

rm -rf build/*.bin

./node_modules/solc/solcjs --optimize --bin flats/StarStaking.sol --output-dir build
./node_modules/solc/solcjs --optimize --bin flats/TokenSaleCloneFactory.sol --output-dir build
./node_modules/solc/solcjs --optimize --bin flats/TokenSale.sol --output-dir build
./node_modules/solc/solcjs --optimize --bin flats/CompanyToken.sol --output-dir build
./node_modules/solc/solcjs --optimize --bin flats/Whitelist.sol --output-dir build
./node_modules/solc/solcjs --optimize --bin flats/FundsSplitter.sol --output-dir build