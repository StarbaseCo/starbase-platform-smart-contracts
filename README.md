# Starbase Platform Smart Contracts

## Table of Contents

* [Table of Contents](#table-of-contents)
* [Overview](#overview)
* [Implementation Details](#implementation-details)
* [Deployment](#deployment)
* [Gas Consumptions](#gas-consumption)
* [Development](#development)

## Overview

The Starbase platform's smart contracts allow investors who hold STARs to participate in the crowdfunding events happening at the Starbase's web application. The smart contract receives STARs and exchanges it for the token offered during the the platform's sale event. There is also a whitelist smart contract where investors are able to be whitelisted prior and/or during the crowdsale.

* update May 2018
  The token sale smart contract has been extended to accept `ETH` payments when the `enableWei` is set to true.

## Implementation Details

* CompanyToken.sol

This contract creates a token with customized name, symbol and decimals. Upon its creation, the token transfer functionality is paused, that is to say no one is able to trade them. This is possible to be reverted only by the token contract owner - who is the Ethereum address that deployed the token mold contract.
For this contract to work with `TokenSale.sol`, its ownership needs to be passed on to `TokenSale` contract instance that will manage the token sale.

* Whitelist.sol

It allows the addition and/or removal of addresses to the whitelist registry. Both addition and removal of addresses is done via passing an array of Ethereum addresses to `addManyToWhitelist` and `removeManyFromWhitelist` functions within the contract. Only the contract owner has the ability to trigger such actions.

* TokenSale.sol

This contract is where the fundraising occurs. For it to work as expected, the ownership from the deployed CompanyToken contract needs to be passed on to `TokenSale`. This is accomplished via the `transferOwnership` function found in the zeppelin-solidity's `Ownable.sol` contract.

In order for investors to participate in the crowdsale using the `TokenSale` contract, they need firstly to approve the transfer of STARs from them to the `TokenSale` contract. For this, the investor must call the `approve` function from the STAR token contract thus passing the number of STAR tokens it approves to `TokenSale` so it manages STARs for them during the token purchase event.

Afterwards, investor must trigger `BuyTokens` within TokenSale so the token purchase event goes through. Investor then receives purchased tokens right away. However, she will not be able to trade these tokens because token transfers are paused. They need to be unpaused for the transfers to happen and this must be done most likely after the crowdsale by the token owner. Token ownership after the crowdsale must be moved from the `TokenSale` contract to another Ethereum address, most likely the address of the project owner that is uses Starbase platform for its crowdfunding needs.

* update May 2018
  The token sale smart contract has been extended to accept `ETH` payments when the `enableWei` is set to true. This is done by calling the `toggleEnableWei` by the `TokenSale` contract owner. If `enableWei` is triggered and investor sends ether in the transaction by calling `buyTokens`, the function will automatically call the contract internal function `buyTokensWithWei` which handles the purchase with wei/ether.

Purchase process:

Technically, the purchase flow happens as follows using STAR:
1- a user that possesses STAR token must approve the crowdsale contract to transfer STAR tokens on its behalf. This happens on the Starbase client app which connects to Metamask.

2- client app calls the `buyTokens` function passing user address as `beneficiary`, contract checks whether user has given it allowance to spend STAR tokens on user's behalf.

3- if positive allowance, then crowdsale calculates the number of tokens to create and transfers these to user. Once token transfer is completed, it passes on STAR token from user to the Multisig wallet contract.

## Deployment

If you are deploying these contracts with truffle then just follow the [truffle documentation on deployment](http://truffleframework.com/docs/). You will most likely alter the code in `migrations/2_deploy_contracts.js` to fit your needs. The code already there is a good guidance.

Deployment with Remix is different, you need to have metamask installed and have the entire contract code at hand. To get the entire contract code use a tool such as [truffle-flattener](https://github.com/alcuadrado/truffle-flattener) to concatenate all smart contract code files into one. Then go to Remix paster the entire code there and deploy the contracts according to Remix's UI.

### Whitelist

To deploy the Whitelist smart contract it is fairly straightforward. It has no parameters.

### Company Token

Three parameters are necessary to pass upon contract deployment: `string _name, string _symbol, uint8 _decimals`. Note: new token standard in Ethereum are moving to have decimals as always `18`. Something to bear in mind and tell Starbase clients in case they want a different figure for the parameters `decimals` in their token.

### Token Sale

It is the more complex of the crowdsale contracts to deploy. It has a number of mandatory parameters. One example are as follows:

```
_startTime = 1496204377  // time in unix timestamp
_endTime  = 1590898777  // time in unix timestamp
_whitelist = "0xc99e045afdeb86ba44c153cf4498a3fada0bc6d6" // contract of a deployed whitelist contract
_starToken = "0xd70A7A39EFB10cfE34FD79Ea8c06BdB1974C8828" // Starbase STAR token contract
_companyToken =  "0xaee875686Ec9C7A29B29f4Cd48a55bdF816eb00c"  // the EC20 token deployed by the company and who has mint capability
_rate = 100 // rate in ETH/company tokens. Here is if investor sends 1 ETH she receives 100 company tokens in return
_starRate = 2 // rate STAR/company tokens. Here is upon sending of 1 STAR, investor receives 2 company tokens in return
_wallet = "0xB01B468423Da913afD743c13f17B01c2cF26b3e8" // address where funds collets in the token sale will go to
_crowdsaleCap = 1000  // cap for the number of tokens to be minted. Here it is only 1000 tokens that will be sold in the token sale
```

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
