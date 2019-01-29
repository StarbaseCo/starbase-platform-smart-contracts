# Starbase Platform Smart Contracts

## Table of Contents

-   [Table of Contents](#table-of-contents)
-   [Overview](#overview)
-   [Implementation Details](#implementation-details)
-   [Deployment](#deployment)
-   [Gas Consumptions](#gas-consumption)
-   [Development](#development)

## Overview

The Starbase platform's smart contracts allow investors who hold STARs to participate in the crowdfunding events happening at the Starbase's web application. The smart contract receives STARs and/ or ETH and exchanges it for the token offered during the platform's sale event. There is also a whitelist smart contract where investors are able to be whitelisted prior and/or during the crowdsale. A staking mechanism is in the works and should allow users to stake STARs for getting bonus tokens offered during a sale.


## Implementation Details

-   CompanyToken.sol

This contract creates a token with customized name, symbol and decimals. Upon its creation, the token transfer functionality is paused, that is to say no one is able to trade them. This is possible to be reverted only by the token contract owner - who is the Ethereum address that deployed the token mold contract.
For this contract to work with `TokenSale.sol`, its ownership needs to be passed on to `TokenSale` contract instance that will manage the token sale.

Note: TokenSale does not need to have this smart contract to operate. It accepts any ERC20 smart contract

-   Whitelist.sol

It allows the addition and/or removal of addresses to the whitelist registry. Both addition and removal of addresses is done via passing an array of Ethereum addresses to `addManyToWhitelist` and `removeManyFromWhitelist` functions within the contract. Only the contract owner has the ability to trigger such actions.

-   FundsSplitter.sol

Contract that splits TokenSale funds between Starbase and client. Once deployed, it can serve as `wallet` parameter from the TokenSale contract by adding its the FundsSplitter address in as the `wallet` parameter in the TokenSale `init` function.


-   TokenSale.sol

This contract is where the fundraising occurs.

This tokenSale allows for the minting of tokens on the fly or the distribution of tokens that are already minted:

When it mints, the ownership from the deployed CompanyToken contract needs to be passed on to TokenSale contract. This is accomplished via the `transferOwnership` function found in the zeppelin-solidity's `Ownable.sol` contract.

When it distributes already created tokens, these tokens must be sent to the TokenSale contract.

A TokenSale is successful once the sales reach the `softCap`. A TokenSale wil not distribute token more than what was defined as the `crowdsaleCap`. Tokens are distributed on the go whether it is minted by the TokenSale or not. It is possible that a project has not reached the `softCap` but tokens were distributed by the TokenSale contract.

Participation:

In order for investors to participate in the crowdsale using STARs, they need firstly to approve the transfer of STARs from them to the TokenSale contract. For this, the investor must call the `approve` function from the STAR token contract thus passing the number of STAR tokens it approves to TokenSale so it manages STARs for them during the token purchase event.

Afterwards, investor must trigger `BuyTokens` within TokenSale so the token purchase event goes through. Investor then receives purchased tokens right away.

In case TokenSale mints and distributes token, she will not be able to trade these tokens because token transfers are paused. Tokens need to be unpaused for the transfers to happen and this must be done most likely after the crowdsale is completed by the token owner. Token ownership after the crowdsale must be moved from the TokenSale contract to another Ethereum address, most likely the address of the project owner that is uses Starbase platform for its crowdfunding needs.

When the TokenSale distributes an ERC20 token, investors receive their tokens immediately.

TokenSale also accepts payments in `ETH`. This occurs when when the `isWeiAccepted` is set on TokenSale deployment or during an ongoing sale by calling the `setIsWeiAccepted` function. This needs to be called by the `TokenSale` owner.

When `isWeiAccepted` is triggered and investor sends ether in the transaction by calling `buyTokens`, the function will automatically call the contract internal function `buyTokensWithWei` which handles the purchase with wei/ether.

Purchase process:

Technically, the purchase flow happens as follows using STAR:
1- a user that possesses STAR token must approve the crowdsale contract to transfer STAR tokens on its behalf. This happens on the Starbase client app which connects to Metamask.

2- client app calls the `buyTokens` function passing user address as `beneficiary`, contract checks whether user has given it allowance to spend STAR tokens on user's behalf.

3- if positive allowance, then crowdsale calculates the number of tokens to create and transfers these to user. Once token transfer is completed, it passes on STAR token from user to the Multisig wallet contract.

Purchase flow using ETH is straighforward.
1- `weiIsAccepted` must be set.

2- whitelisted user sends ETH to TokenSale

3- user received tokens.

## Deployment

Deployment with Remix is different, you need to have metamask installed and have the entire contract code at hand. To get the entire contract code use a tool such as [truffle-flattener](https://github.com/alcuadrado/truffle-flattener) to concatenate all smart contract code files into one. Then go to Remix paster the entire code there and deploy the contracts according to Remix's UI.

### Whitelist

To deploy the Whitelist smart contract it is fairly straightforward. It has no parameters.

### Company Token

Three parameters are necessary to pass upon contract deployment: `string _name, string _symbol, uint8 _decimals`. Note: new token standard in Ethereum are moving to have decimals as always `18`. Something to bear in mind and tell Starbase clients in case they want a different figure for the parameters `decimals` in their token.

### Token Sale

It is the more complex of the crowdsale contracts. To set the parameters of the crowdsale one needs to call the `init` function after the contract is deployed.

It has a number of mandatory parameters:

```
_startTime = 1496204377  // time in unix timestamp
_endTime  = 1590898777  // time in unix timestamp
_whitelist = "0xc99e045afdeb86ba44c153cf4498a3fada0bc6d6" // contract of a deployed whitelist contract
_starToken = "0xd70A7A39EFB10cfE34FD79Ea8c06BdB1974C8828" // Starbase STAR token contract
_companyToken =  "0xaee875686Ec9C7A29B29f4Cd48a55bdF816eb00c"  // the EC20 token deployed by the company and who has mint capability
_tokenOwnerAfterSale "0xrbb875686Ec9C7A29B29f4Cd48a55bdF816eb00c" // Address that the TokenSale will pass the token ownership to after it's finished. Only works when TokenSale mints tokens, otherwise must be `0x0`.
_rate = 100 // rate in ETH/company tokens. Here is if investor sends 1 ETH she receives 100 company tokens in return
_starRate = 2 // rate STAR/company tokens. Here is upon sending of 1 STAR, investor receives 2 company tokens in return
_wallet = "0xB01B468423Da913afD743c13f17B01c2cF26b3e8" // address where funds collected in the TokenSale will go to. Generally, it will be a FundsSplitter contract if not otherwise specifically instructed incl. a slightly different TokenSale implementation.
_softCap = 200 // soft cap of the token sale. It tells the frontend application that a sale has been successful
_crowdsaleCap = 1000  // cap for the number of tokens to be minted. Here it is only 1000 tokens that will be sold in the token sale
_isWeiAccepted = true // Bool for acceptance of ether in token sale
_isMinting false // Bool that indicates whether token sale mints ERC20 tokens on sale or simply transfers them
```

## Gas consumption

-   `approve`
    45545

-   `BuyTokens`
    34238

## Development

**Dependencies**

-   `node@10.11.x`

## Setting Up

-   Clone this repository.

-   Install all [system dependencies](#development).

    -   `cd truffle && npm install`

-   Compile contract code

    -   `node_modules/.bin/truffle compile`

## Running Tests

-   `npm test`

**Generate Flattened Contracts**

To generate flattened version of contracts in `flats/`, type:

-   `npm run flat`

To generate flatten version of contracts and serve them to remix, type:

-   install `remixd` with `npm -g remixd`

-   `npm run remix`


## License and Warranty

Be advised that while we strive to provide professional grade, tested code we cannot guarantee its fitness for your application. This is released under The MIT License (MIT) and as such we will not be held liable for lost funds, etc. Please use your best judgment and note the following:

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
