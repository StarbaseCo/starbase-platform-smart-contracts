#!/usr/bin/env bash

rm -rf build/*

./node_modules/solc/solcjs --optimize --abi --bin flats/StarEthRate.sol --output-dir build/StarEthRate
./node_modules/solc/solcjs --optimize --abi --bin flats/StarStaking.sol --output-dir build/StarStaking
./node_modules/solc/solcjs --optimize --abi --bin flats/TokenSale.sol --output-dir build/TokenSale
./node_modules/solc/solcjs --optimize --abi --bin flats/CompanyToken.sol --output-dir build/CompanyToken
./node_modules/solc/solcjs --optimize --abi --bin flats/Whitelist.sol --output-dir build/Whitelist
./node_modules/solc/solcjs --optimize --abi --bin flats/FundsSplitter.sol --output-dir build/FundsSplitter

find build/StarEthRate -type f -not -name 'flats_StarEthRate_sol_StarEthRate.abi' -not -name 'flats_StarEthRate_sol_StarEthRate.bin' -delete
find build/StarStaking -type f -not -name 'flats_StarStaking_sol_StarStaking.abi' -not -name 'flats_StarStaking_sol_StarStaking.bin' -delete
find build/TokenSale -type f -not -name 'flats_TokenSale_sol_TokenSale.abi' -not -name 'flats_TokenSale_sol_TokenSale.bin' -delete
find build/CompanyToken -type f -not -name 'flats_CompanyToken_sol_CompanyToken.abi' -not -name 'flats_CompanyToken_sol_CompanyToken.bin' -delete
find build/Whitelist -type f -not -name 'flats_Whitelist_sol_Whitelist.abi' -not -name 'flats_Whitelist_sol_Whitelist.bin' -delete
find build/FundsSplitter -type f -not -name 'flats_FundsSplitter_sol_FundsSplitter.abi' -not -name 'flats_FundsSplitter_sol_FundsSplitter.bin' -delete