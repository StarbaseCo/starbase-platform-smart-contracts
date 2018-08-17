#!/usr/bin/env bash

# Exit script as soon as a command fails.
set -o errexit

# Executes cleanup function at script exit.
trap cleanup EXIT

cleanup() {
  # Kill the ganache instance that we started (if we started one and if it's still running).
  if [ -n "$ganache_pid" ] && ps -p $ganache_pid > /dev/null; then
    kill -9 $ganache_pid
  fi
}

if [ "$SOLIDITY_COVERAGE" = true ]; then
  ganache_port=8555
else
  ganache_port=8545
fi

ganache_running() {
  nc -z localhost "$ganache_port"
}

start_ganache() {
  # We define 20 accounts with balance 1M ether, needed for high-value tests.
  local accounts=(
    --account="0xee4e871def4e297da77f99d57de26000e86077528847341bc637d2543f8db6e2, 1000000000000000000000000"
    --account="0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501201, 1000000000000000000000000"
    --account="0x09e775e9aa0ac5b5e1fd0d0bca00e2ef429dc5f5130ea769ba14be0163021f16, 1000000000000000000000000"
    --account="0xed055c1114c433f95d688c8d5e460d3e5d807544c5689af262451f1699ff684f, 1000000000000000000000000"
    --account="0x3f81b14d33f5eb597f9ad2c350716ba8f2b6c073eeec5fdb807d23c85cf05794, 1000000000000000000000000"
    --account="0x501a3382d37d113b6490e3c4dda0756afb65df2d7977ede59618233c787239f2, 1000000000000000000000000"
    --account="0x3d00e5c06597298b7d70c6fa3ac5dae376ff897763333db23c226d14d48333af, 1000000000000000000000000"
    --account="0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501207, 1000000000000000000000000"
    --account="0xd6f7d873e7349c6d522455cb3ebdaa50b525dc6fd34f96b9e09e2d8a22dce925, 1000000000000000000000000"
    --account="0x13c8853ac12e9e30fda9f070fafe776031cc4d13bee88d7ad4e099601d83c594, 1000000000000000000000000"
    --account="0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501200, 1000000000000000000000000"
    --account="0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501201, 1000000000000000000000000"
    --account="0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501202, 1000000000000000000000000"
    --account="0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501203, 1000000000000000000000000"
    --account="0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501204, 1000000000000000000000000"
    --account="0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501205, 1000000000000000000000000"
    --account="0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501206, 1000000000000000000000000"
    --account="0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501207, 1000000000000000000000000"
    --account="0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501208, 1000000000000000000000000"
    --account="0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501209, 1000000000000000000000000"
  )

  if [ "$SOLIDITY_COVERAGE" = true ]; then
     node_modules/.bin/testrpc-sc --gasLimit 0xfffffffffff --port "$ganache_port" "${accounts[@]}" > /dev/null &
   else
     node_modules/.bin/ganache-cli --gasLimit 0xfffffffffff "${accounts[@]}" > /dev/null &
   fi

   ganache_pid=$!
 }

 if ganache_running; then
   echo "Using existing ganache instance"
 else
   echo "Starting our own ganache instance"
   start_ganache
 fi

 if [ "$SOLIDITY_COVERAGE" = true ]; then
   node_modules/.bin/solidity-coverage

   if [ "$CONTINUOUS_INTEGRATION" = true ]; then
     cat coverage/lcov.info | node_modules/.bin/coveralls
   fi
 else
   node_modules/.bin/truffle test "$@"
 fi
