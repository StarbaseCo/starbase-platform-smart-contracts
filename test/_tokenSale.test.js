const TokenSale = artifacts.require('./TokenSale.sol')
const TokenSaleCloneFactory = artifacts.require('./TokenSaleCloneFactory.sol')
const CompanyToken = artifacts.require('./CompanyToken.sol')
const MintableToken = artifacts.require('./MintableToken.sol')
const Whitelist = artifacts.require('./Whitelist.sol')
const FundsSplitter = artifacts.require('./FundsSplitter.sol')
const StarEthRateContract = artifacts.require('./StarEthRate.sol')

const { ensuresException } = require('./helpers/utils')
const { latestTime, duration, increaseTimeTo } = require('./helpers/timer')
const { expect } = require('chai')

const BigNumber = web3.BigNumber

contract(
  'TokenSale',
  ([owner, client, starbase, buyer, buyer2, user1, fakeWallet]) => {
    const rate = new BigNumber(50)
    const value = 1e18
    const starbasePercentageNumber = 10

    const softCap = new BigNumber(200000) // 200 000
    const crowdsaleCap = new BigNumber(20000000) // 20M
    const isWeiAccepted = true
    const isMinting = true

    let startTime, endTime, wallet, targetRates, targetRatesTimestamps
    let crowdsale, token, star, whitelist
    let crowdsaleTokensLeftover, starEthRateContract

    const newCrowdsale = async ({
      rates = [new BigNumber(50)],
      ratesTimestamps = [],
      softCap = new BigNumber(200000),
      crowdsaleCap = new BigNumber(20000000),
      isMinting = true,
      isWeiAccepted = true,
      isTransferringOwnership = true,
      starEthRate = new BigNumber(2),
      starEthRateDecimalCorrectionFactor = new BigNumber(10),
      // starEthRate = 2 / 10
    } = {}) => {
      whitelist = await Whitelist.new()
      star = await MintableToken.new()
      token = await CompanyToken.new('Example Token', 'EXT')
      const fundsSplitter = await FundsSplitter.new(
        client,
        starbase,
        starbasePercentageNumber,
        star.address,
        token.address
      )
      wallet = fundsSplitter.address
      starEthRateContract = await StarEthRateContract.new(
        starEthRateDecimalCorrectionFactor,
        starEthRate
      )
      const tokenSaleLibrary = await TokenSale.new()
      const tokenSaleFactory = await TokenSaleCloneFactory.new(
        tokenSaleLibrary.address,
        star.address
      )

      startTime = ratesTimestamps[0] || latestTime() + duration.seconds(15) // crowdsale starts in 15 seconds into the future
      endTime = startTime + duration.days(70) // 70 days

      targetRates = rates
      targetRatesTimestamps =
        ratesTimestamps.length > 0 ? ratesTimestamps : [startTime]

      const tx = await tokenSaleFactory.create(
        startTime,
        endTime,
        [
          whitelist.address,
          token.address,
          isMinting ? await token.owner() : 0x0,
          starEthRateContract.address,
          wallet,
        ],
        softCap,
        crowdsaleCap,
        isWeiAccepted,
        isMinting,
        targetRates,
        targetRatesTimestamps
      )

      const event = tx.logs.find(
        event => event.event === 'ContractInstantiation'
      )

      crowdsale = TokenSale.at(event.args.instantiation)
      if (isMinting && isTransferringOwnership) {
        await token.transferOwnership(crowdsale.address)
      } else {
        await token.mint(crowdsale.address, crowdsaleCap.mul(1e18).mul(2))
        await token.unpause()
      }
    }

    const itTransfersEthCorrectly = () => {
      it('transfers ETH correctly to client and starbase', async () => {
        const clientBalanceBefore = await web3.eth.getBalance(client)
        const starbaseBalanceBefore = await web3.eth.getBalance(starbase)
        const value = new BigNumber(10e15)

        await increaseTimeTo(latestTime() + duration.days(34))
        await crowdsale.buyTokens(user1, {
          from: user1,
          value,
        })

        const clientBalanceAfter = await web3.eth.getBalance(client)
        const starbaseBalanceAfter = await web3.eth.getBalance(starbase)

        const clientBalanceDifference = clientBalanceAfter.minus(
          clientBalanceBefore
        )
        const starbaseBalanceDifference = starbaseBalanceAfter.minus(
          starbaseBalanceBefore
        )

        starbaseBalanceDifference.should.be.bignumber.equal(
          value.mul(starbasePercentageNumber).div(100)
        )
        clientBalanceDifference.should.be.bignumber.equal(
          value.mul(100 - starbasePercentageNumber).div(100)
        )
      })
    }

    const itSellsTokensUpToCrowdsaleCapInWeiWithRefund = () => {
      it('sells tokens up to crowdsale cap when buying with wei and sends remaining wei back to the buyer', async () => {
        await increaseTimeTo(latestTime() + duration.days(52))

        const buyerWeiBalanceBeforePurchase = web3.eth.getBalance(buyer)

        await crowdsale.buyTokens(buyer, {
          from: buyer,
          value: value * 3,
        })
        const buyerBalance = await token.balanceOf(buyer)
        buyerBalance.should.be.bignumber.equal(crowdsaleCap.mul(1e18))

        const buyerWeiBalanceAfterPurchase = web3.eth.getBalance(buyer)

        buyerWeiBalanceAfterPurchase
          .toNumber()
          .should.be.approximately(
            buyerWeiBalanceBeforePurchase.toNumber() - 1e18,
            1e17
          )

        try {
          await crowdsale.buyTokens(buyer, { value, from: buyer })
          assert.fail()
        } catch (e) {
          ensuresException(e)
        }
      })
    }

    const endsTokenSaleWhenAllTokensAreSold = () => {
      it('ends crowdsale when all tokens are sold', async () => {
        await star.mint(buyer, 10e18)
        await star.approve(crowdsale.address, 1e26, {
          from: buyer,
        })

        await increaseTimeTo(latestTime() + duration.days(34))

        await crowdsale.buyTokens(buyer, { from: buyer })

        const hasEnded = await crowdsale.hasEnded()
        hasEnded.should.be.true
      })
    }

    const endsCrowdsaleWhenAllTokensAreSoldWithWei = () => {
      it('ends crowdsale when all tokens are sold with wei', async () => {
        await increaseTimeTo(latestTime() + duration.days(54))
        await crowdsale.buyTokens(buyer, { from: buyer, value })

        const hasEnded = await crowdsale.hasEnded()
        hasEnded.should.be.true
      })
    }

    beforeEach('initialize contract', async () => {
      await newCrowdsale()
    })

    it('deployment fails when rate is zero', async () => {
      const expectedError = 'All target rates must above 0!'

      try {
        await newCrowdsale({ rates: [0] })
        assert.fail()
      } catch (error) {
        ensuresException(error, expectedError)
      }
    })

    it('deployment falis when rate is 0 and isWeiAccepted is true', async () => {
      const expectedError = 'All target rates must above 0!'

      try {
        await newCrowdsale({ rates: [0], isWeiAccepted: true })
        assert.fail()
      } catch (error) {
        ensuresException(error, expectedError)
      }
    })

    it('deployment succeeds when softcap is lower than crowdsale cap', async () => {
      try {
        await newCrowdsale({
          rate,
          softCap: crowdsaleCap,
          crowdsaleCap: softCap,
        })
        assert.fail()
      } catch (error) {
        ensuresException(error)
      }

      await newCrowdsale({
        rate,
        softCap,
        crowdsaleCap,
      })
      ;(await crowdsale.softCap()).should.be.bignumber.eq(softCap.mul(1e18))
    })

    it('has a whitelist contract', async () => {
      const whitelistContract = await crowdsale.whitelist()
      whitelistContract.should.equal(whitelist.address)
    })

    it('has a token contract', async () => {
      const tokenContract = await crowdsale.tokenOnSale()
      tokenContract.should.equal(token.address)
    })

    it('has a star contract', async () => {
      const starContract = await crowdsale.starToken()
      starContract.should.equal(star.address)
    })

    it('has a wallet', async () => {
      const walletAddress = await crowdsale.wallet()
      walletAddress.should.equal(wallet)
    })

    it('owner is the tx originator and NOT the tokenSaleCloneFactory', async () => {
      const contractOwner = await crowdsale.owner()
      contractOwner.should.equal(owner)
    })

    it('has a softCap variable', async () => {
      const softCapFigure = await crowdsale.softCap()

      softCapFigure.should.be.bignumber.equal(softCap * 1e18)
    })

    it('has a crowdsaleCap variable', async () => {
      const crowdsaleCapFigure = await crowdsale.crowdsaleCap()

      crowdsaleCapFigure.should.be.bignumber.equal(crowdsaleCap * 1e18)
    })

    it('starts with token paused', async () => {
      const paused = await token.paused()
      paused.should.be.true
    })

    it('saves the next token owner', async () => {
      const tokenOwnerAfterSale = await crowdsale.tokenOwnerAfterSale()
      tokenOwnerAfterSale.should.be.equal(owner)
    })

    it('stores all target rates', async () => {
      const ratesTimestamps = [
        latestTime() + duration.seconds(15),
        latestTime() + duration.days(15),
      ]
      const targetRates = [new BigNumber(12), new BigNumber(15)]
      await newCrowdsale({ rates: targetRates, ratesTimestamps })

      const targetRate0 = await crowdsale.targetRates(0)
      const targetRate1 = await crowdsale.targetRates(1)

      targetRate0.should.be.bignumber.equal(targetRates[0])
      targetRate1.should.be.bignumber.equal(targetRates[1])

      try {
        await crowdsale.targetRates(2)
        assert.fail()
      } catch (error) {
        ensuresException(error)
      }
    })

    it('stores all target rates timestamps', async () => {
      const ratesTimestamps = [
        latestTime() + duration.seconds(15),
        latestTime() + duration.days(15),
      ]
      const targetRates = [new BigNumber(12), new BigNumber(15)]
      await newCrowdsale({ rates: targetRates, ratesTimestamps })

      const targetRatesTimestamps0 = await crowdsale.targetRatesTimestamps(0)
      const targetRatesTimestamps1 = await crowdsale.targetRatesTimestamps(1)

      targetRatesTimestamps0.should.be.bignumber.equal(ratesTimestamps[0])
      targetRatesTimestamps1.should.be.bignumber.equal(ratesTimestamps[1])

      try {
        await crowdsale.targetRatesTimestamps(2)
        assert.fail()
      } catch (error) {
        ensuresException(error)
      }
    })

    it('cannot call init again once initial values are set', async () => {
      // attempt to override initial values should throw exceptions
      try {
        await crowdsale.init(
          latestTime() + 2,
          endTime,
          [
            whitelist.address,
            star.address,
            token.address,
            await token.owner(),
            starEthRateContract.address,
            fakeWallet,
          ],
          softCap,
          crowdsaleCap,
          isWeiAccepted,
          isMinting,
          [5],
          [50]
        )
        assert.fail()
      } catch (error) {
        const expectedError = 'Contract instance was initialized already!'
        ensuresException(error, expectedError)
      }

      const crowdsaleWallet = await crowdsale.wallet()
      // fakeWallet did not override wallet
      crowdsaleWallet.should.be.bignumber.equal(wallet)
    })

    describe('whitelist', () => {
      it('only allows owner to add to the whitelist', async () => {
        await increaseTimeTo(latestTime() + duration.days(1))

        try {
          await whitelist.addManyToWhitelist([buyer, buyer2], {
            from: buyer,
          })
          assert.fail()
        } catch (e) {
          ensuresException(e)
        }

        let isBuyerWhitelisted = await whitelist.allowedAddresses.call(buyer)
        isBuyerWhitelisted.should.be.false

        await whitelist.addManyToWhitelist([buyer, buyer2], {
          from: owner,
        })

        isBuyerWhitelisted = await whitelist.allowedAddresses.call(buyer)
        isBuyerWhitelisted.should.be.true
      })

      it('only allows owner to remove from the whitelist', async () => {
        await increaseTimeTo(latestTime() + duration.days(1))
        await whitelist.addManyToWhitelist([buyer, buyer2], {
          from: owner,
        })

        try {
          await whitelist.removeManyFromWhitelist([buyer], {
            from: buyer2,
          })
          assert.fail()
        } catch (e) {
          ensuresException(e)
        }

        let isBuyerWhitelisted = await whitelist.allowedAddresses.call(buyer2)
        isBuyerWhitelisted.should.be.true

        await whitelist.removeManyFromWhitelist([buyer], { from: owner })

        isBuyerWhitelisted = await whitelist.allowedAddresses.call(buyer)
        isBuyerWhitelisted.should.be.false
      })

      it('shows whitelist addresses', async () => {
        await increaseTimeTo(latestTime() + duration.days(1))
        await whitelist.addManyToWhitelist([buyer, buyer2], {
          from: owner,
        })

        const isBuyerWhitelisted = await whitelist.allowedAddresses.call(buyer)
        const isBuyer2Whitelisted = await whitelist.allowedAddresses.call(
          buyer2
        )

        isBuyerWhitelisted.should.be.true
        isBuyer2Whitelisted.should.be.true
      })

      it('has WhitelistUpdated event', async () => {
        await increaseTimeTo(latestTime() + duration.days(1))
        const { logs } = await whitelist.addManyToWhitelist([buyer, buyer2], {
          from: owner,
        })

        const event = logs.find(e => e.event === 'WhitelistUpdated')
        expect(event).to.exist
      })

      it('has WhitelistUpdated event upon removal', async () => {
        await whitelist.addToWhitelist([buyer])

        let tx = await whitelist.removeManyFromWhitelist([buyer], {
          from: owner,
        })
        let entry = tx.logs.find(entry => entry.event === 'WhitelistUpdated')

        expect(entry).to.exist
        expect(entry.args.operation).to.be.equal('Removed')
        expect(entry.args.member).to.be.bignumber.equal(buyer)
      })
    })

    describe('When using rate definitions', async () => {
      beforeEach(async () => {
        const ratesTimestamps = [
          latestTime() + duration.days(2),
          latestTime() + duration.days(15),
          latestTime() + duration.days(18),
        ]
        const rates = [new BigNumber(12), new BigNumber(14), new BigNumber(27)]
        await newCrowdsale({ rates, ratesTimestamps })
      })

      describe('when readling the latest rate via getCurrentRate()', async () => {
        it('receives the current rate based on the latest valid targetTimeStamp', async () => {
          let currentTargetRateIndex = await crowdsale.currentTargetRateIndex()
          let currentRate = await crowdsale.getCurrentRate()
          currentTargetRateIndex.should.be.bignumber.equal(0)
          currentRate[0].should.be.bignumber.equal(targetRates[0])

          await increaseTimeTo(targetRatesTimestamps[0] + duration.seconds(20))
          currentRate = await crowdsale.getCurrentRate()
          currentTargetRateIndex = await crowdsale.currentTargetRateIndex()
          currentTargetRateIndex.should.be.bignumber.equal(0)
          currentRate[0].should.be.bignumber.equal(targetRates[0])
          currentRate[1].should.be.bignumber.equal(0)

          await increaseTimeTo(targetRatesTimestamps[1] + duration.seconds(20))
          currentRate = await crowdsale.getCurrentRate()
          currentTargetRateIndex = await crowdsale.currentTargetRateIndex()
          currentTargetRateIndex.should.be.bignumber.equal(0)
          currentRate[0].should.be.bignumber.equal(targetRates[1])
          currentRate[1].should.be.bignumber.equal(1)

          await increaseTimeTo(targetRatesTimestamps[2] + duration.seconds(20))
          currentRate = await crowdsale.getCurrentRate()
          currentTargetRateIndex = await crowdsale.currentTargetRateIndex()
          currentTargetRateIndex.should.be.bignumber.equal(0)
          currentRate[0].should.be.bignumber.equal(targetRates[2])
          currentRate[1].should.be.bignumber.equal(2)

          await crowdsale.checkForNewRateAndUpdate()
          currentRate = await crowdsale.getCurrentRate()
          currentTargetRateIndex = await crowdsale.currentTargetRateIndex()
          currentTargetRateIndex.should.be.bignumber.equal(2)
          currentRate[0].should.be.bignumber.equal(targetRates[2])
          currentRate[1].should.be.bignumber.equal(2)
        })
      })

      describe('when updating currentTargetRateIndex via checkForNewRateAndUpdate()', async () => {
        it('updates currentTargetRateIndex only if there is a newer valid timestamp', async () => {
          let currentTargetRateIndex = await crowdsale.currentTargetRateIndex()
          currentTargetRateIndex.should.be.bignumber.equal(0)

          await increaseTimeTo(targetRatesTimestamps[0] + duration.seconds(20))
          await crowdsale.checkForNewRateAndUpdate()
          currentTargetRateIndex = await crowdsale.currentTargetRateIndex()
          currentTargetRateIndex.should.be.bignumber.equal(0)

          await increaseTimeTo(targetRatesTimestamps[1] - duration.seconds(20))
          await crowdsale.checkForNewRateAndUpdate()
          currentTargetRateIndex = await crowdsale.currentTargetRateIndex()
          currentTargetRateIndex.should.be.bignumber.equal(0)

          await increaseTimeTo(targetRatesTimestamps[1] + duration.seconds(20))
          await crowdsale.checkForNewRateAndUpdate()
          currentTargetRateIndex = await crowdsale.currentTargetRateIndex()
          currentTargetRateIndex.should.be.bignumber.equal(1)

          await increaseTimeTo(targetRatesTimestamps[2] - duration.seconds(20))
          await crowdsale.checkForNewRateAndUpdate()
          currentTargetRateIndex = await crowdsale.currentTargetRateIndex()
          currentTargetRateIndex.should.be.bignumber.equal(1)

          await increaseTimeTo(targetRatesTimestamps[2] + duration.seconds(20))
          await crowdsale.checkForNewRateAndUpdate()
          currentTargetRateIndex = await crowdsale.currentTargetRateIndex()
          currentTargetRateIndex.should.be.bignumber.equal(2)
        })
      })
    })

    const itFunctionsAsExpected = async ({ isMinting }) => {
      if (isMinting) {
        afterEach(
          'check for invariant: total token supply <= total token cap',
          async () => {
            expect(await crowdsale.tokensSold()).to.be.bignumber.most(
              await crowdsale.crowdsaleCap()
            )
          }
        )
      }

      describe('crowdsale finalization', () => {
        beforeEach(async () => {
          crowdsaleTokensLeftover = 10

          await newCrowdsale({
            rates: [crowdsaleCap.sub(crowdsaleTokensLeftover).mul(5)],
            isMinting,
          })
          await whitelist.addManyToWhitelist([buyer])
          await star.mint(buyer, 1e18)

          await increaseTimeTo(latestTime() + duration.days(52))

          await star.approve(crowdsale.address, 1e18, { from: buyer })
          await crowdsale.buyTokens(buyer, { from: buyer })

          await increaseTimeTo(latestTime() + duration.days(30))

          await crowdsale.finalize()
        })

        it('shows that crowdsale is finalized', async () => {
          const isCrowdsaleFinalized = await crowdsale.isFinalized()
          isCrowdsaleFinalized.should.be.true
        })

        if (isMinting) {
          it('returns token ownership to next owner', async () => {
            const tokenOwnerAfterSale = await crowdsale.tokenOwnerAfterSale()
            const tokenOwner = await token.owner()
            tokenOwner.should.be.equal(tokenOwnerAfterSale)
          })
        }

        it('mints/transfers remaining crowdsale tokens to wallet', async () => {
          const walletTokenBalance = await token.balanceOf(wallet)

          let remainingTokens = new BigNumber(crowdsaleTokensLeftover * 1e18)
          if (!isMinting)
            remainingTokens = remainingTokens.add(crowdsaleCap * 1e18)

          walletTokenBalance.should.be.bignumber.equal(remainingTokens)
        })
      })

      describe('token purchases', () => {
        beforeEach('initialize contract', async () => {
          await whitelist.addManyToWhitelist([buyer, buyer2])

          await star.mint(buyer, 10e18)
          await star.mint(user1, 10e18)
        })

        if (isMinting) {
          it('does NOT allow purchase when token ownership does not currently belong to crowdsale contract', async () => {
            await newCrowdsale({
              rate,
              isMinting,
              isTransferringOwnership: false,
            })
            await whitelist.addManyToWhitelist([buyer, user1])

            await star.mint(buyer, 10e25)
            await star.mint(user1, 10e25)

            await star.approve(crowdsale.address, 5e18, { from: user1 })
            await star.approve(crowdsale.address, 5e18, { from: buyer })

            await increaseTimeTo(latestTime() + duration.days(52))

            try {
              await crowdsale.buyTokens(buyer, {
                from: buyer,
              })
              assert.fail()
            } catch (e) {
              ensuresException(e)
            }

            const buyerBalance = await token.balanceOf(buyer)
            buyerBalance.should.be.bignumber.equal(0)

            await token.transferOwnership(crowdsale.address)

            await crowdsale.buyTokens(user1, {
              from: user1,
            })

            const userBalance = await token.balanceOf(user1)
            userBalance.should.be.bignumber.equal(50e18)
          })
        }

        it('cannot buy with empty beneficiary address', async () => {
          await increaseTimeTo(latestTime() + duration.days(52))

          await star.approve(crowdsale.address, 5e18, { from: buyer })

          try {
            await crowdsale.buyTokens('0x00', { from: buyer })
            assert.fail()
          } catch (e) {
            ensuresException(e)
          }

          const buyerBalance = await token.balanceOf(buyer)
          buyerBalance.should.be.bignumber.equal(0)
        })

        it('allows ONLY whitelisted addresses to purchase tokens', async () => {
          await increaseTimeTo(latestTime() + duration.days(52))

          await star.approve(crowdsale.address, 5e18, { from: buyer })
          // user1 is not whitelisted
          await star.approve(crowdsale.address, 5e18, { from: user1 })

          try {
            await crowdsale.buyTokens(user1, { from: user1 })
            assert.fail()
          } catch (e) {
            ensuresException(e)
          }

          const userBalance = await token.balanceOf(user1)
          userBalance.should.be.bignumber.equal(0)

          // purchase occurrence
          await crowdsale.buyTokens(buyer, { from: buyer })

          const buyerBalance = await token.balanceOf(buyer)
          buyerBalance.should.be.bignumber.equal(50e18)
        })

        it('allows ONLY STAR tokens to purchase tokens at first', async () => {
          await newCrowdsale({ rate, isWeiAccepted: false })
          await whitelist.addManyToWhitelist([buyer])

          await increaseTimeTo(latestTime() + duration.days(22))

          await star.mint(buyer, 5e18)
          await star.approve(crowdsale.address, 5e18, { from: buyer })

          try {
            await crowdsale.buyTokens(buyer, { from: owner, value })
            assert.fail()
          } catch (e) {
            ensuresException(e)
          }

          // purchase happens
          await crowdsale.buyTokens(buyer, { from: owner })

          // only the STAR purchase
          const buyerBalance = await token.balanceOf(buyer)
          buyerBalance.should.be.bignumber.equal(50e18)
        })

        it('cannot buy tokens by sending star transaction to contract', async () => {
          await increaseTimeTo(latestTime() + duration.days(52))

          await whitelist.addManyToWhitelist([user1])
          await star.approve(crowdsale.address, 5e18, { from: user1 })

          try {
            await crowdsale.sendTransaction({ from: user1 })
            assert.fail()
          } catch (e) {
            ensuresException(e)
          }

          const buyerBalance = await token.balanceOf(buyer)
          buyerBalance.should.be.bignumber.equal(0)
        })

        it('cannot buy tokens by sending wei when isWeiAccepted is disabled', async () => {
          await newCrowdsale({ isWeiAccepted: false })
          await increaseTimeTo(latestTime() + duration.days(22))
          await whitelist.addManyToWhitelist([user1])

          try {
            await crowdsale.buyTokens(user1, { from: user1, value })
            assert.fail()
          } catch (e) {
            ensuresException(e)
          }

          const userBalance = await token.balanceOf(user1)
          userBalance.should.be.bignumber.equal(0)

          // purchase occurence
          await newCrowdsale({ rate, isWeiAccepted: true })
          await whitelist.addManyToWhitelist([user1])
          await increaseTimeTo(latestTime() + duration.days(22))
          await crowdsale.buyTokens(user1, { from: user1, value })

          const buyerBalance = await token.balanceOf(user1)
          buyerBalance.should.be.bignumber.equal(50e18)
        })

        it('buys tokens by sending wei when it is enabled', async () => {
          await increaseTimeTo(latestTime() + duration.days(52))
          await whitelist.addManyToWhitelist([user1])

          await crowdsale.buyTokens(user1, { from: user1, value })

          const userBalance = await token.balanceOf(user1)
          userBalance.should.be.bignumber.equal(50e18)

          await crowdsale.buyTokens(user1, { from: user1, value })

          const buyerBalance = await token.balanceOf(user1)
          buyerBalance.should.be.bignumber.equal(100e18)
        })

        it('updates wei raised', async () => {
          await increaseTimeTo(latestTime() + duration.days(52))
          await whitelist.addManyToWhitelist([user1])

          await crowdsale.buyTokens(user1, { from: user1, value })

          let weiRaised = await crowdsale.weiRaised()
          weiRaised.should.be.bignumber.equal(1e18)

          await crowdsale.buyTokens(user1, { from: user1, value })

          weiRaised = await crowdsale.weiRaised()
          weiRaised.should.be.bignumber.equal(2e18)
        })

        it('does NOT buy tokens when crowdsale is paused', async () => {
          await increaseTimeTo(latestTime() + duration.days(52))

          await star.approve(crowdsale.address, 5e18, { from: buyer })

          await crowdsale.pause()
          let buyerBalance

          try {
            await crowdsale.buyTokens(buyer, { from: buyer })
            assert.fail()
          } catch (e) {
            ensuresException(e)
          }

          buyerBalance = await token.balanceOf(buyer)
          buyerBalance.should.be.bignumber.equal(0)

          await crowdsale.unpause()
          await crowdsale.buyTokens(buyer, { from: buyer })

          buyerBalance = await token.balanceOf(buyer)
          buyerBalance.should.be.bignumber.equal(50e18)
        })

        it('updates STAR raised', async () => {
          await increaseTimeTo(latestTime() + duration.days(52))

          await star.approve(crowdsale.address, 8e18, { from: buyer })

          // purchase occurence
          await crowdsale.buyTokens(buyer, { from: owner })

          const buyerBalance = await token.balanceOf(buyer)
          buyerBalance.should.be.bignumber.equal(80e18)

          const starRaised = await crowdsale.starRaised()
          starRaised.should.be.bignumber.equal(8e18)
        })

        describe('with multiple target rate definitions', async () => {
          beforeEach(async () => {
            const ratesTimestamps = [
              latestTime() + duration.days(2),
              latestTime() + duration.days(15),
              latestTime() + duration.days(18),
            ]
            const rates = [
              new BigNumber(50),
              new BigNumber(100),
              new BigNumber(200),
            ]
            await newCrowdsale({ rates, ratesTimestamps })
            await star.mint(user1, 30e18)
          })

          it('uses latest targetRates for purchases with Wei', async () => {
            await increaseTimeTo(latestTime() + duration.days(4))
            await whitelist.addManyToWhitelist([user1])

            await crowdsale.buyTokens(user1, { from: user1, value })

            let userBalance = await token.balanceOf(user1)
            userBalance.should.be.bignumber.equal(50e18)

            await increaseTimeTo(latestTime() + duration.days(12))
            await crowdsale.buyTokens(user1, { from: user1, value })

            buyerBalance = await token.balanceOf(user1)
            buyerBalance.should.be.bignumber.equal(150e18)

            await increaseTimeTo(latestTime() + duration.days(5))
            await crowdsale.buyTokens(user1, { from: user1, value })

            buyerBalance = await token.balanceOf(user1)
            buyerBalance.should.be.bignumber.equal(350e18)
          })

          it('uses latest targetRates for purchases with STAR', async () => {
            await increaseTimeTo(latestTime() + duration.days(4))
            await whitelist.addManyToWhitelist([user1])

            await star.approve(crowdsale.address, 5e18, { from: user1 })
            await crowdsale.buyTokens(user1, { from: user1 })

            let userBalance = await token.balanceOf(user1)
            userBalance.should.be.bignumber.equal(50e18)

            await increaseTimeTo(latestTime() + duration.days(12))
            await star.approve(crowdsale.address, 5e18, { from: user1 })
            await crowdsale.buyTokens(user1, { from: user1 })

            buyerBalance = await token.balanceOf(user1)
            buyerBalance.should.be.bignumber.equal(150e18)

            await increaseTimeTo(latestTime() + duration.days(5))
            await star.approve(crowdsale.address, 5e18, { from: user1 })
            await crowdsale.buyTokens(user1, { from: user1 })

            buyerBalance = await token.balanceOf(user1)
            buyerBalance.should.be.bignumber.equal(350e18)
          })

          it('updates currentTargetRateIndex after purchase', async () => {
            await increaseTimeTo(latestTime() + duration.days(4))
            await whitelist.addManyToWhitelist([user1])

            let currentTargetRateIndex = await crowdsale.currentTargetRateIndex()
            currentTargetRateIndex.should.be.bignumber.equal(0)

            await increaseTimeTo(latestTime() + duration.days(12))
            await crowdsale.buyTokens(user1, { from: user1, value })

            currentTargetRateIndex = await crowdsale.currentTargetRateIndex()
            currentTargetRateIndex.should.be.bignumber.equal(1)

            await increaseTimeTo(latestTime() + duration.days(5))
            await crowdsale.buyTokens(user1, { from: user1, value })

            currentTargetRateIndex = await crowdsale.currentTargetRateIndex()
            currentTargetRateIndex.should.be.bignumber.equal(2)
          })
        })

        describe('when purchasing given different STAR/ETH rates', async () => {
          describe('with STAR/ETH rate of 10 STAR = 1 ETH', async () => {
            const starEthRate = new BigNumber(1)
            const starEthRateDecimalCorrectionFactor = new BigNumber(10)

            beforeEach(async () => {
              await newCrowdsale({
                starEthRate,
                starEthRateDecimalCorrectionFactor,
              })
              await star.mint(user1, 30e18)
              await increaseTimeTo(latestTime() + duration.days(20))
              await whitelist.addManyToWhitelist([user1])
            })

            it('gives 10 times as many tokens for purchasing with ETH', async () => {
              await crowdsale.buyTokens(user1, { from: user1, value: 1e18 })

              let userBalance = await token.balanceOf(user1)
              userBalance.should.be.bignumber.equal(50e18)

              await star.approve(crowdsale.address, 1e18, { from: user1 })
              await crowdsale.buyTokens(user1, { from: user1 })

              buyerBalance = await token.balanceOf(user1)
              buyerBalance.should.be.bignumber.equal(55e18)
            })
          })

          describe('with STAR/ETH rate of 3,000,000 STAR = 50 ETH', async () => {
            const starEthRate = new BigNumber(50)
            const starEthRateDecimalCorrectionFactor = new BigNumber(3000000)

            beforeEach(async () => {
              await newCrowdsale({
                starEthRate,
                starEthRateDecimalCorrectionFactor,
              })
              await star.mint(user1, 30e18)
              await increaseTimeTo(latestTime() + duration.days(20))
              await whitelist.addManyToWhitelist([user1])
            })

            it('gives 60,000 times as many tokens for purchasing with ETH', async () => {
              await crowdsale.buyTokens(user1, { from: user1, value: 1.2e18 })

              let userBalance = await token.balanceOf(user1)
              userBalance.should.be.bignumber.equal(60e18)

              await star.approve(crowdsale.address, 1.2e18, { from: user1 })
              await crowdsale.buyTokens(user1, { from: user1 })

              buyerBalance = await token.balanceOf(user1)
              buyerBalance.should.be.bignumber.equal(60e18 + 1e15)
            })
          })
        })

        describe('with soft cap', () => {
          describe('not reaching the softcap', () => {
            beforeEach(async () => {
              await newCrowdsale({
                softCap,
                rates: [softCap],
                isMinting,
              })
              await whitelist.addManyToWhitelist([buyer])
            })

            it('does NOT transfer ETH funds between client and starbase', async () => {
              const clientBalanceBefore = await web3.eth.getBalance(client)
              const starbaseBalanceBefore = await web3.eth.getBalance(starbase)

              await increaseTimeTo(latestTime() + duration.days(52))
              await whitelist.addManyToWhitelist([user1])
              await crowdsale.buyTokens(user1, {
                from: user1,
                value: 3e15,
              })

              const clientBalanceAfter = await web3.eth.getBalance(client)
              const starbaseBalanceAfter = await web3.eth.getBalance(starbase)
              const tokenSaleBalance = await web3.eth.getBalance(
                crowdsale.address
              )

              clientBalanceAfter.should.be.bignumber.equal(clientBalanceBefore)
              starbaseBalanceAfter.should.be.bignumber.equal(
                starbaseBalanceBefore
              )
              tokenSaleBalance.should.be.bignumber.equal(3e15)
            })

            it('does NOT transfer STAR funds between client and starbase', async () => {
              await star.mint(buyer, 3e15)
              await star.approve(crowdsale.address, 3e15, {
                from: buyer,
              })

              await increaseTimeTo(latestTime() + duration.days(34))

              const clientBalanceBefore = await star.balanceOf(client)
              const starbaseBalanceBefore = await star.balanceOf(starbase)

              await crowdsale.buyTokens(buyer, { from: buyer })

              const clientBalanceAfter = await star.balanceOf(client)
              const starbaseBalanceAfter = await star.balanceOf(starbase)
              const tokenSaleBalance = await star.balanceOf(crowdsale.address)

              clientBalanceAfter.should.be.bignumber.equal(clientBalanceBefore)
              starbaseBalanceAfter.should.be.bignumber.equal(
                starbaseBalanceBefore
              )
              tokenSaleBalance.should.be.bignumber.equal(3e15)
            })

            describe('using ETH', async () => {
              const ethValue = new BigNumber(10000)

              beforeEach(async () => {
                await whitelist.addManyToWhitelist([buyer])
                await increaseTimeTo(latestTime() + duration.days(1))
                const scBalanceBeforeBuying = await web3.eth.getBalance(
                  crowdsale.address
                )
                await crowdsale.buyTokens(buyer, {
                  from: buyer,
                  value: ethValue,
                })
                const scBalanceAfterBuying = await web3.eth.getBalance(
                  crowdsale.address
                )
                await increaseTimeTo(latestTime() + duration.days(80))

                scBalanceAfterBuying.should.be.bignumber.equal(
                  scBalanceBeforeBuying.add(ethValue)
                )
              })

              it('allows users to withdraw invested ETH when sale failed', async () => {
                const scBalanceAfterBeforeWithdraw = await web3.eth.getBalance(
                  crowdsale.address
                )
                const userEthBalanceBeforeWithdraw = await web3.eth.getBalance(
                  buyer
                )
                const receipt = await crowdsale.withdrawUserFunds({
                  from: buyer,
                })
                const userEthBalanceAfterWithdraw = await web3.eth.getBalance(
                  buyer
                )
                const scBalanceAfterWithdraw = await web3.eth.getBalance(
                  crowdsale.address
                )

                scBalanceAfterWithdraw.should.be.bignumber.equal(
                  scBalanceAfterBeforeWithdraw.minus(ethValue)
                )

                const tx = await web3.eth.getTransaction(receipt.tx)
                const gasUsed = new BigNumber(receipt.receipt.gasUsed)
                const gasPrice = new BigNumber(tx.gasPrice)
                const gasCosts = gasUsed.mul(gasPrice)

                const expectedUserBalanceAfterWithdraw = userEthBalanceBeforeWithdraw
                  .add(ethValue)
                  .minus(gasCosts)

                userEthBalanceAfterWithdraw.should.be.bignumber.equal(
                  expectedUserBalanceAfterWithdraw
                )
              })

              it('does not allow multiple withdrawals of funds', async () => {
                const ethUserInvestmentBefore = await crowdsale.ethInvestments(
                  buyer
                )
                await crowdsale.withdrawUserFunds({ from: buyer })
                const ethUserInvestmentAfter = await crowdsale.ethInvestments(
                  buyer
                )

                try {
                  await crowdsale.withdrawUserFunds({ from: buyer })
                  assert.fail()
                } catch (e) {
                  const expectedError =
                    "You don't have any funds in the contract!"
                  ensuresException(e, expectedError)
                }

                ethUserInvestmentBefore.should.be.bignumber.equal(ethValue)
                ethUserInvestmentAfter.should.be.bignumber.equal(0)
              })
            })

            describe('using STAR', async () => {
              const starInvestValue = 3e15

              beforeEach(async () => {
                await star.mint(buyer, starInvestValue + 100)
                await star.approve(crowdsale.address, starInvestValue, {
                  from: buyer,
                })

                const scBalanceBeforeBuying = await star.balanceOf(
                  crowdsale.address
                )

                await increaseTimeTo(latestTime() + duration.days(34))
                await crowdsale.buyTokens(buyer, { from: buyer })
                await increaseTimeTo(latestTime() + duration.days(80))

                const scBalanceAfterBuying = await star.balanceOf(
                  crowdsale.address
                )
                scBalanceAfterBuying.should.be.bignumber.equal(
                  scBalanceBeforeBuying.add(starInvestValue)
                )
              })

              it('allows users to withdraw invested STAR when sale failed', async () => {
                const scBalanceBefore = await star.balanceOf(crowdsale.address)
                const starUserInvestment = await crowdsale.starInvestments(
                  buyer
                )
                const userStarBalanceBeforeWithdraw = await star.balanceOf(
                  buyer
                )
                await crowdsale.withdrawUserFunds({ from: buyer })
                const userStarBalanceAfterWithdraw = await star.balanceOf(buyer)

                const scBalanceAfterWithdraw = await star.balanceOf(
                  crowdsale.address
                )
                scBalanceAfterWithdraw.should.be.bignumber.equal(
                  scBalanceBefore.minus(starInvestValue)
                )

                starUserInvestment.should.be.bignumber.equal(starInvestValue)
                userStarBalanceAfterWithdraw.should.be.bignumber.equal(
                  userStarBalanceBeforeWithdraw.add(starInvestValue)
                )
              })

              it('does not allow multiple withdrawals of funds', async () => {
                const starUserInvestmentBefore = await crowdsale.starInvestments(
                  buyer
                )
                await crowdsale.withdrawUserFunds({ from: buyer })
                const starUserInvestmentAfter = await crowdsale.starInvestments(
                  buyer
                )

                try {
                  await crowdsale.withdrawUserFunds({ from: buyer })
                  assert.fail()
                } catch (e) {
                  const expectedError =
                    "You don't have any funds in the contract!"
                  ensuresException(e, expectedError)
                }

                starUserInvestmentBefore.should.be.bignumber.equal(
                  starInvestValue
                )
                starUserInvestmentAfter.should.be.bignumber.equal(0)
              })
            })
          })

          describe('reaching the softcap', () => {
            beforeEach(async () => {
              await newCrowdsale({
                softCap,
                rates: [crowdsaleCap],
                isMinting,
              })
              await whitelist.addManyToWhitelist([buyer, user1])
            })

            it('transfers token sale STAR funds between client and starbase', async () => {
              await star.mint(buyer, 1e18)
              await star.approve(crowdsale.address, 1e18, {
                from: buyer,
              })

              await increaseTimeTo(latestTime() + duration.days(34))

              const clientBalanceBefore = await star.balanceOf(client)
              const starbaseBalanceBefore = await star.balanceOf(starbase)

              await crowdsale.buyTokens(buyer, { from: buyer })

              const clientBalanceAfter = await star.balanceOf(client)
              const starbaseBalanceAfter = await star.balanceOf(starbase)

              const clientBalanceDifference = clientBalanceAfter.minus(
                clientBalanceBefore
              )
              const starbaseBalanceDifference = starbaseBalanceAfter.minus(
                starbaseBalanceBefore
              )

              starbaseBalanceDifference.should.be.bignumber.equal(1e17)
              clientBalanceDifference.should.be.bignumber.equal(9e17)
            })

            it('transfers STAR funds between client and starbase once softCap is reached', async () => {
              await star.mint(buyer, 10004e15)
              await star.approve(crowdsale.address, 3e15, {
                from: buyer,
              })

              await increaseTimeTo(latestTime() + duration.days(34))

              const clientBalanceBefore = await star.balanceOf(client)
              const starbaseBalanceBefore = await star.balanceOf(starbase)

              await crowdsale.buyTokens(buyer, { from: buyer })

              let clientBalanceAfter = await star.balanceOf(client)
              let starbaseBalanceAfter = await star.balanceOf(starbase)
              let tokenSaleBalance = await star.balanceOf(crowdsale.address)

              clientBalanceAfter.should.be.bignumber.equal(clientBalanceBefore)
              starbaseBalanceAfter.should.be.bignumber.equal(
                starbaseBalanceBefore
              )
              tokenSaleBalance.should.be.bignumber.equal(3e15)

              // still has not reached cap
              await star.approve(crowdsale.address, 1e15, {
                from: buyer,
              })
              await crowdsale.buyTokens(buyer, { from: buyer })

              clientBalanceAfter = await star.balanceOf(client)
              starbaseBalanceAfter = await star.balanceOf(starbase)
              tokenSaleBalance = await star.balanceOf(crowdsale.address)

              clientBalanceAfter.should.be.bignumber.equal(clientBalanceBefore)
              starbaseBalanceAfter.should.be.bignumber.equal(
                starbaseBalanceBefore
              )
              tokenSaleBalance.should.be.bignumber.equal(4e15)

              // reaches soft cap and goes over crowdsale cap
              await star.approve(crowdsale.address, 1e18, {
                from: buyer,
              })
              await crowdsale.buyTokens(buyer, { from: buyer })

              tokenSaleBalance = await star.balanceOf(crowdsale.address)
              tokenSaleBalance.should.be.bignumber.equal(0)
            })

            itTransfersEthCorrectly()

            it('transfers ETH funds in contract between client and starbase once softCap is reached', async () => {
              const clientBalanceBefore = await web3.eth.getBalance(client)
              const starbaseBalanceBefore = await web3.eth.getBalance(starbase)

              await increaseTimeTo(latestTime() + duration.days(52))
              await whitelist.addManyToWhitelist([user1])
              await crowdsale.buyTokens(user1, {
                from: user1,
                value: 3e15,
              })

              let clientBalanceAfter = await web3.eth.getBalance(client)
              let starbaseBalanceAfter = await web3.eth.getBalance(starbase)
              let tokenSaleBalance = await web3.eth.getBalance(
                crowdsale.address
              )

              clientBalanceAfter.should.be.bignumber.equal(clientBalanceBefore)
              starbaseBalanceAfter.should.be.bignumber.equal(
                starbaseBalanceBefore
              )
              tokenSaleBalance.should.be.bignumber.equal(3e15)

              // still has not reached soft cap
              await crowdsale.buyTokens(user1, {
                from: user1,
                value: 1e15,
              })

              clientBalanceAfter = await web3.eth.getBalance(client)
              starbaseBalanceAfter = await web3.eth.getBalance(starbase)
              tokenSaleBalance = await web3.eth.getBalance(crowdsale.address)

              clientBalanceAfter.should.be.bignumber.equal(clientBalanceBefore)
              starbaseBalanceAfter.should.be.bignumber.equal(
                starbaseBalanceBefore
              )
              tokenSaleBalance.should.be.bignumber.equal(4e15)

              // goes over soft cap and crowdsale cap
              await crowdsale.buyTokens(user1, {
                from: user1,
                value: 1e18,
              })

              clientBalanceAfter = await web3.eth.getBalance(client)
              starbaseBalanceAfter = await web3.eth.getBalance(starbase)
              tokenSaleBalance = await web3.eth.getBalance(crowdsale.address)

              const clientBalanceDifference = clientBalanceAfter.minus(
                clientBalanceBefore
              )
              const starbaseBalanceDifference = starbaseBalanceAfter.minus(
                starbaseBalanceBefore
              )

              starbaseBalanceDifference.should.be.bignumber.equal(1e17)
              clientBalanceDifference.should.be.bignumber.equal(9e17)
              tokenSaleBalance.should.be.bignumber.equal(0)
            })

            itSellsTokensUpToCrowdsaleCapInWeiWithRefund()

            it('checks when soft cap is reached', async () => {
              await newCrowdsale({
                rates: [softCap * 5],
                isMinting,
              })
              await whitelist.addManyToWhitelist([buyer])
              await star.mint(buyer, 10e18)
              await star.approve(crowdsale.address, 1e18, {
                from: buyer,
              })

              await increaseTimeTo(latestTime() + duration.days(34))

              let hasReachedSoftCap = await crowdsale.hasReachedSoftCap()
              hasReachedSoftCap.should.be.false

              await crowdsale.buyTokens(buyer, { from: buyer })

              hasReachedSoftCap = await crowdsale.hasReachedSoftCap()
              hasReachedSoftCap.should.be.true
            })

            endsTokenSaleWhenAllTokensAreSold()
            endsCrowdsaleWhenAllTokensAreSoldWithWei()
          })
        })

        describe('without soft cap', () => {
          beforeEach(async () => {
            await newCrowdsale({
              softCap: 0,
              rates: [crowdsaleCap],
              isMinting,
            })
            await whitelist.addManyToWhitelist([buyer, user1])
          })

          itTransfersEthCorrectly()

          it('transfers ETH funds in contract between client and starbase everytime', async () => {
            const clientBalanceBefore = await web3.eth.getBalance(client)
            const starbaseBalanceBefore = await web3.eth.getBalance(starbase)

            await increaseTimeTo(latestTime() + duration.days(52))
            await whitelist.addManyToWhitelist([user1])
            await crowdsale.buyTokens(user1, {
              from: user1,
              value: 3e15,
            })

            let clientBalanceAfter = await web3.eth.getBalance(client)
            let starbaseBalanceAfter = await web3.eth.getBalance(starbase)
            let tokenSaleBalance = await web3.eth.getBalance(crowdsale.address)

            let clientBalanceDifference = clientBalanceAfter.minus(
              clientBalanceBefore
            )
            let starbaseBalanceDifference = starbaseBalanceAfter.minus(
              starbaseBalanceBefore
            )

            clientBalanceDifference.should.be.bignumber.equal(2.7e15)
            starbaseBalanceDifference.should.be.bignumber.equal(0.3e15)
            tokenSaleBalance.should.be.bignumber.equal(0)

            // continues transferrring eth funds
            await crowdsale.buyTokens(user1, {
              from: user1,
              value: 1e15,
            })

            clientBalanceAfter = await web3.eth.getBalance(client)
            starbaseBalanceAfter = await web3.eth.getBalance(starbase)
            tokenSaleBalance = await web3.eth.getBalance(crowdsale.address)

            clientBalanceDifference = clientBalanceAfter.minus(
              clientBalanceBefore
            )
            starbaseBalanceDifference = starbaseBalanceAfter.minus(
              starbaseBalanceBefore
            )

            clientBalanceDifference.should.be.bignumber.equal(3.6e15)
            starbaseBalanceDifference.should.be.bignumber.equal(0.4e15)
            tokenSaleBalance.should.be.bignumber.equal(0)

            // reaches crowdsale cap
            await crowdsale.buyTokens(user1, {
              from: user1,
              value: 1e18,
            })

            clientBalanceAfter = await web3.eth.getBalance(client)
            starbaseBalanceAfter = await web3.eth.getBalance(starbase)
            tokenSaleBalance = await web3.eth.getBalance(crowdsale.address)

            clientBalanceDifference = clientBalanceAfter.minus(
              clientBalanceBefore
            )
            starbaseBalanceDifference = starbaseBalanceAfter.minus(
              starbaseBalanceBefore
            )

            starbaseBalanceDifference.should.be.bignumber.equal(1e17)
            clientBalanceDifference.should.be.bignumber.equal(9e17)
            tokenSaleBalance.should.be.bignumber.equal(0)
          })

          it('transfers STAR funds between client and starbase everytime', async () => {
            await star.mint(buyer, 10004e15)
            await star.approve(crowdsale.address, 3e15, {
              from: buyer,
            })

            await increaseTimeTo(latestTime() + duration.days(34))
            await crowdsale.buyTokens(buyer, { from: buyer })

            let clientBalanceAfter = await star.balanceOf(client)
            let starbaseBalanceAfter = await star.balanceOf(starbase)
            let tokenSaleBalance = await star.balanceOf(crowdsale.address)

            clientBalanceAfter.should.be.bignumber.equal(2.7e15)
            starbaseBalanceAfter.should.be.bignumber.equal(0.3e15)
            tokenSaleBalance.should.be.bignumber.equal(0)

            // continues to transfer
            await star.approve(crowdsale.address, 1e15, {
              from: buyer,
            })
            await crowdsale.buyTokens(buyer, { from: buyer })

            clientBalanceAfter = await star.balanceOf(client)
            starbaseBalanceAfter = await star.balanceOf(starbase)
            tokenSaleBalance = await star.balanceOf(crowdsale.address)

            clientBalanceAfter.should.be.bignumber.equal(3.6e15)
            starbaseBalanceAfter.should.be.bignumber.equal(0.4e15)
            tokenSaleBalance.should.be.bignumber.equal(0)

            // reaches crowdsale cap
            await star.approve(crowdsale.address, 1e18, {
              from: buyer,
            })
            await crowdsale.buyTokens(buyer, { from: buyer })

            tokenSaleBalance = await star.balanceOf(crowdsale.address)
            tokenSaleBalance.should.be.bignumber.equal(0)
          })

          itSellsTokensUpToCrowdsaleCapInWeiWithRefund()
          endsTokenSaleWhenAllTokensAreSold()
          endsCrowdsaleWhenAllTokensAreSoldWithWei()
        })
      })
    }

    describe('TokenSale is minting tokens', async () => {
      itFunctionsAsExpected({ isMinting: true })
    })

    describe('TokenSale transferring tokens', async () => {
      itFunctionsAsExpected({ isMinting: false })
    })
  }
)
