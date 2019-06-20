const BonusTokenDistribution = artifacts.require('./BonusTokenDistribution.sol')
const MintableToken = artifacts.require('./MintableToken.sol')

const { expect } = require('chai')

const {
  BN,
  constants,
  ether,
  expectRevert,
  time,
} = require('openzeppelin-test-helpers')

const { duration, increaseTo, latest } = time
const { MAX_UINT256, ZERO_ADDRESS } = constants

contract('BonusTokenDistribution', ([owner, user1]) => {
  let tokenOnSale, bonusTokenDistribution

  beforeEach(async () => {
    tokenOnSale = await MintableToken.new()

    startTime = (await latest()).add(duration.seconds(15))
    endTime = startTime.add(duration.days(70))

    bonusTokenDistribution = await BonusTokenDistribution.new(
      startTime,
      endTime,
      tokenOnSale.address
    )
  })

  describe('when deploying BonusTokenDistribution contract', () => {
    it('reverts when startTime is before current time', async () => {
      await expectRevert(
        BonusTokenDistribution.new(
          startTime.sub(duration.seconds(20)),
          endTime,
          tokenOnSale.address
        ),
        'startTime must be more than current time!'
      )
    })

    it('reverts when endTime is before startTime', async () => {
      await expectRevert(
        BonusTokenDistribution.new(
          startTime,
          startTime.sub(duration.seconds(20)),
          tokenOnSale.address
        ),
        'endTime must be more than startTime!'
      )
    })

    it('reverts when tokenOnSale is 0', async () => {
      await expectRevert(
        BonusTokenDistribution.new(startTime, endTime, ZERO_ADDRESS),
        'tokenOnSale cannot be 0!'
      )
    })

    it('sets passed parameters', async () => {
      const contract = await BonusTokenDistribution.new(
        startTime,
        endTime,
        tokenOnSale.address
      )
      const storedTokenOnSale = await contract.tokenOnSale()
      const storedStartTime = await contract.startTime()
      const storedEndTime = await contract.endTime()

      expect(storedTokenOnSale).to.be.equal(tokenOnSale.address)
      expect(storedStartTime).to.be.bignumber.equal(startTime)
      expect(storedEndTime).to.be.bignumber.equal(endTime)
    })
  })

  describe('#addBonusClaim', () => {
    it('reverts when not yet started', async () => {
      await expectRevert(
        bonusTokenDistribution.addBonusClaim(user1, 10),
        'Distribution period not yet started!'
      )
    })

    describe('when distribution has started', () => {
      beforeEach(async () => {
        await increaseTo(startTime)
      })

      it('reverts when not called by owner', async () => {
        await expectRevert(
          bonusTokenDistribution.addBonusClaim(user1, 10, { from: user1 }),
          'Only owner is able call this function!'
        )
      })

      it('reverts when passing 0 amount', async () => {
        await expectRevert(
          bonusTokenDistribution.addBonusClaim(user1, 0),
          'amount cannot be 0!'
        )
      })

      it('reverts when passing zero address', async () => {
        await expectRevert(
          bonusTokenDistribution.addBonusClaim(ZERO_ADDRESS, 10),
          'user cannot be 0!'
        )
      })

      it('reverts when overflowing', async () => {
        await bonusTokenDistribution.addBonusClaim(user1, 100)
        await expectRevert(
          bonusTokenDistribution.addBonusClaim(user1, MAX_UINT256),
          'SafeAdd overflow!'
        )
      })

      it('adds claim to user balance', async () => {
        const bonusClaimAmount = ether('1')
        const userTokensBefore = await bonusTokenDistribution.bonusTokenBalances(
          user1
        )
        await bonusTokenDistribution.addBonusClaim(user1, bonusClaimAmount)

        const userTokensAfter = await bonusTokenDistribution.bonusTokenBalances(
          user1
        )

        expect(userTokensAfter).to.be.bignumber.equal(
          userTokensBefore.add(bonusClaimAmount)
        )
      })
    })
  })

  describe('#withdrawBonusTokens', () => {
    describe('when claim period not yet started', () => {
      it('reverts the withdrawal transaction', async () => {
        await expectRevert(
          bonusTokenDistribution.withdrawBonusTokens(),
          'Distribution period not yet started!'
        )
      })
    })

    describe('when distribution has started', () => {
      beforeEach(async () => {
        await increaseTo(startTime)
      })

      describe('when locked by owner', () => {
        beforeEach(async () => {
          await bonusTokenDistribution.lock()
        })

        it('reverts the withdrawal transaction', async () => {
          await expectRevert(
            bonusTokenDistribution.withdrawBonusTokens(),
            'Contract is locked by owner!'
          )
        })
      })

      describe('when user has no bonus tokens available', () => {
        beforeEach(async () => {
          await tokenOnSale.mint(bonusTokenDistribution.address, ether('1'))
        })

        it('reverts the withdrawal transaction', async () => {
          await expectRevert(
            bonusTokenDistribution.withdrawBonusTokens(),
            'No bonus tokens to withdraw!'
          )
        })
      })

      describe('when there are not enough bonus tokens left in the contract', () => {
        beforeEach(async () => {
          await bonusTokenDistribution.addBonusClaim(user1, ether('1'))
        })

        it('reverts the withdrawal transaction', async () => {
          await expectRevert(
            bonusTokenDistribution.withdrawBonusTokens({ from: user1 }),
            'Not enough bonus tokens left!'
          )
        })
      })

      describe('when bonus tokens in the contract and for the user', () => {
        beforeEach(async () => {
          await tokenOnSale.mint(bonusTokenDistribution.address, ether('1'))
          await bonusTokenDistribution.addBonusClaim(user1, ether('1'))
        })

        it('sets user bonus token balance to 0', async () => {
          await bonusTokenDistribution.withdrawBonusTokens({ from: user1 })

          const userTokenBalance = await bonusTokenDistribution.bonusTokenBalances(
            user1
          )

          expect(userTokenBalance).to.be.bignumber.equal(new BN(0))
        })

        it('transfers the bonus tokens to the user', async () => {
          const userTokenBalanceBefore = await tokenOnSale.balanceOf(user1)
          const contractTokenBalanceBefore = await tokenOnSale.balanceOf(
            bonusTokenDistribution.address
          )

          await bonusTokenDistribution.withdrawBonusTokens({ from: user1 })

          const userTokenBalanceAfter = await tokenOnSale.balanceOf(user1)
          const contractTokenBalanceAfter = await tokenOnSale.balanceOf(
            bonusTokenDistribution.address
          )

          expect(userTokenBalanceAfter).to.be.bignumber.equal(
            userTokenBalanceBefore.add(ether('1'))
          )
          expect(contractTokenBalanceAfter).to.be.bignumber.equal(
            contractTokenBalanceBefore.sub(ether('1'))
          )
        })
      })
    })
  })

  describe('#withdrawLeftoverBonusTokensOwner', () => {
    beforeEach(async () => {
      await increaseTo(endTime)
    })

    describe('when claim period not yet finished', () => {
      it('reverts the withdrawal transaction', async () => {
        await expectRevert(
          bonusTokenDistribution.withdrawLeftoverBonusTokensOwner(),
          'Claim period is not yet finished!'
        )
      })
    })

    describe('when claim period is finished', () => {
      beforeEach(async () => {
        await increaseTo(endTime.add(duration.days(61)))
      })

      describe('when not called by owner', () => {
        it('reverts the withdrawal transaction', async () => {
          await expectRevert(
            bonusTokenDistribution.withdrawLeftoverBonusTokensOwner({
              from: user1,
            }),
            'Only owner is able call this function!'
          )
        })
      })

      describe('when there are no leftover bonus tokens', () => {
        it('reverts the withdrawal transaction', async () => {
          await expectRevert(
            bonusTokenDistribution.withdrawLeftoverBonusTokensOwner(),
            'No bonus tokens leftover!'
          )
        })
      })

      describe('when there are leftover bonus tokens', () => {
        beforeEach(async () => {
          await tokenOnSale.mint(bonusTokenDistribution.address, ether('1'))
        })

        it('transfers the bonus tokens to the owner', async () => {
          const ownerTokenBalanceBefore = await tokenOnSale.balanceOf(owner)
          const contractTokenBalanceBefore = await tokenOnSale.balanceOf(
            bonusTokenDistribution.address
          )

          await bonusTokenDistribution.withdrawLeftoverBonusTokensOwner()

          const ownerTokenBalanceAfter = await tokenOnSale.balanceOf(owner)
          const contractTokenBalanceAfter = await tokenOnSale.balanceOf(
            bonusTokenDistribution.address
          )

          expect(ownerTokenBalanceAfter).to.be.bignumber.equal(
            ownerTokenBalanceBefore.add(ether('1'))
          )
          expect(contractTokenBalanceAfter).to.be.bignumber.equal(
            contractTokenBalanceBefore.sub(ether('1'))
          )
        })
      })
    })
  })
})
