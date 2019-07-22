const FundsSplitter = artifacts.require('./FundsSplitter.sol')
const MintableToken = artifacts.require('./MintableToken.sol')

const { expect } = require('chai')
const { balance, BN, ether } = require('openzeppelin-test-helpers')

contract('FundsSplitter', ([_, client, starbase]) => {
  let token, tokenOnSale, fundsSplitter

  const starbasePercentageNumber = new BN(10)

  beforeEach(async () => {
    token = await MintableToken.new()
    tokenOnSale = await MintableToken.new()
    fundsSplitter = await FundsSplitter.new(
      client,
      starbase,
      starbasePercentageNumber,
      token.address,
      tokenOnSale.address
    )
  })

  describe('#splitFunds', () => {
    it('split existing funds between client and starbase', async () => {
      const clientBalanceBefore = await balance.current(client)
      const starbaseBalanceBefore = await balance.current(starbase)

      await fundsSplitter.sendTransaction({ from: _, value: ether('20') })
      await fundsSplitter.splitFunds({ from: _ })

      const clientBalanceAfter = await balance.current(client)
      const starbaseBalanceAfter = await balance.current(starbase)

      const clientBalanceDifference = clientBalanceAfter.sub(
        clientBalanceBefore
      )
      const starbaseBalanceDifference = starbaseBalanceAfter.sub(
        starbaseBalanceBefore
      )

      expect(starbaseBalanceDifference).to.be.bignumber.equal(ether('2'))
      expect(clientBalanceDifference).to.be.bignumber.equal(ether('18'))
    })

    it('split new funds between client and starbase', async () => {
      const clientBalanceBefore = await balance.current(client)
      const starbaseBalanceBefore = await balance.current(starbase)

      await fundsSplitter.splitFunds({ from: _, value: ether('20') })

      const clientBalanceAfter = await balance.current(client)
      const starbaseBalanceAfter = await balance.current(starbase)

      const clientBalanceDifference = clientBalanceAfter.sub(
        clientBalanceBefore
      )
      const starbaseBalanceDifference = starbaseBalanceAfter.sub(
        starbaseBalanceBefore
      )

      expect(starbaseBalanceDifference).to.be.bignumber.equal(ether('2'))
      expect(clientBalanceDifference).to.be.bignumber.equal(ether('18'))
    })
  })

  describe('#splitStarFunds', () => {
    beforeEach(async () => {
      token.mint(fundsSplitter.address, ether('10'))
    })

    it('split funds between client and starbase', async () => {
      await fundsSplitter.splitStarFunds({ from: _ })

      const clientStarBalance = await token.balanceOf(client)
      const starbaseStarBalance = await token.balanceOf(starbase)

      expect(starbaseStarBalance).to.be.bignumber.equal(ether('1'))
      expect(clientStarBalance).to.be.bignumber.equal(ether('9'))
    })
  })

  describe('#withdrawRemainingTokens', () => {
    beforeEach(async () => {
      await tokenOnSale.mint(fundsSplitter.address, ether('10'))
    })

    it('withdraw all remaining tokens on sale to client', async () => {
      await fundsSplitter.withdrawRemainingTokens({ from: _ })

      const clientStarBalance = await tokenOnSale.balanceOf(client)
      expect(clientStarBalance).to.be.bignumber.equal(ether('10'))
    })
  })
})
