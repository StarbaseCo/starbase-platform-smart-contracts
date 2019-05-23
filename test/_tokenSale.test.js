const TokenSale = artifacts.require('./TokenSale.sol')
const CompanyToken = artifacts.require('./CompanyToken.sol')
const MintableToken = artifacts.require('./MintableToken.sol')
const Whitelist = artifacts.require('./Whitelist.sol')
const FundsSplitter = artifacts.require('./FundsSplitter.sol')
const StarEthRateContract = artifacts.require('./StarEthRate.sol')

const { ensuresException } = require('./helpers/utils')
const { expect } = require('chai')

const {
  balance,
  BN,
  constants,
  ether,
  time,
} = require('openzeppelin-test-helpers')

const { duration } = time
const increaseTimeTo = time.increaseTo
const latestTime = time.latest

contract(
  'TokenSale',
  ([owner, client, starbase, buyer, buyer2, user1, fakeWallet]) => {
    const rate = new BN(50)
    const value = ether('1')
    const starbasePercentageNumber = new BN(10)

    const softCap = new BN(200000) // 200 000
    const crowdsaleCap = new BN(20000000) // 20M
    const isWeiAccepted = true
    const isMinting = true

    let startTime, endTime, wallet, targetRates, targetRatesTimestamps
    let crowdsale, token, star, whitelist
    let crowdsaleTokensLeftover, starEthRateContract

    const newCrowdsale = async ({
      rates = [new BN(50)],
      ratesTimestamps = [],
      softCap = new BN(200000),
      crowdsaleCap = new BN(20000000),
      isMinting = true,
      isWeiAccepted = true,
      isTransferringOwnership = true,
      starEthRate = new BN(2),
      starEthRateDecimalCorrectionFactor = new BN(10),
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
      crowdsale = await TokenSale.new()

      startTime =
        ratesTimestamps[0] || (await latestTime()).add(duration.seconds(15)) // crowdsale starts in 15 seconds into the future
      endTime = startTime.add(duration.days(70)) // 70 days

      targetRates = rates
      targetRatesTimestamps =
        ratesTimestamps.length > 0 ? ratesTimestamps : [startTime]

      await crowdsale.init(
        startTime,
        endTime,
        [
          whitelist.address,
          star.address,
          token.address,
          isMinting ? await token.owner() : constants.ZERO_ADDRESS,
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

      if (isMinting && isTransferringOwnership) {
        await token.transferOwnership(crowdsale.address)
      } else {
        await token.mint(
          crowdsale.address,
          crowdsaleCap.mul(ether('1')).mul(new BN(2))
        )
        await token.unpause()
      }
    }

    const itTransfersEthCorrectly = () => {
      it('transfers ETH correctly to client and starbase', async () => {
        const clientBalanceBefore = await balance.current(client)
        const starbaseBalanceBefore = await balance.current(starbase)
        const value = ether('0.01')

        await increaseTimeTo((await latestTime()).add(duration.days(34)))
        await crowdsale.buyTokens(user1, {
          from: user1,
          value,
        })

        const clientBalanceAfter = await balance.current(client)
        const starbaseBalanceAfter = await balance.current(starbase)

        const clientBalanceDifference = clientBalanceAfter.sub(
          clientBalanceBefore
        )
        const starbaseBalanceDifference = starbaseBalanceAfter.sub(
          starbaseBalanceBefore
        )

        expect(starbaseBalanceDifference).to.be.bignumber.equal(
          value.mul(starbasePercentageNumber).div(new BN(100))
        )
        expect(clientBalanceDifference).to.be.bignumber.equal(
          value.mul(new BN(100).sub(starbasePercentageNumber)).div(new BN(100))
        )
      })
    }

    const itSellsTokensUpToCrowdsaleCapInWeiWithRefund = () => {
      it('sells tokens up to crowdsale cap when buying with wei and sends remaining wei back to the buyer', async () => {
        await increaseTimeTo((await latestTime()).add(duration.days(52)))

        const buyerWeiBalanceBeforePurchase = await balance.current(buyer)

        await crowdsale.buyTokens(buyer, {
          from: buyer,
          value: value.mul(new BN(3)),
        })
        const buyerBalance = await token.balanceOf(buyer)
        expect(buyerBalance).to.be.bignumber.equal(crowdsaleCap.mul(ether('1')))

        const buyerWeiBalanceAfterPurchase = await balance.current(buyer)

        expect(buyerWeiBalanceAfterPurchase).to.be.bignumber.closeTo(
          buyerWeiBalanceBeforePurchase.sub(ether('1')),
          ether('0.1')
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
        await star.mint(buyer, ether('10'))
        await star.approve(crowdsale.address, ether('100000000'), {
          from: buyer,
        })

        await increaseTimeTo((await latestTime()).add(duration.days(34)))

        await crowdsale.buyTokens(buyer, { from: buyer })

        const hasEnded = await crowdsale.hasEnded()
        hasEnded.should.be.true
      })
    }

    const endsCrowdsaleWhenAllTokensAreSoldWithWei = () => {
      it('ends crowdsale when all tokens are sold with wei', async () => {
        await increaseTimeTo((await latestTime()).add(duration.days(54)))
        await crowdsale.buyTokens(buyer, { from: buyer, value })

        const hasEnded = await crowdsale.hasEnded()
        hasEnded.should.be.true
      })
    }

    beforeEach('initialize contract', async () => {
      await newCrowdsale()
    })

    it('deployment fails when rate is zero', async () => {
      const expectedError = 'All target rates must be above 0!'

      try {
        await newCrowdsale({ rates: [0] })
        assert.fail()
      } catch (error) {
        ensuresException(error, expectedError)
      }
    })

    it('deployment fails when rates and timestamps not match', async () => {
      const expectedError =
        'Target rates and target rates timestamps lengths should match!'

      try {
        const ratesTimestamps = [
          (await latestTime()).add(duration.seconds(15)),
          (await latestTime()).add(duration.days(15)),
        ]
        const rates = [new BN(12), new BN(15), new BN(15)]
        await newCrowdsale({ rates, ratesTimestamps })
        assert.fail()
      } catch (error) {
        ensuresException(error, expectedError)
      }
    })

    it('deployment fails when timestamps are not ordered', async () => {
      const expectedError =
        'Target rates timestamps should be sorted from low to high!'

      try {
        const ratesTimestamps = [
          (await latestTime()).add(duration.seconds(15)),
          (await latestTime()).add(duration.days(30)),
          (await latestTime()).add(duration.days(15)),
        ]
        const rates = [new BN(12), new BN(15), new BN(15)]
        await newCrowdsale({ rates, ratesTimestamps })
        assert.fail()
      } catch (error) {
        ensuresException(error, expectedError)
      }
    })

    it('deployment fails when rate is 0 and isWeiAccepted is true', async () => {
      const expectedError = 'All target rates must be above 0!'

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
      expect(await crowdsale.softCap()).to.be.bignumber.equal(
        softCap.mul(ether('1'))
      )
    })

    it('has a whitelist contract', async () => {
      const whitelistContract = await crowdsale.getWhitelistAddress()
      whitelistContract.should.equal(whitelist.address)
    })

    it('has a token contract', async () => {
      const tokenContract = await crowdsale.getTokenOnSaleAddress()
      tokenContract.should.equal(token.address)
    })

    it('has a star contract', async () => {
      const starContract = await crowdsale.getStarTokenAddress()
      starContract.should.equal(star.address)
    })

    it('has a wallet', async () => {
      const walletAddress = await crowdsale.getWalletAddress()
      walletAddress.should.equal(wallet)
    })

    it('owner is the tx originator and NOT the tokenSaleCloneFactory', async () => {
      const contractOwner = await crowdsale.owner()
      contractOwner.should.equal(owner)
    })

    it('has a softCap variable', async () => {
      const softCapFigure = await crowdsale.softCap()

      expect(softCapFigure).to.be.bignumber.equal(softCap.mul(ether('1')))
    })

    it('has a crowdsaleCap variable', async () => {
      const crowdsaleCapFigure = await crowdsale.crowdsaleCap()

      expect(crowdsaleCapFigure).to.be.bignumber.equal(
        crowdsaleCap.mul(ether('1'))
      )
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
        (await latestTime()).add(duration.seconds(15)),
        (await latestTime()).add(duration.days(15)),
      ]
      const targetRates = [new BN(12), new BN(15)]
      await newCrowdsale({ rates: targetRates, ratesTimestamps })

      const targetRate0 = await crowdsale.targetRates(0)
      const targetRate1 = await crowdsale.targetRates(1)

      expect(targetRate0).to.be.bignumber.equal(targetRates[0])
      expect(targetRate1).to.be.bignumber.equal(targetRates[1])

      try {
        await crowdsale.targetRates(2)
        assert.fail()
      } catch (error) {
        ensuresException(error)
      }
    })

    it('stores all target rates timestamps', async () => {
      const ratesTimestamps = [
        (await latestTime()).add(duration.seconds(15)),
        (await latestTime()).add(duration.days(15)),
      ]
      const targetRates = [new BN(12), new BN(15)]
      await newCrowdsale({ rates: targetRates, ratesTimestamps })

      const targetRatesTimestamps0 = await crowdsale.targetRatesTimestamps(0)
      const targetRatesTimestamps1 = await crowdsale.targetRatesTimestamps(1)

      expect(targetRatesTimestamps0).to.be.bignumber.equal(ratesTimestamps[0])
      expect(targetRatesTimestamps1).to.be.bignumber.equal(ratesTimestamps[1])

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
          (await latestTime()).add(new BN(2)),
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
          [new BN(5)],
          [new BN(50)]
        )
        assert.fail()
      } catch (error) {
        const expectedError = 'Contract instance was initialized already!'
        ensuresException(error, expectedError)
      }

      const crowdsaleWallet = await crowdsale.getWalletAddress()
      // fakeWallet did not override wallet
      expect(crowdsaleWallet).to.be.equal(wallet)
    })

    describe('whitelist', () => {
      it('only allows owner to add to the whitelist', async () => {
        await increaseTimeTo((await latestTime()).add(duration.days(1)))

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
        await increaseTimeTo((await latestTime()).add(duration.days(1)))
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
        await increaseTimeTo((await latestTime()).add(duration.days(1)))
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
        await increaseTimeTo((await latestTime()).add(duration.days(1)))
        const { logs } = await whitelist.addManyToWhitelist([buyer, buyer2], {
          from: owner,
        })

        const event = logs.find(e => e.event === 'WhitelistUpdated')
        expect(event).to.exist
      })

      it('has WhitelistUpdated event upon removal', async () => {
        await whitelist.addToWhitelist(buyer, { from: owner })

        let tx = await whitelist.removeManyFromWhitelist([buyer], {
          from: owner,
        })
        let entry = tx.logs.find(entry => entry.event === 'WhitelistUpdated')

        expect(entry).to.exist
        expect(entry.args.operation).to.be.equal('Removed')
        expect(entry.args.member).to.be.equal(buyer)
      })
    })

    describe('When using rate definitions', async () => {
      beforeEach(async () => {
        const ratesTimestamps = [
          (await latestTime()).add(duration.days(2)),
          (await latestTime()).add(duration.days(15)),
          (await latestTime()).add(duration.days(18)),
        ]
        const rates = [new BN(12), new BN(14), new BN(27)]
        await newCrowdsale({ rates, ratesTimestamps })
      })

      describe('when readling the latest rate via getCurrentRate()', async () => {
        it('receives the current rate based on the latest valid targetTimeStamp', async () => {
          let currentTargetRateIndex = await crowdsale.currentTargetRateIndex()
          let currentRate = await crowdsale.getCurrentRate()
          expect(currentTargetRateIndex).to.be.bignumber.equal(new BN(0))
          expect(currentRate[0]).to.be.bignumber.equal(targetRates[0])

          await increaseTimeTo(
            targetRatesTimestamps[0].add(duration.seconds(20))
          )
          currentRate = await crowdsale.getCurrentRate()
          currentTargetRateIndex = await crowdsale.currentTargetRateIndex()
          expect(currentTargetRateIndex).to.be.bignumber.equal(new BN(0))
          expect(currentRate[0]).to.be.bignumber.equal(targetRates[0])
          expect(currentRate[1]).to.be.bignumber.equal(new BN(0))

          await increaseTimeTo(
            targetRatesTimestamps[1].add(duration.seconds(20))
          )
          currentRate = await crowdsale.getCurrentRate()
          currentTargetRateIndex = await crowdsale.currentTargetRateIndex()
          expect(currentTargetRateIndex).to.be.bignumber.equal(new BN(0))
          expect(currentRate[0]).to.be.bignumber.equal(targetRates[1])
          expect(currentRate[1]).to.be.bignumber.equal(new BN(1))

          await increaseTimeTo(
            targetRatesTimestamps[2].add(duration.seconds(20))
          )
          currentRate = await crowdsale.getCurrentRate()
          currentTargetRateIndex = await crowdsale.currentTargetRateIndex()
          expect(currentTargetRateIndex).to.be.bignumber.equal(new BN(0))
          expect(currentRate[0]).to.be.bignumber.equal(targetRates[2])
          expect(currentRate[1]).to.be.bignumber.equal(new BN(2))

          await crowdsale.checkForNewRateAndUpdate()
          currentRate = await crowdsale.getCurrentRate()
          currentTargetRateIndex = await crowdsale.currentTargetRateIndex()
          expect(currentTargetRateIndex).to.be.bignumber.equal(new BN(2))
          expect(currentRate[0]).to.be.bignumber.equal(targetRates[2])
          expect(currentRate[1]).to.be.bignumber.equal(new BN(2))
        })
      })

      describe('when updating currentTargetRateIndex via checkForNewRateAndUpdate()', async () => {
        it('updates currentTargetRateIndex only if there is a newer valid timestamp', async () => {
          let currentTargetRateIndex = await crowdsale.currentTargetRateIndex()
          expect(currentTargetRateIndex).to.be.bignumber.equal(new BN(0))

          await increaseTimeTo(
            targetRatesTimestamps[0].add(duration.seconds(20))
          )
          await crowdsale.checkForNewRateAndUpdate()
          currentTargetRateIndex = await crowdsale.currentTargetRateIndex()
          expect(currentTargetRateIndex).to.be.bignumber.equal(new BN(0))

          await increaseTimeTo(targetRatesTimestamps[1] - duration.seconds(20))
          await crowdsale.checkForNewRateAndUpdate()
          currentTargetRateIndex = await crowdsale.currentTargetRateIndex()
          expect(currentTargetRateIndex).to.be.bignumber.equal(new BN(0))

          await increaseTimeTo(
            targetRatesTimestamps[1].add(duration.seconds(20))
          )
          await crowdsale.checkForNewRateAndUpdate()
          currentTargetRateIndex = await crowdsale.currentTargetRateIndex()
          expect(currentTargetRateIndex).to.be.bignumber.equal(new BN(1))

          await increaseTimeTo(targetRatesTimestamps[2] - duration.seconds(20))
          await crowdsale.checkForNewRateAndUpdate()
          currentTargetRateIndex = await crowdsale.currentTargetRateIndex()
          expect(currentTargetRateIndex).to.be.bignumber.equal(new BN(1))

          await increaseTimeTo(
            targetRatesTimestamps[2].add(duration.seconds(20))
          )
          await crowdsale.checkForNewRateAndUpdate()
          currentTargetRateIndex = await crowdsale.currentTargetRateIndex()
          expect(currentTargetRateIndex).to.be.bignumber.equal(new BN(2))
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
          crowdsaleTokensLeftover = new BN(10)

          await newCrowdsale({
            rates: [crowdsaleCap.sub(crowdsaleTokensLeftover).mul(new BN(5))],
            isMinting,
          })
          await whitelist.addManyToWhitelist([buyer])
          await star.mint(buyer, ether('1'))

          await increaseTimeTo((await latestTime()).add(duration.days(52)))

          await star.approve(crowdsale.address, ether('1'), { from: buyer })
          await crowdsale.buyTokens(buyer, { from: buyer })

          await increaseTimeTo((await latestTime()).add(duration.days(30)))

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

          let remainingTokens = new BN(crowdsaleTokensLeftover.mul(ether('1')))
          if (!isMinting)
            remainingTokens = remainingTokens.add(crowdsaleCap.mul(ether('1')))

          expect(walletTokenBalance).to.be.bignumber.equal(remainingTokens)
        })
      })

      describe('token purchases', () => {
        beforeEach('initialize contract', async () => {
          await whitelist.addManyToWhitelist([buyer, buyer2])

          await star.mint(buyer, ether('10'))
          await star.mint(user1, ether('10'))
        })

        if (isMinting) {
          it('does NOT allow purchase when token ownership does not currently belong to crowdsale contract', async () => {
            await newCrowdsale({
              rate,
              isMinting,
              isTransferringOwnership: false,
            })
            await whitelist.addManyToWhitelist([buyer, user1])

            await star.mint(buyer, ether('100000000'))
            await star.mint(user1, ether('100000000'))

            await star.approve(crowdsale.address, ether('5'), { from: user1 })
            await star.approve(crowdsale.address, ether('5'), { from: buyer })

            await increaseTimeTo((await latestTime()).add(duration.days(52)))

            try {
              await crowdsale.buyTokens(buyer, {
                from: buyer,
              })
              assert.fail()
            } catch (e) {
              ensuresException(e)
            }

            const buyerBalance = await token.balanceOf(buyer)
            expect(buyerBalance).to.be.bignumber.equal(new BN(0))

            await token.transferOwnership(crowdsale.address)

            await crowdsale.buyTokens(user1, {
              from: user1,
            })

            const userBalance = await token.balanceOf(user1)
            expect(userBalance).to.be.bignumber.equal(ether('50'))
          })
        }

        it('cannot buy with empty beneficiary address', async () => {
          await increaseTimeTo((await latestTime()).add(duration.days(52)))

          await star.approve(crowdsale.address, ether('5'), { from: buyer })

          try {
            await crowdsale.buyTokens(constants.ZERO_ADDRESS, { from: buyer })
            assert.fail()
          } catch (e) {
            ensuresException(e)
          }

          const buyerBalance = await token.balanceOf(buyer)
          expect(buyerBalance).to.be.bignumber.equal(new BN(0))
        })

        it('allows ONLY whitelisted addresses to purchase tokens', async () => {
          await increaseTimeTo((await latestTime()).add(duration.days(52)))

          await star.approve(crowdsale.address, ether('5'), { from: buyer })
          // user1 is not whitelisted
          await star.approve(crowdsale.address, ether('5'), { from: user1 })

          try {
            await crowdsale.buyTokens(user1, { from: user1 })
            assert.fail()
          } catch (e) {
            ensuresException(e)
          }

          const userBalance = await token.balanceOf(user1)
          expect(userBalance).to.be.bignumber.equal(new BN(0))

          // purchase occurrence
          await crowdsale.buyTokens(buyer, { from: buyer })

          const buyerBalance = await token.balanceOf(buyer)
          expect(buyerBalance).to.be.bignumber.equal(ether('50'))
        })

        it('allows ONLY STAR tokens to purchase tokens at first', async () => {
          await newCrowdsale({ rate, isWeiAccepted: false })
          await whitelist.addManyToWhitelist([buyer])

          await increaseTimeTo((await latestTime()).add(duration.days(22)))

          await star.mint(buyer, ether('5'))
          await star.approve(crowdsale.address, ether('5'), { from: buyer })

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
          expect(buyerBalance).to.be.bignumber.equal(ether('50'))
        })

        it('cannot buy tokens by sending star transaction to contract', async () => {
          await increaseTimeTo((await latestTime()).add(duration.days(52)))

          await whitelist.addManyToWhitelist([user1])
          await star.approve(crowdsale.address, ether('5'), { from: user1 })

          try {
            await crowdsale.sendTransaction({ from: user1 })
            assert.fail()
          } catch (e) {
            ensuresException(e)
          }

          const buyerBalance = await token.balanceOf(buyer)
          expect(buyerBalance).to.be.bignumber.equal(new BN(0))
        })

        it('cannot buy tokens by sending wei when isWeiAccepted is disabled', async () => {
          await newCrowdsale({ isWeiAccepted: false })
          await increaseTimeTo((await latestTime()).add(duration.days(22)))
          await whitelist.addManyToWhitelist([user1])

          try {
            await crowdsale.buyTokens(user1, { from: user1, value })
            assert.fail()
          } catch (e) {
            ensuresException(e)
          }

          const userBalance = await token.balanceOf(user1)
          expect(userBalance).to.be.bignumber.equal(new BN(0))

          // purchase occurence
          await newCrowdsale({ rate, isWeiAccepted: true })
          await whitelist.addManyToWhitelist([user1])
          await increaseTimeTo((await latestTime()).add(duration.days(22)))
          await crowdsale.buyTokens(user1, { from: user1, value })

          const buyerBalance = await token.balanceOf(user1)
          expect(buyerBalance).to.be.bignumber.equal(ether('50'))
        })

        it('buys tokens by sending wei when it is enabled', async () => {
          await increaseTimeTo((await latestTime()).add(duration.days(52)))
          await whitelist.addManyToWhitelist([user1])

          await crowdsale.buyTokens(user1, { from: user1, value })

          const userBalance = await token.balanceOf(user1)
          expect(userBalance).to.be.bignumber.equal(ether('50'))

          await crowdsale.buyTokens(user1, { from: user1, value })

          const buyerBalance = await token.balanceOf(user1)
          expect(buyerBalance).to.be.bignumber.equal(ether('100'))
        })

        it('updates wei raised', async () => {
          await increaseTimeTo((await latestTime()).add(duration.days(52)))
          await whitelist.addManyToWhitelist([user1])

          await crowdsale.buyTokens(user1, { from: user1, value })

          let weiRaised = await crowdsale.weiRaised()
          expect(weiRaised).to.be.bignumber.equal(ether('1'))

          await crowdsale.buyTokens(user1, { from: user1, value })

          weiRaised = await crowdsale.weiRaised()
          expect(weiRaised).to.be.bignumber.equal(ether('2'))
        })

        it('does NOT buy tokens when crowdsale is paused', async () => {
          await increaseTimeTo((await latestTime()).add(duration.days(52)))

          await star.approve(crowdsale.address, ether('5'), { from: buyer })

          await crowdsale.pause()
          let buyerBalance

          try {
            await crowdsale.buyTokens(buyer, { from: buyer })
            assert.fail()
          } catch (e) {
            ensuresException(e)
          }

          buyerBalance = await token.balanceOf(buyer)
          expect(buyerBalance).to.be.bignumber.equal(new BN(0))

          await crowdsale.unpause()
          await crowdsale.buyTokens(buyer, { from: buyer })

          buyerBalance = await token.balanceOf(buyer)
          expect(buyerBalance).to.be.bignumber.equal(ether('50'))
        })

        it('updates STAR raised', async () => {
          await increaseTimeTo((await latestTime()).add(duration.days(52)))

          await star.approve(crowdsale.address, ether('8'), { from: buyer })

          // purchase occurence
          await crowdsale.buyTokens(buyer, { from: owner })

          const buyerBalance = await token.balanceOf(buyer)
          expect(buyerBalance).to.be.bignumber.equal(ether('80'))

          const starRaised = await crowdsale.starRaised()
          expect(starRaised).to.be.bignumber.equal(ether('8'))
        })

        describe('with multiple target rate definitions', async () => {
          beforeEach(async () => {
            const ratesTimestamps = [
              (await latestTime()).add(duration.days(2)),
              (await latestTime()).add(duration.days(15)),
              (await latestTime()).add(duration.days(18)),
            ]
            const rates = [new BN(50), new BN(100), new BN(200)]
            await newCrowdsale({ rates, ratesTimestamps })
            await star.mint(user1, ether('30'))
          })

          it('uses latest targetRates for purchases with Wei', async () => {
            await increaseTimeTo((await latestTime()).add(duration.days(4)))
            await whitelist.addManyToWhitelist([user1])

            await crowdsale.buyTokens(user1, { from: user1, value })

            let userBalance = await token.balanceOf(user1)
            expect(userBalance).to.be.bignumber.equal(ether('50'))

            await increaseTimeTo((await latestTime()).add(duration.days(12)))
            await crowdsale.buyTokens(user1, { from: user1, value })

            buyerBalance = await token.balanceOf(user1)
            expect(buyerBalance).to.be.bignumber.equal(ether('150'))

            await increaseTimeTo((await latestTime()).add(duration.days(5)))
            await crowdsale.buyTokens(user1, { from: user1, value })

            buyerBalance = await token.balanceOf(user1)
            expect(buyerBalance).to.be.bignumber.equal(ether('350'))
          })

          it('uses latest targetRates for purchases with STAR', async () => {
            await increaseTimeTo((await latestTime()).add(duration.days(4)))
            await whitelist.addManyToWhitelist([user1])

            await star.approve(crowdsale.address, ether('5'), { from: user1 })
            await crowdsale.buyTokens(user1, { from: user1 })

            let userBalance = await token.balanceOf(user1)
            expect(userBalance).to.be.bignumber.equal(ether('50'))

            await increaseTimeTo((await latestTime()).add(duration.days(12)))
            await star.approve(crowdsale.address, ether('5'), { from: user1 })
            await crowdsale.buyTokens(user1, { from: user1 })

            buyerBalance = await token.balanceOf(user1)
            expect(buyerBalance).to.be.bignumber.equal(ether('150'))

            await increaseTimeTo((await latestTime()).add(duration.days(5)))
            await star.approve(crowdsale.address, ether('5'), { from: user1 })
            await crowdsale.buyTokens(user1, { from: user1 })

            buyerBalance = await token.balanceOf(user1)
            expect(buyerBalance).to.be.bignumber.equal(ether('350'))
          })

          it('updates currentTargetRateIndex after purchase', async () => {
            await increaseTimeTo((await latestTime()).add(duration.days(4)))
            await whitelist.addManyToWhitelist([user1])

            let currentTargetRateIndex = await crowdsale.currentTargetRateIndex()
            expect(currentTargetRateIndex).to.be.bignumber.equal(new BN(0))

            await increaseTimeTo((await latestTime()).add(duration.days(12)))
            await crowdsale.buyTokens(user1, { from: user1, value })

            currentTargetRateIndex = await crowdsale.currentTargetRateIndex()
            expect(currentTargetRateIndex).to.be.bignumber.equal(new BN(1))

            await increaseTimeTo((await latestTime()).add(duration.days(5)))
            await crowdsale.buyTokens(user1, { from: user1, value })

            currentTargetRateIndex = await crowdsale.currentTargetRateIndex()
            expect(currentTargetRateIndex).to.be.bignumber.equal(new BN(2))
          })
        })

        describe('when purchasing given different STAR/ETH rates', async () => {
          describe('with STAR/ETH rate of 10 STAR = 1 ETH', async () => {
            const starEthRate = new BN(1)
            const starEthRateDecimalCorrectionFactor = new BN(10)

            beforeEach(async () => {
              await newCrowdsale({
                starEthRate,
                starEthRateDecimalCorrectionFactor,
              })
              await star.mint(user1, ether('30'))
              await increaseTimeTo((await latestTime()).add(duration.days(20)))
              await whitelist.addManyToWhitelist([user1])
            })

            it('gives 10 times as many tokens for purchasing with ETH', async () => {
              await crowdsale.buyTokens(user1, {
                from: user1,
                value: ether('1'),
              })

              let buyerBalance = await token.balanceOf(user1)
              expect(buyerBalance).to.be.bignumber.equal(ether('50'))

              await star.approve(crowdsale.address, ether('1'), { from: user1 })
              await crowdsale.buyTokens(user1, { from: user1 })

              buyerBalance = await token.balanceOf(user1)
              expect(buyerBalance).to.be.bignumber.equal(ether('55'))
            })
          })

          describe('with STAR/ETH rate of 3,000,000 STAR = 50 ETH', async () => {
            const starEthRate = new BN(50)
            const starEthRateDecimalCorrectionFactor = new BN(3000000)

            beforeEach(async () => {
              await newCrowdsale({
                starEthRate,
                starEthRateDecimalCorrectionFactor,
              })
              await star.mint(user1, ether('30'))
              await increaseTimeTo((await latestTime()).add(duration.days(20)))
              await whitelist.addManyToWhitelist([user1])
            })

            it('gives 60,000 times as many tokens for purchasing with ETH', async () => {
              await crowdsale.buyTokens(user1, {
                from: user1,
                value: ether('1.2'),
              })

              let buyerBalance = await token.balanceOf(user1)
              expect(buyerBalance).to.be.bignumber.equal(ether('60'))

              await star.approve(crowdsale.address, ether('1.2'), {
                from: user1,
              })
              await crowdsale.buyTokens(user1, { from: user1 })

              buyerBalance = await token.balanceOf(user1)
              expect(buyerBalance).to.be.bignumber.equal(
                ether('60').add(ether('0.001'))
              )
            })
          })

          describe('with STAR/ETH rate of 1 STAR = 1 ETH', async () => {
            const starEthRate = new BN(100)
            const starEthRateDecimalCorrectionFactor = new BN(100)

            beforeEach(async () => {
              await newCrowdsale({
                starEthRate,
                starEthRateDecimalCorrectionFactor,
              })
              await star.mint(user1, ether('30'))
              await increaseTimeTo((await latestTime()).add(duration.days(20)))
              await whitelist.addManyToWhitelist([user1])
            })

            it('gives the same amount of tokens as with ETH', async () => {
              await crowdsale.buyTokens(user1, {
                from: user1,
                value: ether('1'),
              })

              let buyerBalance = await token.balanceOf(user1)
              expect(buyerBalance).to.be.bignumber.equal(ether('50'))

              await star.approve(crowdsale.address, ether('1'), { from: user1 })
              await crowdsale.buyTokens(user1, { from: user1 })

              buyerBalance = await token.balanceOf(user1)
              expect(buyerBalance).to.be.bignumber.equal(
                ether('50').add(ether('50'))
              )
            })
          })

          describe('when STAR is worth less than 1 project token', async () => {
            const starEthRate = new BN(1)
            const starEthRateDecimalCorrectionFactor = new BN(10000)

            beforeEach(async () => {
              await newCrowdsale({
                starEthRate,
                starEthRateDecimalCorrectionFactor,
                rates: [new BN(10)],
              })
              await star.mint(user1, ether('30'))
              await increaseTimeTo((await latestTime()).add(duration.days(20)))
              await whitelist.addManyToWhitelist([user1])
            })

            it('gives less tokens than STAR used for purchase', async () => {
              await star.approve(crowdsale.address, ether('1'), { from: user1 })
              await crowdsale.buyTokens(user1, { from: user1 })

              const buyerBalance = await token.balanceOf(user1)
              expect(buyerBalance).to.be.bignumber.equal(ether('0.001'))
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
              const clientBalanceBefore = await balance.current(client)
              const starbaseBalanceBefore = await balance.current(starbase)

              await increaseTimeTo((await latestTime()).add(duration.days(52)))
              await whitelist.addManyToWhitelist([user1])
              await crowdsale.buyTokens(user1, {
                from: user1,
                value: ether('0.003'),
              })

              const clientBalanceAfter = await balance.current(client)
              const starbaseBalanceAfter = await balance.current(starbase)
              const tokenSaleBalance = await balance.current(crowdsale.address)

              expect(clientBalanceAfter).to.be.bignumber.equal(
                clientBalanceBefore
              )
              expect(starbaseBalanceAfter).to.be.bignumber.equal(
                starbaseBalanceBefore
              )
              expect(tokenSaleBalance).to.be.bignumber.equal(ether('0.003'))
            })

            it('does NOT transfer STAR funds between client and starbase', async () => {
              await star.mint(buyer, ether('0.003'))
              await star.approve(crowdsale.address, ether('0.003'), {
                from: buyer,
              })

              await increaseTimeTo((await latestTime()).add(duration.days(34)))

              const clientBalanceBefore = await star.balanceOf(client)
              const starbaseBalanceBefore = await star.balanceOf(starbase)

              await crowdsale.buyTokens(buyer, { from: buyer })

              const clientBalanceAfter = await star.balanceOf(client)
              const starbaseBalanceAfter = await star.balanceOf(starbase)
              const tokenSaleBalance = await star.balanceOf(crowdsale.address)

              expect(clientBalanceAfter).to.be.bignumber.equal(
                clientBalanceBefore
              )
              expect(starbaseBalanceAfter).to.be.bignumber.equal(
                starbaseBalanceBefore
              )
              expect(tokenSaleBalance).to.be.bignumber.equal(ether('0.003'))
            })

            describe('using ETH', async () => {
              const ethValue = new BN(10000)

              beforeEach(async () => {
                await whitelist.addManyToWhitelist([buyer])
                await increaseTimeTo((await latestTime()).add(duration.days(1)))
                const scBalanceBeforeBuying = await balance.current(
                  crowdsale.address
                )
                await crowdsale.buyTokens(buyer, {
                  from: buyer,
                  value: ethValue,
                })
                const scBalanceAfterBuying = await balance.current(
                  crowdsale.address
                )
                await increaseTimeTo(
                  (await latestTime()).add(duration.days(80))
                )

                expect(scBalanceAfterBuying).to.be.bignumber.equal(
                  scBalanceBeforeBuying.add(ethValue)
                )
              })

              it('allows users to withdraw invested ETH when sale failed', async () => {
                const scBalanceAfterBeforeWithdraw = await balance.current(
                  crowdsale.address
                )
                const userEthBalanceBeforeWithdraw = await balance.current(
                  buyer
                )
                const receipt = await crowdsale.withdrawUserFunds({
                  from: buyer,
                })
                const userEthBalanceAfterWithdraw = await balance.current(buyer)
                const scBalanceAfterWithdraw = await balance.current(
                  crowdsale.address
                )

                expect(scBalanceAfterWithdraw).to.be.bignumber.equal(
                  scBalanceAfterBeforeWithdraw.sub(ethValue)
                )

                const tx = await web3.eth.getTransaction(receipt.tx)
                const gasUsed = new BN(receipt.receipt.gasUsed)
                const gasPrice = new BN(tx.gasPrice)
                const gasCosts = gasUsed.mul(gasPrice)

                const expectedUserBalanceAfterWithdraw = userEthBalanceBeforeWithdraw
                  .add(ethValue)
                  .sub(gasCosts)

                expect(userEthBalanceAfterWithdraw).to.be.bignumber.equal(
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

                expect(ethUserInvestmentBefore).to.be.bignumber.equal(ethValue)
                expect(ethUserInvestmentAfter).to.be.bignumber.equal(new BN(0))
              })
            })

            describe('using STAR', async () => {
              const starInvestValue = ether('0.003')

              beforeEach(async () => {
                await star.mint(buyer, starInvestValue.add(new BN(100)))
                await star.approve(crowdsale.address, starInvestValue, {
                  from: buyer,
                })

                const scBalanceBeforeBuying = await star.balanceOf(
                  crowdsale.address
                )

                await increaseTimeTo(
                  (await latestTime()).add(duration.days(34))
                )
                await crowdsale.buyTokens(buyer, { from: buyer })
                await increaseTimeTo(
                  (await latestTime()).add(duration.days(80))
                )

                const scBalanceAfterBuying = await star.balanceOf(
                  crowdsale.address
                )
                expect(scBalanceAfterBuying).to.be.bignumber.equal(
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
                expect(scBalanceAfterWithdraw).to.be.bignumber.equal(
                  scBalanceBefore.sub(starInvestValue)
                )

                expect(starUserInvestment).to.be.bignumber.equal(
                  starInvestValue
                )
                expect(userStarBalanceAfterWithdraw).to.be.bignumber.equal(
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

                expect(starUserInvestmentBefore).to.be.bignumber.equal(
                  starInvestValue
                )
                expect(starUserInvestmentAfter).to.be.bignumber.equal(new BN(0))
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
              await star.mint(buyer, ether('1'))
              await star.approve(crowdsale.address, ether('1'), {
                from: buyer,
              })

              await increaseTimeTo((await latestTime()).add(duration.days(34)))

              const clientBalanceBefore = await star.balanceOf(client)
              const starbaseBalanceBefore = await star.balanceOf(starbase)

              await crowdsale.buyTokens(buyer, { from: buyer })

              const clientBalanceAfter = await star.balanceOf(client)
              const starbaseBalanceAfter = await star.balanceOf(starbase)

              const clientBalanceDifference = clientBalanceAfter.sub(
                clientBalanceBefore
              )
              const starbaseBalanceDifference = starbaseBalanceAfter.sub(
                starbaseBalanceBefore
              )

              expect(starbaseBalanceDifference).to.be.bignumber.equal(
                ether('0.1')
              )
              expect(clientBalanceDifference).to.be.bignumber.equal(
                ether('0.9')
              )
            })

            it('transfers STAR funds between client and starbase once softCap is reached', async () => {
              await star.mint(buyer, ether('10.004'))
              await star.approve(crowdsale.address, ether('0.003'), {
                from: buyer,
              })

              await increaseTimeTo((await latestTime()).add(duration.days(34)))

              const clientBalanceBefore = await star.balanceOf(client)
              const starbaseBalanceBefore = await star.balanceOf(starbase)

              await crowdsale.buyTokens(buyer, { from: buyer })

              let clientBalanceAfter = await star.balanceOf(client)
              let starbaseBalanceAfter = await star.balanceOf(starbase)
              let tokenSaleBalance = await star.balanceOf(crowdsale.address)

              expect(clientBalanceAfter).to.be.bignumber.equal(
                clientBalanceBefore
              )
              expect(starbaseBalanceAfter).to.be.bignumber.equal(
                starbaseBalanceBefore
              )
              expect(tokenSaleBalance).to.be.bignumber.equal(ether('0.003'))

              // still has not reached cap
              await star.approve(crowdsale.address, ether('0.001'), {
                from: buyer,
              })
              await crowdsale.buyTokens(buyer, { from: buyer })

              clientBalanceAfter = await star.balanceOf(client)
              starbaseBalanceAfter = await star.balanceOf(starbase)
              tokenSaleBalance = await star.balanceOf(crowdsale.address)

              expect(clientBalanceAfter).to.be.bignumber.equal(
                clientBalanceBefore
              )
              expect(starbaseBalanceAfter).to.be.bignumber.equal(
                starbaseBalanceBefore
              )
              expect(tokenSaleBalance).to.be.bignumber.equal(ether('0.004'))

              // reaches soft cap and goes over crowdsale cap
              await star.approve(crowdsale.address, ether('1'), {
                from: buyer,
              })
              await crowdsale.buyTokens(buyer, { from: buyer })

              tokenSaleBalance = await star.balanceOf(crowdsale.address)
              expect(tokenSaleBalance).to.be.bignumber.equal(new BN(0))
            })

            itTransfersEthCorrectly()

            it('transfers ETH funds in contract between client and starbase once softCap is reached', async () => {
              const clientBalanceBefore = await balance.current(client)
              const starbaseBalanceBefore = await balance.current(starbase)

              await increaseTimeTo((await latestTime()).add(duration.days(52)))
              await whitelist.addManyToWhitelist([user1])
              await crowdsale.buyTokens(user1, {
                from: user1,
                value: ether('0.003'),
              })

              let clientBalanceAfter = await balance.current(client)
              let starbaseBalanceAfter = await balance.current(starbase)
              let tokenSaleBalance = await balance.current(crowdsale.address)

              expect(clientBalanceAfter).to.be.bignumber.equal(
                clientBalanceBefore
              )
              expect(starbaseBalanceAfter).to.be.bignumber.equal(
                starbaseBalanceBefore
              )
              expect(tokenSaleBalance).to.be.bignumber.equal(ether('0.003'))

              // still has not reached soft cap
              await crowdsale.buyTokens(user1, {
                from: user1,
                value: ether('0.001'),
              })

              clientBalanceAfter = await balance.current(client)
              starbaseBalanceAfter = await balance.current(starbase)
              tokenSaleBalance = await balance.current(crowdsale.address)

              expect(clientBalanceAfter).to.be.bignumber.equal(
                clientBalanceBefore
              )
              expect(starbaseBalanceAfter).to.be.bignumber.equal(
                starbaseBalanceBefore
              )
              expect(tokenSaleBalance).to.be.bignumber.equal(ether('0.004'))

              // goes over soft cap and crowdsale cap
              await crowdsale.buyTokens(user1, {
                from: user1,
                value: ether('1'),
              })

              clientBalanceAfter = await balance.current(client)
              starbaseBalanceAfter = await balance.current(starbase)
              tokenSaleBalance = await balance.current(crowdsale.address)

              const clientBalanceDifference = clientBalanceAfter.sub(
                clientBalanceBefore
              )
              const starbaseBalanceDifference = starbaseBalanceAfter.sub(
                starbaseBalanceBefore
              )

              expect(starbaseBalanceDifference).to.be.bignumber.equal(
                ether('0.1')
              )
              expect(clientBalanceDifference).to.be.bignumber.equal(
                ether('0.9')
              )
              expect(tokenSaleBalance).to.be.bignumber.equal(new BN(0))
            })

            itSellsTokensUpToCrowdsaleCapInWeiWithRefund()

            it('checks when soft cap is reached', async () => {
              await newCrowdsale({
                rates: [softCap * 5],
                isMinting,
              })
              await whitelist.addManyToWhitelist([buyer])
              await star.mint(buyer, ether('10'))
              await star.approve(crowdsale.address, ether('1'), {
                from: buyer,
              })

              await increaseTimeTo((await latestTime()).add(duration.days(34)))

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
              softCap: new BN(0),
              rates: [crowdsaleCap],
              isMinting,
            })
            await whitelist.addManyToWhitelist([buyer, user1])
          })

          itTransfersEthCorrectly()

          it('transfers ETH funds in contract between client and starbase everytime', async () => {
            const clientBalanceBefore = await balance.current(client)
            const starbaseBalanceBefore = await balance.current(starbase)

            await increaseTimeTo((await latestTime()).add(duration.days(52)))
            await whitelist.addManyToWhitelist([user1])
            await crowdsale.buyTokens(user1, {
              from: user1,
              value: ether('0.003'),
            })

            let clientBalanceAfter = await balance.current(client)
            let starbaseBalanceAfter = await balance.current(starbase)
            let tokenSaleBalance = await balance.current(crowdsale.address)

            let clientBalanceDifference = clientBalanceAfter.sub(
              clientBalanceBefore
            )
            let starbaseBalanceDifference = starbaseBalanceAfter.sub(
              starbaseBalanceBefore
            )

            expect(clientBalanceDifference).to.be.bignumber.equal(
              ether('0.0027')
            )
            expect(starbaseBalanceDifference).to.be.bignumber.equal(
              ether('0.0003')
            )
            expect(tokenSaleBalance).to.be.bignumber.equal(new BN(0))

            // continues transferrring eth funds
            await crowdsale.buyTokens(user1, {
              from: user1,
              value: ether('0.001'),
            })

            clientBalanceAfter = await balance.current(client)
            starbaseBalanceAfter = await balance.current(starbase)
            tokenSaleBalance = await balance.current(crowdsale.address)

            clientBalanceDifference = clientBalanceAfter.sub(
              clientBalanceBefore
            )
            starbaseBalanceDifference = starbaseBalanceAfter.sub(
              starbaseBalanceBefore
            )

            expect(clientBalanceDifference).to.be.bignumber.equal(
              ether('0.0036')
            )
            expect(starbaseBalanceDifference).to.be.bignumber.equal(
              ether('0.0004')
            )
            expect(tokenSaleBalance).to.be.bignumber.equal(new BN(0))

            // reaches crowdsale cap
            await crowdsale.buyTokens(user1, {
              from: user1,
              value: ether('1'),
            })

            clientBalanceAfter = await balance.current(client)
            starbaseBalanceAfter = await balance.current(starbase)
            tokenSaleBalance = await balance.current(crowdsale.address)

            clientBalanceDifference = clientBalanceAfter.sub(
              clientBalanceBefore
            )
            starbaseBalanceDifference = starbaseBalanceAfter.sub(
              starbaseBalanceBefore
            )

            expect(starbaseBalanceDifference).to.be.bignumber.equal(
              ether('0.1')
            )
            expect(clientBalanceDifference).to.be.bignumber.equal(ether('0.9'))
            expect(tokenSaleBalance).to.be.bignumber.equal(new BN(0))
          })

          it('transfers STAR funds between client and starbase everytime', async () => {
            await star.mint(buyer, ether('10.004'))
            await star.approve(crowdsale.address, ether('0.003'), {
              from: buyer,
            })

            await increaseTimeTo((await latestTime()).add(duration.days(34)))
            await crowdsale.buyTokens(buyer, { from: buyer })

            let clientBalanceAfter = await star.balanceOf(client)
            let starbaseBalanceAfter = await star.balanceOf(starbase)
            let tokenSaleBalance = await star.balanceOf(crowdsale.address)

            expect(clientBalanceAfter).to.be.bignumber.equal(ether('0.0027'))
            expect(starbaseBalanceAfter).to.be.bignumber.equal(ether('0.0003'))
            expect(tokenSaleBalance).to.be.bignumber.equal(new BN(0))

            // continues to transfer
            await star.approve(crowdsale.address, ether('0.001'), {
              from: buyer,
            })
            await crowdsale.buyTokens(buyer, { from: buyer })

            clientBalanceAfter = await star.balanceOf(client)
            starbaseBalanceAfter = await star.balanceOf(starbase)
            tokenSaleBalance = await star.balanceOf(crowdsale.address)

            expect(clientBalanceAfter).to.be.bignumber.equal(ether('0.0036'))
            expect(starbaseBalanceAfter).to.be.bignumber.equal(ether('0.0004'))
            expect(tokenSaleBalance).to.be.bignumber.equal(new BN(0))

            // reaches crowdsale cap
            await star.approve(crowdsale.address, ether('1'), {
              from: buyer,
            })
            await crowdsale.buyTokens(buyer, { from: buyer })

            tokenSaleBalance = await star.balanceOf(crowdsale.address)
            expect(tokenSaleBalance).to.be.bignumber.equal(new BN(0))
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
