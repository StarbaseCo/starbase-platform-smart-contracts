const MintableToken = artifacts.require('./MintableToken.sol')
const DistributeERC20 = artifacts.require('./DistributeERC20.sol')

const { ensuresException } = require('./helpers/utils')
const BigNumber = web3.BigNumber
const expect = require('chai').expect

contract('DistributeERC20', ([owner, tokenHolder, buyer, buyer2]) => {
  const holderAmount = new BigNumber(60e18)

  const value1 = new BigNumber(1e18)
  const value2 = new BigNumber(3e18)

  let distributeERC20, token

  beforeEach('initialize contract', async () => {
    token = await MintableToken.new()

    distributeERC20 = await DistributeERC20.new(tokenHolder, token.address)

    token.mint(tokenHolder, holderAmount)
    token.approve(distributeERC20.address, holderAmount, {
      from: tokenHolder,
    })
  })

  describe('#distributeTokens', () => {
    it('must NOT be called by a non owner', async () => {
      try {
        await distributeERC20.distributeTokens(
          [buyer, buyer2],
          [value1, value2],
          {
            from: buyer,
          }
        )
        assert.fail()
      } catch (e) {
        ensuresException(e)
      }

      let buyerBalance = await token.balanceOf(buyer)
      buyerBalance.should.be.bignumber.equal(0)

      let buyer2Balance = await token.balanceOf(buyer2)
      buyer2Balance.should.be.bignumber.equal(0)

      // CORRECT WAY
      await distributeERC20.distributeTokens(
        [buyer, buyer2],
        [value1, value2],
        {
          from: owner,
        }
      )

      buyerBalance = await token.balanceOf(buyer)
      buyerBalance.should.be.bignumber.equal(value1)

      buyer2Balance = await token.balanceOf(buyer2)
      buyer2Balance.should.be.bignumber.equal(value2)
    })

    it('does NOT distribute tokens when values list does not match address list', async () => {
      try {
        await distributeERC20.distributeTokens([buyer, buyer2], [value1], {
          from: owner,
        })
        assert.fail()
      } catch (e) {
        ensuresException(e)
      }

      let buyerBalance = await token.balanceOf(buyer)
      buyerBalance.should.be.bignumber.equal(0)

      let buyer2Balance = await token.balanceOf(buyer2)
      buyer2Balance.should.be.bignumber.equal(0)

      // CORRECT WAY
      await distributeERC20.distributeTokens(
        [buyer, buyer2],
        [value1, value2],
        {
          from: owner,
        }
      )

      buyerBalance = await token.balanceOf(buyer)
      buyerBalance.should.be.bignumber.equal(value1)

      buyer2Balance = await token.balanceOf(buyer2)
      buyer2Balance.should.be.bignumber.equal(value2)
    })

    it('should NOT distribute tokens when the approve is reached', async () => {
      try {
        await distributeERC20.distributeTokens([buyer, buyer2], [10e18, 60e18])
        assert.fail()
      } catch (e) {
        ensuresException(e)
      }

      let buyerBalance = await token.balanceOf(buyer)
      buyerBalance.should.be.bignumber.equal(0)

      let buyer2Balance = await token.balanceOf(buyer2)
      buyer2Balance.should.be.bignumber.equal(0)

      // CORRECT WAY
      await distributeERC20.distributeTokens([buyer, buyer2], [10e18, 50e18], {
        from: owner,
      })

      buyerBalance = await token.balanceOf(buyer)
      buyerBalance.should.be.bignumber.equal(10e18)

      buyer2Balance = await token.balanceOf(buyer2)
      buyer2Balance.should.be.bignumber.equal(50e18)
    })

    it('allows manual distributing of tokens', async () => {
      await distributeERC20.distributeTokens([buyer, buyer2], [value1, 2e18])

      const buyerBalance = await token.balanceOf(buyer)
      buyerBalance.should.be.bignumber.equal(value1)

      const buyer2Balance = await token.balanceOf(buyer2)
      buyer2Balance.should.be.bignumber.equal(2e18)
    })

    it('creates DistributeToken event', async () => {
      const { logs } = await distributeERC20.distributeTokens(
        [buyer, buyer2],
        [value1, 3e18]
      )

      const buyerBalance = await token.balanceOf(buyer)
      buyerBalance.should.be.bignumber.equal(value1)

      const buyer2Balance = await token.balanceOf(buyer2)
      buyer2Balance.should.be.bignumber.equal(3e18)

      const event = logs.find(e => e.event === 'DistributeToken')
      expect(event).to.exist
    })
  })

  describe('selfdestruct', () => {
    it('does NOT anyone other than the owner to kill contract', async () => {
      try {
        await distributeERC20.kill({ from: buyer })
        assert.fail()
      } catch (e) {
        ensuresException(e)
      }

      const balance = await token.balanceOf(tokenHolder)
      balance.should.be.bignumber.equal(holderAmount)
    })

    it('is able to kill contract ', async () => {
      await distributeERC20.kill({ from: owner })
    })
  })
})
