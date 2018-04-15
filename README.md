# Starbase Platform Smart Contracts

## Table of Contents

* [Table of Contents](#table-of-contents)
* [Overview](#overview)
* [Implementation Details](#implementation-details)
* [Gas Consumptions](#gas-consumption)
* [Development](#development)

## Overview

The Starbase platform's smart contracts allow investors who hold STARs to participate in the crowdfunding events happening at the Starbase's web application. The smart contract receives STARs and exchanges it for the token offered during the the platform's sale event. There is also a whitelist smart contract where investors are able to be whitelisted prior and/or during the crowdsale.

## Implementation Details

* TokenFactory.sol

This contract creates a token with customized name, symbol and decimals. Upon its creation, the token transfer functionality is paused, that is to say no one is able to trade them. This is possible to be reverted only by the token contract owner - who is the Ethereum address that deployed the token mold contract.
For this contract to work with `TokenSale.sol`, its ownership needs to be passed on to `TokenSale` contract instance that will manage the token sale.

* Whitelist.sol

It allows the addition and/or removal of addresses to the whitelist registry. Both addition and removal of addresses is done via passing an array of Ethereum addresses to `addToWhitelist` and `removeFromWhitelist` functions within the contract. Only the contract owner has the ability to trigger such actions.

* TokenSale.sol

This contract is where the fundraising occurs. For it to work as expected, the ownership from the deployed TokenFactory contract needs to be passed on to `TokenSale`. This is accomplished via the `transferOwnership` function found in the zeppelin-solidity's `Ownable.sol` contract.

In order for investors to participate in the crowdsale using the `TokenSale` contract, they need firstly to approve the transfer of STARs from them to the `TokenSale` contract. For this, the investor must call the `approve` function from the STAR token contract thus passing the number of STAR tokens it approves to `TokenSale` so it manages STARs for them during the token purchase event.

Afterwards, investor must trigger `BuyTokens` within TokenSale so the token purchase event goes through. Investor then receives purchased tokens right away. However, she will not be able to trade these tokens because token transfers are paused. They need to be unpaused for the transfers to happen and this must be done most likely after the crowdsale by the token owner. Token ownership after the crowdsale must be moved from the `TokenSale` contract to another Ethereum address, most likely the address of the project owner that is uses Starbase platform for its crowdfunding needs.

Purchase process:

Technically, the purchase flow happens as follows:
1- a user that possesses STAR token must approve the crowdsale contract to transfer STAR tokens on its behalf. This happens on the Starbase client app which connects to Metamask.

2- client app calls the `buyTokens` function passing user address as `beneficiary`, contract checks whether user has given it allowance to spend STAR tokens on user's behalf.

3- if positive allowance, then crowdsale calculates the number of tokens to create and transfers these to user. Once token transfer is completed, it passes on STAR token from user to the Multisig wallet contract.

## Gas consumption

* `approve`
  30512

* `BuyTokens`
  128547

## Development

**Dependencies**

* `node@8.5.x`
* `truffle@^4.0.x`
* `ganache-cli@^6.0.x`
* `zeppelin-solidity@1.6.X`

## Setting Up

* Clone this repository.

* Install all [system dependencies](#development).

  * `cd truffle && npm install`

* Compile contract code

  * `node_modules/.bin/truffle compile`

## Running Tests

* `bash run_test.sh`

## License and Warranty

Be advised that while we strive to provide professional grade, tested code we cannot guarantee its fitness for your application. This is released under The MIT License (MIT) and as such we will not be held liable for lost funds, etc. Please use your best judgment and note the following:

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
