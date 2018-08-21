#!/usr/bin/env bash

rm -rf flats/*

./node_modules/.bin/truffle-flattener contracts/StarStaking.sol > flats/StarStaking.sol
./node_modules/.bin/truffle-flattener contracts/cloneFactory/TokenSaleCloneFactory.sol > flats/TokenSaleCloneFactory.sol
./node_modules/.bin/truffle-flattener contracts/TokenSale.sol > flats/TokenSale.sol
