const StarStaking = artifacts.require('StarStaking.sol')
const CompanyToken = artifacts.require('CompanyToken.sol')
const StarEthRate = artifacts.require('./StarEthRate.sol')
const Whitelist = artifacts.require('./Whitelist.sol')
const FundsSplitter = artifacts.require('./FundsSplitter.sol')

const { ensuresException, should } = require('./helpers/utils')

const { expect } = require('chai')

const {
  BN,
  constants,
  ether,
  expectRevert,
  time,
} = require('openzeppelin-test-helpers')

const { duration } = time
const increaseTimeTo = time.increaseTo
const latestTime = time.latest

const { ZERO_ADDRESS } = constants
const HEAD = ZERO_ADDRESS
const BALANCES = [1, 60000, 99999999].map(n => new BN(n))

contract('StarStaking', accounts => {
  const [user1, user2, user3, user4, user5, user6, client, starbase] = accounts
  let stakingContract,
    starEthRate,
    starToken,
    tokenOnSale,
    initialBalance,
    defaultStartTime,
    defaultEndTime,
    defaultStakeSaleCap,
    defaultTargetRateInEth,
    defaultMaxDiscountPer1000,
    defaultDeclinePerRankPer1000,
    defaultStarEthRateDecimalCorrectionFactor,
    defaultStarEthRate,
    defaultWallet,
    defaultWhitelist,
    defaultStarbasePercentageNumber

  beforeEach(async () => {
    defaultStarbasePercentageNumber = new BN(10)

    initialBalance = new BN(10000).mul(ether('1'))
    starToken = await CompanyToken.new('Starbase', 'STAR', 18)
    tokenOnSale = await CompanyToken.new('ProjectToken', 'PT', 18)

    await starToken.unpause()
    await tokenOnSale.unpause()

    defaultStartTime = new BN((await latestTime()).toString()).add(
      new BN(10000)
    )
    defaultEndTime = defaultStartTime.add(new BN(200000))

    defaultTargetRateInEth = new BN(2000) // 2000 tokens per ETH
    defaultMaxDiscountPer1000 = new BN(500) // = 50%
    defaultDeclinePerRankPer1000 = new BN(5) // = 0.5%

    defaultTopRanksMaxSize = new BN(10)
    defaultStakeSaleCap = new BN(1000)
    defaultMaxStakePerUser = new BN(600)

    defaultStarEthRate = new BN(2) // 2/10 STAR = 1 ETH
    defaultStarEthRateDecimalCorrectionFactor = new BN(10)

    defaultWhitelist = await Whitelist.new()
    const fundsSplitter = await FundsSplitter.new(
      client,
      starbase,
      defaultStarbasePercentageNumber,
      starToken.address,
      tokenOnSale.address
    )
    defaultWallet = fundsSplitter.address

    starEthRate = await StarEthRate.new(
      defaultStarEthRateDecimalCorrectionFactor,
      defaultStarEthRate
    )

    stakingContract = await StarStaking.new(
      defaultStartTime,
      defaultEndTime,
      [
        starEthRate.address,
        starToken.address,
        tokenOnSale.address,
        defaultWallet,
        defaultWhitelist.address,
      ],
      defaultTopRanksMaxSize,
      defaultTargetRateInEth,
      defaultMaxDiscountPer1000,
      defaultDeclinePerRankPer1000,
      defaultStakeSaleCap,
      defaultMaxStakePerUser
    )

    await starToken.mint(user1, initialBalance)
    await tokenOnSale.mint(stakingContract.address, initialBalance)
    await starToken.approve(stakingContract.address, initialBalance)

    await defaultWhitelist.addManyToWhitelist(accounts)
  })

  const deployStakingContract = async ({
    startTime = defaultStartTime,
    endTime = defaultEndTime,
    starEthRateAddress = starEthRate.address,
    starTokenAddress = starToken.address,
    tokenOnSaleAddress = tokenOnSale.address,
    wallet = defaultWallet,
    whitelistAddress = defaultWhitelist.address,
    topRanksMaxSize = defaultTopRanksMaxSize,
    targetRateInEth = defaultTargetRateInEth,
    maxDiscountPer1000 = defaultMaxDiscountPer1000,
    declinePerRankPer1000 = defaultDeclinePerRankPer1000,
    stakeSaleCap = defaultStakeSaleCap,
    maxStakePerUser = defaultMaxStakePerUser,
  } = {}) => {
    stakingContract = await StarStaking.new(
      startTime,
      endTime,
      [
        starEthRateAddress,
        starTokenAddress,
        tokenOnSaleAddress,
        wallet,
        whitelistAddress,
      ],
      topRanksMaxSize,
      targetRateInEth,
      maxDiscountPer1000,
      declinePerRankPer1000,
      stakeSaleCap,
      maxStakePerUser
    )
    await starToken.mint(user1, initialBalance)
    await starToken.approve(stakingContract.address, initialBalance)

    await tokenOnSale.mint(stakingContract.address, initialBalance)
  }

  describe('when deploying the contract', () => {
    const itFailsToDeployContract = async ({
      starEthRateAddress = starEthRate.address,
      starTokenAddress = starToken.address,
      tokenOnSaleAddress = tokenOnSale.address,
      whitelistAddress = defaultWhitelist.address,
      startTime = defaultStartTime,
      endTime = defaultEndTime,
      topRanksMaxSize = defaultTopRanksMaxSize,
      targetRateInEth = defaultTargetRateInEth,
      maxDiscountPer1000 = defaultMaxDiscountPer1000,
      declinePerRankPer1000 = defaultDeclinePerRankPer1000,
      stakeSaleCap = defaultStakeSaleCap,
      maxStakePerUser = defaultMaxStakePerUser,
      wallet = defaultWallet,
      expectedError,
    }) => {
      let emptyStakingContract

      try {
        emptyStakingContract = await StarStaking.new(
          startTime,
          endTime,
          [
            starEthRateAddress,
            starTokenAddress,
            tokenOnSaleAddress,
            wallet,
            whitelistAddress,
          ],
          topRanksMaxSize,
          targetRateInEth,
          maxDiscountPer1000,
          declinePerRankPer1000,
          stakeSaleCap,
          maxStakePerUser
        )

        assert.fail()
      } catch (error) {
        ensuresException(error, expectedError)
      }

      should.equal(emptyStakingContract, undefined)
    }

    it('does NOT allow to deploy with a closing time before starting time', async () => {
      await itFailsToDeployContract({
        startTime: defaultEndTime,
        endTime: defaultStartTime,
        expectedError: 'endTime must be more than startTime!',
      })
    })

    it('does NOT allow to deploy with a starting time before the current time', async () => {
      const earlyStartTime = new BN((await latestTime()).toString()).sub(
        new BN(1000)
      )
      await itFailsToDeployContract({
        startTime: earlyStartTime,
        expectedError: 'startTime must be more than current time!',
      })
    })

    it('does NOT allow to deploy with a maxStakePerUser higher than stakeSaleCap', async () => {
      await itFailsToDeployContract({
        maxStakePerUser: new BN(200),
        stakeSaleCap: new BN(100),
        expectedError:
          'Max stake per user should be smaller than StakeSale cap!',
      })
    })

    it('does NOT allow to deploy with a parameter of 0', async () => {
      const parameters = [
        'starEthRateAddress',
        'starTokenAddress',
        'tokenOnSaleAddress',
        'whitelistAddress',
        'startTime',
        'endTime',
        'topRanksMaxSize',
        'targetRateInEth',
        'maxDiscountPer1000',
        'declinePerRankPer1000',
        'stakeSaleCap',
        'maxStakePerUser',
        'wallet',
      ]

      for (let i = 0; i < parameters.length; i++) {
        const functionParameters = {
          expectedError: 'Parameter variables cannot be empty!',
        }
        const isAddress = paramName =>
          [
            'starEthRateAddress',
            'starTokenAddress',
            'tokenOnSaleAddress',
            'whitelistAddress',
            'wallet',
          ].includes(paramName)

        functionParameters[parameters[i]] = isAddress(parameters[i])
          ? ZERO_ADDRESS
          : 0

        await itFailsToDeployContract(functionParameters)
      }
    })

    it('does NOT allow to deploy with a max decline higher than max discount', async () => {
      await itFailsToDeployContract({
        declinePerRankPer1000: new BN(51),
        maxDiscountPer1000: new BN(500),
        topRanksMaxSize: new BN(11),
        expectedError:
          'Please increase max discount or decrease decline per rank!',
      })
    })

    it('sets initial parameters correctly', async () => {
      const setTokenAddress = await stakingContract.starToken()
      const setTokenOnSale = await stakingContract.tokenOnSale()
      const setTopRanksMaxSize = await stakingContract.topRanksMaxSize()
      const setStartTime = await stakingContract.startTime()
      const setEndTime = await stakingContract.endTime()
      const setStakeSaleCap = await stakingContract.stakeSaleCap()
      const setMaxStakePerUser = await stakingContract.maxStakePerUser()
      const starEthRateInterface = await stakingContract.starEthRateInterface()
      const star = await stakingContract.starToken()
      const token = await stakingContract.tokenOnSale()
      const whitelist = await stakingContract.whitelist()
      const fundsSplitter = await stakingContract.wallet()

      setTokenAddress.should.be.equal(
        starToken.address,
        'Token address not matching!'
      )
      setTokenOnSale.should.be.equal(
        tokenOnSale.address,
        'Token address not matching!'
      )
      expect(setTopRanksMaxSize).to.be.bignumber.equal(
        defaultTopRanksMaxSize,
        'Top ranks size not matching!'
      )
      expect(setStartTime).to.be.bignumber.equal(
        defaultStartTime,
        'Opening time not matching!'
      )
      expect(setEndTime).to.be.bignumber.equal(
        defaultEndTime,
        'Closing time not matching!'
      )
      expect(setStakeSaleCap).to.be.bignumber.equal(
        defaultStakeSaleCap.mul(ether('1')),
        'Stake sale cap not matching!'
      )
      expect(setMaxStakePerUser).to.be.bignumber.equal(
        defaultMaxStakePerUser.mul(ether('1')),
        'Max stake per user not matching!'
      )
      expect(starEthRateInterface).to.be.equal(starEthRate.address)
      expect(star).to.be.equal(starToken.address)
      expect(token).to.be.equal(tokenOnSale.address)
      expect(whitelist).to.be.equal(defaultWhitelist.address)
      expect(fundsSplitter).to.be.equal(defaultWallet)
    })
  })

  describe('when adding to the top ranks count', () => {
    it('respects the maximum top ranks count', async () => {
      await increaseTimeTo(defaultStartTime)
      await stakingContract.stakeFor(user1, new BN(10000), HEAD)

      for (let i = 1; i < 11; i++) {
        const topRanksCount = await stakingContract.topRanksCount()
        expect(topRanksCount).to.be.bignumber.equal(
          new BN(i),
          'Top ranks count is not incremented!'
        )
        await stakingContract.stakeFor(
          accounts[i],
          new BN(10000).sub(new BN(500).mul(new BN(i))),
          accounts[i - 1],
          { from: user1 }
        )
      }

      const topRanksCount = await stakingContract.topRanksCount()
      expect(topRanksCount).to.be.bignumber.equal(
        new BN(10),
        'Top ranks count should not exceed maximum top ranks size!'
      )
    })
  })

  describe('when staking period is open', () => {
    beforeEach(async () => {
      await increaseTimeTo(defaultStartTime)
    })

    it('allows ONLY whitelisted addresses to purchase tokens', async () => {
      await defaultWhitelist.removeManyFromWhitelist([accounts[8]])

      await expectRevert(
        stakingContract.stakeFor(accounts[8], new BN(10), HEAD),
        'Beneficiary not whitelisted!'
      )
    })

    it('must have sufficient funds for the staking', async () => {
      await stakingContract.stakeFor(user2, new BN(10), HEAD)
      const timeWhenSubmitted = [new BN((await latestTime()).toString())]

      try {
        await stakingContract.stakeFor(user3, new BN(100), user2, {
          from: user3,
        })
        assert.fail()
      } catch (error) {
        const expectedError = 'From user has not enough funds!'
        ensuresException(error, expectedError)
      }

      const result = await stakingContract.getTopRanksTuples()
      listShouldEqualExpected({
        result,
        addresses: [new BN(user2.slice(2), 16)],
        totalStaked: [new BN(10)],
        timesWhenSubmitted: timeWhenSubmitted,
      })
    })

    it('transfers STAR funds between client and starbase', async () => {
      const stakingAmount = ether('1')

      const clientBalanceBefore = await starToken.balanceOf(client)
      const starbaseBalanceBefore = await starToken.balanceOf(starbase)

      await stakingContract.stakeFor(user1, stakingAmount, HEAD)

      const userBalance = await starToken.balanceOf.call(user1)
      const stakingContractBalance = await starToken.balanceOf.call(
        stakingContract.address
      )
      const walletBalance = await starToken.balanceOf.call(defaultWallet)

      expect(userBalance).to.be.bignumber.equal(
        initialBalance.sub(stakingAmount)
      )
      expect(walletBalance).to.be.bignumber.equal(new BN(0))
      expect(stakingContractBalance).to.be.bignumber.equal(new BN(0))

      const clientBalanceAfter = await starToken.balanceOf(client)
      const starbaseBalanceAfter = await starToken.balanceOf(starbase)

      const clientBalanceDifference = clientBalanceAfter.sub(
        clientBalanceBefore
      )
      const starbaseBalanceDifference = starbaseBalanceAfter.sub(
        starbaseBalanceBefore
      )

      expect(starbaseBalanceDifference).to.be.bignumber.equal(ether('0.1'))
      expect(clientBalanceDifference).to.be.bignumber.equal(ether('0.9'))
    })

    it('allows user to stake for other person', async () => {
      const stakingAmount = new BN(5000)
      await stakingContract.stakeFor(user2, stakingAmount, HEAD)

      const user1TotalStaked = await stakingContract.totalStakedFor.call(user2)
      expect(user1TotalStaked).to.be.bignumber.equal(stakingAmount)
    })

    describe('when cap is reached', async () => {
      it('adds only the remaining staking tokens', async () => {
        await stakingContract.stakeFor(
          user1,
          defaultMaxStakePerUser.mul(ether('1')),
          HEAD
        )
        await stakingContract.stakeFor(
          user2,
          defaultMaxStakePerUser.mul(ether('1')),
          user1
        )

        const userBalance = await starToken.balanceOf.call(user1)
        const stakingContractBalance = await starToken.balanceOf.call(
          stakingContract.address
        )
        const walletBalance = await starToken.balanceOf.call(defaultWallet)
        const user2Staked = await stakingContract.totalStakedFor.call(user2)

        expect(userBalance).to.be.bignumber.equal(
          initialBalance.sub(defaultStakeSaleCap.mul(ether('1')))
        )
        expect(stakingContractBalance).to.be.bignumber.equal(new BN(0))
        expect(walletBalance).to.be.bignumber.equal(new BN(0))
        expect(user2Staked).to.be.bignumber.equal(
          defaultStakeSaleCap
            .mul(ether('1'))
            .sub(defaultMaxStakePerUser.mul(ether('1')))
        )

        const totalBalance = defaultStakeSaleCap.mul(ether('1'))

        const clientBalance = await starToken.balanceOf(client)
        const starbaseBalance = await starToken.balanceOf(starbase)

        expect(clientBalance).to.be.bignumber.equal(
          totalBalance
            .mul(new BN(100).sub(defaultStarbasePercentageNumber))
            .div(new BN(100))
        )
        expect(starbaseBalance).to.be.bignumber.equal(
          totalBalance.mul(defaultStarbasePercentageNumber).div(new BN(100))
        )
      })

      it('throws an error once cap when trying to add above cap', async () => {
        await stakingContract.stakeFor(
          user1,
          defaultMaxStakePerUser.mul(ether('1')),
          HEAD
        )
        await stakingContract.stakeFor(
          user2,
          defaultMaxStakePerUser.mul(ether('1')),
          user1
        )
        try {
          await stakingContract.stakeFor(
            user2,
            defaultMaxStakePerUser.mul(ether('1')),
            user1
          )
          assert.fail()
        } catch (error) {
          const expectedError = 'StakeSale cap reached, the sale is finished!'
          ensuresException(error, expectedError)
        }

        const userBalance = await starToken.balanceOf.call(user1)
        const stakingContractBalance = await starToken.balanceOf.call(
          stakingContract.address
        )
        const walletBalance = await starToken.balanceOf.call(defaultWallet)
        const user2Staked = await stakingContract.totalStakedFor.call(user2)

        expect(userBalance).to.be.bignumber.equal(
          initialBalance.sub(defaultStakeSaleCap.mul(ether('1')))
        )
        expect(stakingContractBalance).to.be.bignumber.equal(new BN(0))
        expect(walletBalance).to.be.bignumber.equal(new BN(0))
        expect(user2Staked).to.be.bignumber.equal(
          defaultStakeSaleCap
            .mul(ether('1'))
            .sub(defaultMaxStakePerUser.mul(ether('1')))
        )

        const totalBalance = defaultStakeSaleCap.mul(ether('1'))

        const clientBalance = await starToken.balanceOf(client)
        const starbaseBalance = await starToken.balanceOf(starbase)

        expect(clientBalance).to.be.bignumber.equal(
          totalBalance
            .mul(new BN(100).sub(defaultStarbasePercentageNumber))
            .div(new BN(100))
        )
        expect(starbaseBalance).to.be.bignumber.equal(
          totalBalance.mul(defaultStarbasePercentageNumber).div(new BN(100))
        )
      })
    })

    it('adds only the remaining staking tokens when defaultMaxStakePerUser is reached', async () => {
      await stakingContract.stakeFor(
        user1,
        defaultMaxStakePerUser.mul(ether('1')).add(new BN(10000)),
        HEAD
      )
      const userBalance = await starToken.balanceOf.call(user1)
      const walletBalance = await starToken.balanceOf.call(defaultWallet)
      const stakingContractBalance = await starToken.balanceOf.call(
        stakingContract.address
      )

      expect(userBalance).to.be.bignumber.equal(
        initialBalance.sub(defaultMaxStakePerUser.mul(ether('1')))
      )
      expect(walletBalance).to.be.bignumber.equal(new BN(0))
      expect(stakingContractBalance).to.be.bignumber.equal(new BN(0))

      const totalBalance = defaultMaxStakePerUser.mul(ether('1'))

      const clientBalance = await starToken.balanceOf(client)
      const starbaseBalance = await starToken.balanceOf(starbase)

      expect(clientBalance).to.be.bignumber.equal(
        totalBalance
          .mul(new BN(100).sub(defaultStarbasePercentageNumber))
          .div(new BN(100))
      )
      expect(starbaseBalance).to.be.bignumber.equal(
        totalBalance.mul(defaultStarbasePercentageNumber).div(new BN(100))
      )
    })
  })

  const computeStakingPoints = ({
    amount,
    timeWhenSubmitted,
    timeAdvanced,
  }) => {
    const adjustedTime = timeAdvanced
      ? timeWhenSubmitted.sub(new BN(1))
      : timeWhenSubmitted
    const timeUntilEnd = defaultEndTime.sub(adjustedTime)
    const stakingPoints = timeUntilEnd.mul(amount)

    return stakingPoints
  }

  const evaluateComputation = async amount => {
    await stakingContract.stakeFor(user1, amount, HEAD)
    const timeWhenSubmitted = new BN(await latestTime())
    const userTotalStakingPoints = await stakingContract.totalStakingPointsFor.call(
      user1
    )

    const pointsWithoutTimeAdvanced = computeStakingPoints({
      amount,
      timeWhenSubmitted,
      timeAdvanced: false,
    })
    const pointsWithTimeAdvanced = computeStakingPoints({
      amount,
      timeWhenSubmitted,
      timeAdvanced: true,
    })

    expect(userTotalStakingPoints).to.be.bignumber.at.least(
      pointsWithoutTimeAdvanced
    )
    expect(userTotalStakingPoints).to.be.bignumber.at.most(
      pointsWithTimeAdvanced
    )
  }

  describe('when adding new stake', () => {
    BALANCES.forEach(async balance => {
      describe(`staking ${balance.toNumber()} tokens`, async () => {
        it('calculates the points correctly at the beginning', async () => {
          await increaseTimeTo(defaultStartTime)
          evaluateComputation(balance)
        })

        it('calculates the points correctly in the middle', async () => {
          await increaseTimeTo(
            defaultStartTime.add(
              defaultEndTime.sub(defaultStartTime).div(new BN(2))
            )
          )
          evaluateComputation(balance)
        })

        it('calculates the points correctly at the end', async () => {
          await increaseTimeTo(defaultEndTime.sub(new BN(20)))
          evaluateComputation(balance)
        })
      })
    })
  })

  const listShouldEqualExpected = ({
    result,
    addresses,
    totalStaked,
    timesWhenSubmitted,
  }) => {
    const [rcvAddrs, rcvStakingPoints, rcvTotalStaked] = [[], [], []]

    result.forEach((e, i) => {
      if (!(i % 3)) {
        rcvAddrs.push(e)
        rcvStakingPoints.push(result[i + 1])
        rcvTotalStaked.push(result[i + 2])
      }
    })

    rcvAddrs.forEach((rcvAddr, i) => {
      expect(rcvAddr).to.be.bignumber.equal(addresses[i])
    })

    rcvTotalStaked.forEach((rcvStake, i) => {
      expect(rcvStake).to.be.bignumber.equal(totalStaked[i])
    })

    rcvStakingPoints.forEach((stakingPoints, i) => {
      const amount = totalStaked[i]
      const timeWhenSubmitted = timesWhenSubmitted[i]

      const pointsWithoutTimeAdvanced = computeStakingPoints({
        amount,
        timeWhenSubmitted,
        timeAdvanced: false,
      })
      const pointsWithTimeAdvanced = computeStakingPoints({
        amount,
        timeWhenSubmitted,
        timeAdvanced: true,
      })

      expect(stakingPoints).to.be.bignumber.at.least(
        pointsWithoutTimeAdvanced,
        'Staking points should match computed staking points!'
      )
      expect(stakingPoints).to.be.bignumber.at.most(
        pointsWithTimeAdvanced,
        'Staking points should match computed staking points!'
      )
    })
  }

  describe('when building the top ranks', () => {
    it('must provide an existing reference node', async () => {
      await increaseTimeTo(defaultStartTime)
      await stakingContract.stakeFor(user2, new BN(10), HEAD)
      const timeWhenSubmitted = [new BN((await latestTime()).toString())]

      try {
        await stakingContract.stakeFor(user3, new BN(100), user4)
        assert.fail()
      } catch (error) {
        const expectedError = 'Node for suggested position does not exist!'
        ensuresException(error, expectedError)
      }

      const result = await stakingContract.getTopRanksTuples()
      listShouldEqualExpected({
        result,
        addresses: [new BN(user2.slice(2), 16)],
        totalStaked: [new BN(10)],
        timesWhenSubmitted: timeWhenSubmitted,
      })
    })

    it('must provide a reference node that exists', async () => {
      await increaseTimeTo(defaultStartTime)
      await stakingContract.stakeFor(user2, new BN(10), HEAD)
      const timeWhenSubmitted = [new BN((await latestTime()).toString())]

      try {
        await stakingContract.stakeFor(user3, new BN(100), user4)
        assert.fail()
      } catch (error) {
        const expectedError = 'Node for suggested position does not exist!'
        ensuresException(error, expectedError)
      }

      const result = await stakingContract.getTopRanksTuples()
      listShouldEqualExpected({
        result,
        addresses: [new BN(user2.slice(2), 16)],
        totalStaked: [new BN(10)],
        timesWhenSubmitted: timeWhenSubmitted,
      })
    })

    it('must provide a reference node that is not equal to calling user', async () => {
      await increaseTimeTo(defaultStartTime)
      await stakingContract.stakeFor(user2, new BN(10), HEAD)
      const timeWhenSubmitted = [new BN((await latestTime()).toString())]

      try {
        await stakingContract.stakeFor(user2, new BN(100), user2)
        assert.fail()
      } catch (error) {
        const expectedError = 'One rank above cannot be equal to inserted user!'
        ensuresException(error, expectedError)
      }

      const result = await stakingContract.getTopRanksTuples()
      listShouldEqualExpected({
        result,
        addresses: [new BN(user2.slice(2), 16)],
        totalStaked: [new BN(10)],
        timesWhenSubmitted: timeWhenSubmitted,
      })
    })

    describe('referencing a node that is too low/high', () => {
      let timesWhenSubmitted = []

      beforeEach(async () => {
        await increaseTimeTo(defaultStartTime)
        await stakingContract.stakeFor(user1, new BN(100), HEAD)
        timesWhenSubmitted = [new BN((await latestTime()).toString())]

        await stakingContract.stakeFor(user2, new BN(10), user1)
        timesWhenSubmitted.push(new BN((await latestTime()).toString()))

        await stakingContract.stakeFor(user3, new BN(1), user2)
        timesWhenSubmitted.push(new BN((await latestTime()).toString()))
      })

      it('throws an error for suggested positions that are too high', async () => {
        try {
          await stakingContract.stakeFor(user4, new BN(5), user1)
          assert.fail()
        } catch (error) {
          const expectedError = 'Suggested position into top ranks too high!'
          ensuresException(error, expectedError)
        }

        const result = await stakingContract.getTopRanksTuples()
        const addresses = accounts
          .slice(0, 3)
          .map(user => new BN(user.slice(2), 16))
        listShouldEqualExpected({
          result,
          addresses,
          totalStaked: [new BN(100), new BN(10), new BN(1)],
          timesWhenSubmitted,
        })
      })

      it('throws an error for suggested positions that are too low', async () => {
        try {
          await stakingContract.stakeFor(user4, new BN(1000), user3)
          assert.fail()
        } catch (error) {
          const expectedError = 'Suggested position into top ranks too low!'
          ensuresException(error, expectedError)
        }

        const result = await stakingContract.getTopRanksTuples()
        const addresses = accounts
          .slice(0, 3)
          .map(user => new BN(user.slice(2), 16))
        listShouldEqualExpected({
          result,
          addresses,
          totalStaked: [new BN(100), new BN(10), new BN(1)],
          timesWhenSubmitted,
        })
      })
    })

    it('correctly inserts into top ranks at first rank position', async () => {
      const totalStaked = [
        new BN(100000),
        new BN(10000),
        new BN(1000),
        new BN(100),
        new BN(10),
      ]
      const timesWhenSubmitted = []

      await increaseTimeTo(defaultStartTime)
      await stakingContract.stakeFor(user1, totalStaked[4], HEAD)
      timesWhenSubmitted.push(new BN((await latestTime()).toString()))

      for (let i = 1; i < totalStaked.length; i++) {
        await increaseTimeTo(defaultStartTime.add(new BN(i).mul(new BN(5))))
        await stakingContract.stakeFor(
          accounts[i],
          totalStaked[4 - i],
          accounts[i - 1],
          { from: user1 }
        )
        timesWhenSubmitted.push(new BN((await latestTime()).toString()))
      }

      const result = await stakingContract.getTopRanksTuples()
      const addresses = accounts
        .slice(0, totalStaked.length)
        .reverse()
        .map(user => new BN(user.slice(2), 16))

      listShouldEqualExpected({
        result,
        addresses,
        totalStaked,
        timesWhenSubmitted: timesWhenSubmitted.reverse(),
      })
    })

    it('correctly updates adding more stake for current first rank', async () => {
      const totalStaked = [
        new BN(100000),
        new BN(10000),
        new BN(1000),
        new BN(100),
        new BN(10),
      ]
      const bigStake = ether('100')

      await increaseTimeTo(defaultStartTime)
      await stakingContract.stakeFor(user1, totalStaked[4], HEAD)

      for (let i = 1; i < totalStaked.length; i++) {
        await increaseTimeTo(defaultStartTime.add(new BN(i).mul(new BN(5))))
        await stakingContract.stakeFor(
          accounts[i],
          totalStaked[4 - i],
          accounts[i - 1],
          { from: user1 }
        )
      }
      const result1 = (await stakingContract.getTopRanksTuples())[0]

      await stakingContract.stakeFor(accounts[5], bigStake, accounts[4])
      const result2 = (await stakingContract.getTopRanksTuples())[0]

      await stakingContract.stakeFor(accounts[5], bigStake, accounts[4])
      const result3 = (await stakingContract.getTopRanksTuples())[0]

      expect(result1).to.be.bignumber.equal(new BN(accounts[4].slice(2), 16))
      expect(result2).to.be.bignumber.equal(new BN(accounts[5].slice(2), 16))
      expect(result3).to.be.bignumber.equal(new BN(accounts[5].slice(2), 16))
    })

    it('correctly inserts into top ranks at last rank position', async () => {
      const totalStaked = [
        new BN(6000),
        new BN(5000),
        new BN(4000),
        new BN(3000),
        new BN(2000),
        new BN(1000),
      ]

      const timesWhenSubmitted = []

      await increaseTimeTo(defaultStartTime)
      await stakingContract.stakeFor(user1, totalStaked[0], HEAD)
      timesWhenSubmitted.push(new BN((await latestTime()).toString()))

      for (let i = 1; i < totalStaked.length; i++) {
        await increaseTimeTo(defaultStartTime.add(new BN(i).mul(new BN(1000))))
        await stakingContract.stakeFor(
          accounts[i],
          totalStaked[i],
          accounts[i - 1],
          { from: user1 }
        )
        timesWhenSubmitted.push(new BN((await latestTime()).toString()))
      }

      const result = await stakingContract.getTopRanksTuples()
      const addresses = accounts
        .slice(0, totalStaked.length)
        .map(user => new BN(user.slice(2), 16))

      listShouldEqualExpected({
        result,
        addresses,
        totalStaked,
        timesWhenSubmitted,
      })
    })

    it('correctly updates adding more stake for last rank', async () => {
      const totalStaked = [
        new BN(6000),
        new BN(5000),
        new BN(4000),
        new BN(3000),
        new BN(2000),
        new BN(1000),
      ]
      const smallStake = new BN(600)

      await increaseTimeTo(defaultStartTime)
      await stakingContract.stakeFor(user1, totalStaked[0], HEAD)

      for (let i = 1; i < totalStaked.length; i++) {
        await increaseTimeTo(defaultStartTime.add(new BN(i).mul(new BN(1000))))
        await stakingContract.stakeFor(
          accounts[i],
          totalStaked[i],
          accounts[i - 1],
          { from: user1 }
        )
      }

      const topRanks1 = await stakingContract.getTopRanksTuples()
      const result1 = topRanks1[topRanks1.length - 3]

      await increaseTimeTo(defaultEndTime.sub(new BN(1000)))
      await stakingContract.stakeFor(accounts[6], smallStake, accounts[5])
      const topRanks2 = await stakingContract.getTopRanksTuples()
      const result2 = topRanks2[topRanks2.length - 3]

      await stakingContract.stakeFor(accounts[6], smallStake, accounts[5])
      const topRanks3 = await stakingContract.getTopRanksTuples()
      const result3 = topRanks3[topRanks3.length - 3]

      expect(result1).to.be.bignumber.equal(new BN(accounts[5].slice(2), 16))
      expect(result2).to.be.bignumber.equal(new BN(accounts[6].slice(2), 16))
      expect(result3).to.be.bignumber.equal(new BN(accounts[6].slice(2), 16))
    })

    it('correctly inserts into top ranks for nodes already in the top ranks', async () => {
      const totalStaked = [
        new BN(6000),
        new BN(5000),
        new BN(4000),
        new BN(3000),
        new BN(2000),
        new BN(1000),
      ]
      const timesWhenSubmitted = []

      await increaseTimeTo(defaultStartTime)
      await stakingContract.stakeFor(user1, totalStaked[0], HEAD)
      timesWhenSubmitted.push(new BN((await latestTime()).toString()))

      const initialStake = new BN(10)
      await stakingContract.stakeFor(accounts[2], initialStake, user1)
      const timeWhenSubmittedFirst = new BN((await latestTime()).toString())

      for (let i = 1; i < totalStaked.length; i++) {
        await increaseTimeTo(defaultStartTime.add(new BN(i).mul(new BN(1000))))
        await stakingContract.stakeFor(
          accounts[i],
          totalStaked[i],
          accounts[i - 1],
          { from: user1 }
        )
        timesWhenSubmitted.push(new BN((await latestTime()).toString()))
      }

      const result = await stakingContract.getTopRanksTuples()
      const addresses = accounts
        .slice(0, totalStaked.length)
        .map(user => new BN(user.slice(2), 16))

      listShouldEqualExpected({
        result: [...result.slice(0, 6), ...result.slice(9)],
        addresses: [...addresses.slice(0, 2), ...addresses.slice(3)],
        totalStaked: [...totalStaked.slice(0, 2), ...totalStaked.slice(3)],
        timesWhenSubmitted: [
          ...timesWhenSubmitted.slice(0, 2),
          ...timesWhenSubmitted.slice(3),
        ],
      })

      const points1WithoutTimeAdvanced = computeStakingPoints({
        amount: initialStake,
        timeWhenSubmitted: timeWhenSubmittedFirst,
        timeAdvanced: false,
      })
      const points1WithTimeAdvanced = computeStakingPoints({
        amount: initialStake,
        timeWhenSubmitted: timeWhenSubmittedFirst,
        timeAdvanced: true,
      })
      const points2WithoutTimeAdvanced = computeStakingPoints({
        amount: totalStaked[2],
        timeWhenSubmitted: timesWhenSubmitted[2],
        timeAdvanced: false,
      })
      const points2WithTimeAdvanced = computeStakingPoints({
        amount: totalStaked[2],
        timeWhenSubmitted: timesWhenSubmitted[2],
        timeAdvanced: true,
      })

      expect(result[7]).to.be.bignumber.at.least(
        points1WithoutTimeAdvanced.add(points2WithoutTimeAdvanced),
        'Staking points should match computed staking points!'
      )
      expect(result[7]).to.be.bignumber.at.most(
        points1WithTimeAdvanced.add(points2WithTimeAdvanced),
        'Staking points should match computed staking points!'
      )
    })
  })

  describe('when there is a sorted top ranking', async () => {
    let timesWhenSubmitted, totalStaked

    beforeEach(async () => {
      totalStaked = [
        new BN(100000),
        new BN(10000),
        new BN(1000),
        new BN(100),
        new BN(10),
      ]
      timesWhenSubmitted = []

      await increaseTimeTo(defaultStartTime)
      await stakingContract.stakeFor(user1, totalStaked[4], HEAD)
      timesWhenSubmitted.push(new BN((await latestTime()).toString()))

      for (let i = 1; i < totalStaked.length; i++) {
        await increaseTimeTo(defaultStartTime.add(new BN(i).mul(new BN(5))))
        await stakingContract.stakeFor(
          accounts[i],
          totalStaked[4 - i],
          accounts[i - 1],
          { from: user1 }
        )
        timesWhenSubmitted.push(new BN((await latestTime()).toString()))
      }
    })

    it('reverts when not passing reference node for already inserted node', async () => {
      await defaultWhitelist.removeManyFromWhitelist([accounts[8]])

      await expectRevert(
        stakingContract.stakeFor(user1, 100, HEAD),
        'User is already in topRanks, you need to pass a reference node!'
      )
    })

    it('computeStakingPoints returns correct new staking points', async () => {
      const newAmount = new BN(1000)
      const newStakingPoints = await stakingContract.computeStakingPoints(
        user1,
        newAmount
      )

      const oldStakingPointsMost = computeStakingPoints({
        amount: totalStaked[4],
        timeWhenSubmitted: timesWhenSubmitted[0],
        timeAdvanced: true,
      })
      const addedStakingPointsMost = computeStakingPoints({
        amount: newAmount,
        timeWhenSubmitted: new BN((await latestTime()).toString()),
        timeAdvanced: true,
      })
      const expectedTotalNewPointsMost = oldStakingPointsMost.add(
        addedStakingPointsMost
      )

      const oldStakingPointsLeast = computeStakingPoints({
        amount: totalStaked[4],
        timeWhenSubmitted: timesWhenSubmitted[0],
        timeAdvanced: false,
      })
      const addedStakingPointsLeast = computeStakingPoints({
        amount: newAmount,
        timeWhenSubmitted: new BN((await latestTime()).toString()),
        timeAdvanced: false,
      })
      const expectedTotalNewPointsLeast = oldStakingPointsLeast.add(
        addedStakingPointsLeast
      )

      expect(newStakingPoints).to.be.bignumber.at.most(
        expectedTotalNewPointsMost
      )
      expect(newStakingPoints).to.be.bignumber.at.least(
        expectedTotalNewPointsLeast
      )
    })

    it('getSortedSpotForPointsForUser returns correct reference node', async () => {
      const result = await stakingContract.getTopRanksTuples()
      const rcvStakingPoints = []

      result.forEach((e, i) => {
        if (!(i % 3)) {
          rcvStakingPoints.push(result[i + 1].toNumber())
        }
      })
      const spots = [
        await stakingContract.getSortedSpotForPointsForUser(
          rcvStakingPoints[0] + 20,
          accounts[rcvStakingPoints.length - 1]
        ),
      ]

      for (let i = 0; i < rcvStakingPoints.length; i++) {
        spots.push(
          await stakingContract.getSortedSpotForPointsForUser(
            rcvStakingPoints[i] - 20,
            accounts[rcvStakingPoints.length - 1]
          )
        )
      }

      spots.should.eql([
        accounts[totalStaked.length - 2],
        accounts[totalStaked.length - 2],
        ...accounts.slice(0, totalStaked.length - 1).reverse(),
      ])
    })

    it('getSortedSpotForNewStakeForUser returns correct reference node', async () => {
      const spots = []

      for (let i = 0; i < totalStaked.length; i++) {
        spots.push(
          await stakingContract.getSortedSpotForNewStakeForUser(
            100,
            accounts[i]
          )
        )
      }

      spots.should.eql([
        accounts[2],
        accounts[2],
        accounts[3],
        accounts[4],
        accounts[3],
      ])
    })

    it('getRankForUser returns correct rank', async () => {
      const isInTopRanksList = []
      const ranks = []

      for (let i = 0; i < totalStaked.length; i++) {
        const result = await stakingContract.getRankForUser(accounts[i])
        ranks.push(result[0].toNumber())
        isInTopRanksList.push(result[1])
      }

      const notInListResult = await stakingContract.getRankForUser(accounts[8])
      ranks.push(notInListResult[0].toNumber())
      isInTopRanksList.push(notInListResult[1])

      ranks.should.eql([4, 3, 2, 1, 0, 0])
      isInTopRanksList.should.eql([true, true, true, true, true, false])
    })

    it('getDiscountEstimateForPointsForUser returns correct rank', async () => {
      const discounts = []

      const stakingPoints = []
      const result = await stakingContract.getTopRanksTuples()
      result.forEach((_, i) =>
        !(i % 3) ? stakingPoints.push(result[i + 1]) : 0
      )

      for (let i = 0; i < totalStaked.length; i++) {
        discounts.push(
          (await stakingContract.getDiscountEstimateForPointsForUser(
            stakingPoints[i].add(new BN(5)),
            accounts[i]
          )).toNumber()
        )
      }

      discounts.push(
        (await stakingContract.getDiscountEstimateForPointsForUser(
          1,
          accounts[9]
        )).toNumber()
      )

      for (let i = 5; i < 10; i++) {
        const oneRankAbove = await stakingContract.getSortedSpotForNewStakeForUser(
          100,
          accounts[i]
        )

        await stakingContract.stakeFor(accounts[i], 100, oneRankAbove, {
          from: user1,
        })
      }

      const notInListAddress = '0x9F7982c7E7B87abF344ade8cCA4105fc56C319DE'

      discounts.push(
        (await stakingContract.getDiscountEstimateForPointsForUser(
          1,
          notInListAddress
        )).toNumber()
      )

      const expectedDiscountsForInList = [0, 1, 2, 3, 4, 5].map(rank =>
        defaultMaxDiscountPer1000
          .sub(defaultDeclinePerRankPer1000.mul(new BN(rank)))
          .toNumber()
      )
      const expectedDiscountForNotInList = [0]

      discounts.should.eql([
        ...expectedDiscountsForInList,
        ...expectedDiscountForNotInList,
      ])
    })
  })

  describe('when reading the top ranks with respective staking points and total staked', async () => {
    const arrayFromIndices = (array, indices) => {
      const newArray = []

      for (let i = 0; i < indices.length; i++) {
        newArray.push(array[indices[i]])
      }

      return newArray
    }

    it('returns the correct flat list of tuples', async () => {
      const totalStaked = [
        new BN(500),
        new BN(74444),
        new BN(1),
        new BN(9999),
        new BN(100000),
        new BN(44),
      ]
      const timesWhenSubmitted = []

      await increaseTimeTo(defaultStartTime)
      await stakingContract.stakeFor(user1, totalStaked[0], HEAD)
      timesWhenSubmitted.push(new BN((await latestTime()).toString()))

      await increaseTimeTo(defaultStartTime.add(new BN(5000)))
      await stakingContract.stakeFor(user2, totalStaked[1], user1)
      timesWhenSubmitted.push(new BN((await latestTime()).toString()))

      await increaseTimeTo(defaultEndTime.sub(new BN(999)))
      await stakingContract.stakeFor(user3, totalStaked[2], user1)
      timesWhenSubmitted.push(new BN((await latestTime()).toString()))

      await increaseTimeTo(defaultEndTime.sub(new BN(444)))
      await stakingContract.stakeFor(user4, totalStaked[3], user1)
      timesWhenSubmitted.push(new BN((await latestTime()).toString()))

      await increaseTimeTo(defaultEndTime.sub(new BN(84)))
      await stakingContract.stakeFor(user5, totalStaked[4], user1)
      timesWhenSubmitted.push(new BN((await latestTime()).toString()))

      await increaseTimeTo(defaultEndTime.sub(new BN(10)))
      await stakingContract.stakeFor(user6, totalStaked[5], user3)
      timesWhenSubmitted.push(new BN((await latestTime()).toString()))

      const result = await stakingContract.getTopRanksTuples()
      const expectedRankingIndices = [1, 0, 4, 3, 2, 5]

      const addresses = arrayFromIndices(accounts, expectedRankingIndices).map(
        user => new BN(user.slice(2), 16)
      )
      const sortedTimesWhenSubmitted = arrayFromIndices(
        timesWhenSubmitted,
        expectedRankingIndices
      )
      const sortedTotalStaked = arrayFromIndices(
        totalStaked,
        expectedRankingIndices
      )

      listShouldEqualExpected({
        result,
        addresses,
        totalStaked: sortedTotalStaked,
        timesWhenSubmitted: sortedTimesWhenSubmitted,
      })
    })
  })

  describe('when withdrawing funds', () => {
    const computeExpectedBalance = ({
      decimalCorrectionFactor,
      declinePerRankPer1000,
      maxDiscountPer1000,
      rank,
      stakedAmount,
      starEthRate,
      targetRateInEth,
    }) => {
      const baselineTokens = stakedAmount
        .mul(targetRateInEth)
        .mul(starEthRate)
        .div(decimalCorrectionFactor)
      const discountPer1000 =
        rank > 0
          ? maxDiscountPer1000.sub(
              declinePerRankPer1000.mul(rank.sub(new BN(1)))
            )
          : new BN(0)
      const bonusTokens = baselineTokens.mul(discountPer1000).div(new BN(1000))

      return baselineTokens.add(bonusTokens)
    }

    it('transfers tokens to user', async () => {
      const user1StakedAmount = new BN(1500)

      await increaseTimeTo(defaultStartTime)
      await stakingContract.stakeFor(user1, user1StakedAmount, HEAD)
      await increaseTimeTo(defaultEndTime.add(duration.seconds(100)))
      const saleBalanceBefore = await tokenOnSale.balanceOf(
        stakingContract.address
      )

      await stakingContract.withdrawAllReceivedTokens({ from: user1 })

      const saleBalanceAfter = await tokenOnSale.balanceOf(
        stakingContract.address
      )
      const tokenBalance = await tokenOnSale.balanceOf(user1)

      const expectedTokenBalance = computeExpectedBalance({
        decimalCorrectionFactor: defaultStarEthRateDecimalCorrectionFactor,
        declinePerRankPer1000: defaultDeclinePerRankPer1000,
        maxDiscountPer1000: defaultMaxDiscountPer1000,
        rank: new BN(1),
        stakedAmount: user1StakedAmount,
        starEthRate: defaultStarEthRate,
        targetRateInEth: defaultTargetRateInEth,
      })

      expect(saleBalanceAfter).to.be.bignumber.equal(
        saleBalanceBefore.sub(expectedTokenBalance)
      )
      expect(tokenBalance).to.be.bignumber.equal(expectedTokenBalance)
    })

    describe('when staking given different STAR/ETH rates', async () => {
      describe('with STAR/ETH rate of 10 STAR = 1 ETH', async () => {
        const user1StakedAmount = new BN(1500)
        const starEthRate = new BN(1)
        const starEthRateDecimalCorrectionFactor = new BN(10)

        beforeEach(async () => {
          const starEthRateAddress = (await StarEthRate.new(
            starEthRateDecimalCorrectionFactor,
            starEthRate
          )).address
          await deployStakingContract({ starEthRateAddress })

          await increaseTimeTo(defaultStartTime)
          await stakingContract.stakeFor(user1, user1StakedAmount, HEAD)
          await increaseTimeTo(defaultEndTime.add(duration.seconds(100)))
          await stakingContract.withdrawAllReceivedTokens({ from: user1 })
        })

        it('gives 10 times less tokens for staking compared to target rate', async () => {
          const tokenBalance = await tokenOnSale.balanceOf(user1)

          const expectedTokenBalance = computeExpectedBalance({
            decimalCorrectionFactor: starEthRateDecimalCorrectionFactor,
            declinePerRankPer1000: defaultDeclinePerRankPer1000,
            maxDiscountPer1000: defaultMaxDiscountPer1000,
            rank: new BN(1),
            stakedAmount: user1StakedAmount,
            starEthRate,
            targetRateInEth: defaultTargetRateInEth,
          })

          expect(tokenBalance).to.be.bignumber.equal(expectedTokenBalance)
        })
      })

      describe('with STAR/ETH rate of 3,000,000 STAR = 50 ETH', async () => {
        const user1StakedAmount = new BN(1500)
        const starEthRate = new BN(50)
        const starEthRateDecimalCorrectionFactor = new BN(3000000)

        beforeEach(async () => {
          const starEthRateAddress = (await StarEthRate.new(
            starEthRateDecimalCorrectionFactor,
            starEthRate
          )).address
          await deployStakingContract({ starEthRateAddress })

          await increaseTimeTo(defaultStartTime)
          await stakingContract.stakeFor(user1, user1StakedAmount, HEAD)
          await increaseTimeTo(defaultEndTime.add(duration.seconds(100)))
          await stakingContract.withdrawAllReceivedTokens({ from: user1 })
        })

        it('gives 60,000 times less tokens for staking compared to target rate', async () => {
          const tokenBalance = await tokenOnSale.balanceOf(user1)

          const expectedTokenBalance = computeExpectedBalance({
            decimalCorrectionFactor: starEthRateDecimalCorrectionFactor,
            declinePerRankPer1000: defaultDeclinePerRankPer1000,
            maxDiscountPer1000: defaultMaxDiscountPer1000,
            rank: new BN(1),
            stakedAmount: user1StakedAmount,
            starEthRate,
            targetRateInEth: defaultTargetRateInEth,
          })

          expect(tokenBalance).to.be.bignumber.equal(expectedTokenBalance)
        })
      })

      describe('with STAR/ETH rate of 1 STAR = 1 ETH', async () => {
        const user1StakedAmount = new BN(1500)
        const starEthRate = new BN(100)
        const starEthRateDecimalCorrectionFactor = new BN(100)

        beforeEach(async () => {
          const starEthRateAddress = (await StarEthRate.new(
            starEthRateDecimalCorrectionFactor,
            starEthRate
          )).address
          await deployStakingContract({ starEthRateAddress })

          await increaseTimeTo(defaultStartTime)
          await stakingContract.stakeFor(user1, user1StakedAmount, HEAD)
          await increaseTimeTo(defaultEndTime.add(duration.seconds(100)))
          await stakingContract.withdrawAllReceivedTokens({ from: user1 })
        })

        it('gives the same amount of tokens as target rate', async () => {
          const tokenBalance = await tokenOnSale.balanceOf(user1)

          const expectedTokenBalance = computeExpectedBalance({
            decimalCorrectionFactor: starEthRateDecimalCorrectionFactor,
            declinePerRankPer1000: defaultDeclinePerRankPer1000,
            maxDiscountPer1000: defaultMaxDiscountPer1000,
            rank: new BN(1),
            stakedAmount: user1StakedAmount,
            starEthRate,
            targetRateInEth: defaultTargetRateInEth,
          })

          expect(tokenBalance).to.be.bignumber.equal(expectedTokenBalance)
        })
      })

      describe('when STAR is worth less than 1 project token', async () => {
        const user1StakedAmount = new BN(1500)
        const starEthRate = new BN(1)
        const starEthRateDecimalCorrectionFactor = new BN(10000)

        beforeEach(async () => {
          const starEthRateAddress = (await StarEthRate.new(
            starEthRateDecimalCorrectionFactor,
            starEthRate
          )).address
          await deployStakingContract({ starEthRateAddress })

          await increaseTimeTo(defaultStartTime)
          await stakingContract.stakeFor(user1, user1StakedAmount, HEAD)
          await increaseTimeTo(defaultEndTime.add(duration.seconds(100)))
          await stakingContract.withdrawAllReceivedTokens({ from: user1 })
        })

        it('gives less tokens than STAR used for staking', async () => {
          const tokenBalance = await tokenOnSale.balanceOf(user1)

          const expectedTokenBalance = computeExpectedBalance({
            decimalCorrectionFactor: starEthRateDecimalCorrectionFactor,
            declinePerRankPer1000: defaultDeclinePerRankPer1000,
            maxDiscountPer1000: defaultMaxDiscountPer1000,
            rank: new BN(1),
            stakedAmount: user1StakedAmount,
            starEthRate,
            targetRateInEth: defaultTargetRateInEth,
          })

          expect(tokenBalance).to.be.bignumber.equal(expectedTokenBalance)
        })
      })
    })

    describe('when staking given different top rank discounts', async () => {
      describe('when given a high max discount and high decline per rank', async () => {
        const user1StakedAmount = new BN(1500)
        const user2StakedAmount = new BN(1100)
        const user3StakedAmount = new BN(666)
        const maxDiscountPer1000 = new BN(5000)
        const declinePerRankPer1000 = new BN(500)

        beforeEach(async () => {
          await deployStakingContract({
            declinePerRankPer1000,
            maxDiscountPer1000,
          })

          await increaseTimeTo(defaultStartTime)
          await stakingContract.stakeFor(user1, user1StakedAmount, HEAD)
          await stakingContract.stakeFor(user2, user2StakedAmount, user1)
          await stakingContract.stakeFor(user3, user3StakedAmount, user2)
          await increaseTimeTo(defaultEndTime.add(duration.seconds(100)))
          await stakingContract.withdrawAllReceivedTokens({ from: user3 })
        })

        it('transfers the correct amount of tokens', async () => {
          const tokenBalance = await tokenOnSale.balanceOf(user3)

          const expectedTokenBalance = computeExpectedBalance({
            decimalCorrectionFactor: defaultStarEthRateDecimalCorrectionFactor,
            declinePerRankPer1000,
            maxDiscountPer1000,
            rank: new BN(3),
            stakedAmount: user3StakedAmount,
            starEthRate: defaultStarEthRate,
            targetRateInEth: defaultTargetRateInEth,
          })

          expect(tokenBalance).to.be.bignumber.equal(expectedTokenBalance)
        })
      })

      describe('when given a high max discount and low decline per rank', async () => {
        const user1StakedAmount = new BN(1500)
        const user2StakedAmount = new BN(1100)
        const user3StakedAmount = new BN(666)
        const maxDiscountPer1000 = new BN(5000)
        const declinePerRankPer1000 = new BN(2)

        beforeEach(async () => {
          await deployStakingContract({
            declinePerRankPer1000,
            maxDiscountPer1000,
          })

          await increaseTimeTo(defaultStartTime)
          await stakingContract.stakeFor(user1, user1StakedAmount, HEAD)
          await stakingContract.stakeFor(user2, user2StakedAmount, user1)
          await stakingContract.stakeFor(user3, user3StakedAmount, user2)
          await increaseTimeTo(defaultEndTime.add(duration.seconds(100)))
          await stakingContract.withdrawAllReceivedTokens({ from: user3 })
        })

        it('transfers the correct amount of tokens', async () => {
          const tokenBalance = await tokenOnSale.balanceOf(user3)

          const expectedTokenBalance = computeExpectedBalance({
            decimalCorrectionFactor: defaultStarEthRateDecimalCorrectionFactor,
            declinePerRankPer1000,
            maxDiscountPer1000,
            rank: new BN(3),
            stakedAmount: user3StakedAmount,
            starEthRate: defaultStarEthRate,
            targetRateInEth: defaultTargetRateInEth,
          })

          expect(tokenBalance).to.be.bignumber.equal(expectedTokenBalance)
        })
      })

      describe('when given a low max discount and high decline per rank', async () => {
        const user1StakedAmount = new BN(1500)
        const user2StakedAmount = new BN(1100)
        const user3StakedAmount = new BN(666)
        const maxDiscountPer1000 = new BN(60)
        const declinePerRankPer1000 = new BN(20)
        const topRanksMaxSize = new BN(3)

        beforeEach(async () => {
          await deployStakingContract({
            declinePerRankPer1000,
            maxDiscountPer1000,
            topRanksMaxSize,
          })

          await increaseTimeTo(defaultStartTime)
          await stakingContract.stakeFor(user1, user1StakedAmount, HEAD)
          await stakingContract.stakeFor(user2, user2StakedAmount, user1)
          await stakingContract.stakeFor(user3, user3StakedAmount, user2)
          await increaseTimeTo(defaultEndTime.add(duration.seconds(100)))
          await stakingContract.withdrawAllReceivedTokens({ from: user3 })
        })

        it('transfers the correct amount of tokens', async () => {
          const tokenBalance = await tokenOnSale.balanceOf(user3)

          const expectedTokenBalance = computeExpectedBalance({
            decimalCorrectionFactor: defaultStarEthRateDecimalCorrectionFactor,
            declinePerRankPer1000,
            maxDiscountPer1000,
            rank: new BN(3),
            stakedAmount: user3StakedAmount,
            starEthRate: defaultStarEthRate,
            targetRateInEth: defaultTargetRateInEth,
          })

          expect(tokenBalance).to.be.bignumber.equal(expectedTokenBalance)
        })
      })

      describe('when given a low max discount and low decline per rank', async () => {
        const user1StakedAmount = new BN(1500)
        const user2StakedAmount = new BN(1100)
        const user3StakedAmount = new BN(666)
        const maxDiscountPer1000 = new BN(5)
        const declinePerRankPer1000 = new BN(1)
        const topRanksMaxSize = new BN(3)

        beforeEach(async () => {
          await deployStakingContract({
            declinePerRankPer1000,
            maxDiscountPer1000,
            topRanksMaxSize,
          })

          await increaseTimeTo(defaultStartTime)
          await stakingContract.stakeFor(user1, user1StakedAmount, HEAD)
          await stakingContract.stakeFor(user2, user2StakedAmount, user1)
          await stakingContract.stakeFor(user3, user3StakedAmount, user2)
          await increaseTimeTo(defaultEndTime.add(duration.seconds(100)))
          await stakingContract.withdrawAllReceivedTokens({ from: user3 })
        })

        it('transfers the correct amount of tokens', async () => {
          const tokenBalance = await tokenOnSale.balanceOf(user3)

          const expectedTokenBalance = computeExpectedBalance({
            decimalCorrectionFactor: defaultStarEthRateDecimalCorrectionFactor,
            declinePerRankPer1000,
            maxDiscountPer1000,
            rank: new BN(3),
            stakedAmount: user3StakedAmount,
            starEthRate: defaultStarEthRate,
            targetRateInEth: defaultTargetRateInEth,
          })

          expect(tokenBalance).to.be.bignumber.equal(expectedTokenBalance)
        })
      })
    })

    describe('when staking given different target rates', async () => {
      describe('when given a high target rate', async () => {
        const user1StakedAmount = new BN(1500)
        const targetRateInEth = new BN(2000000)

        beforeEach(async () => {
          await deployStakingContract({ targetRateInEth })

          await increaseTimeTo(defaultStartTime)
          await stakingContract.stakeFor(user1, user1StakedAmount, HEAD)
          await increaseTimeTo(defaultEndTime.add(duration.seconds(100)))
          await stakingContract.withdrawAllReceivedTokens({ from: user1 })
        })

        it('transfers the correct amount of tokens', async () => {
          const tokenBalance = await tokenOnSale.balanceOf(user1)

          const expectedTokenBalance = computeExpectedBalance({
            decimalCorrectionFactor: defaultStarEthRateDecimalCorrectionFactor,
            declinePerRankPer1000: defaultDeclinePerRankPer1000,
            maxDiscountPer1000: defaultMaxDiscountPer1000,
            rank: new BN(1),
            stakedAmount: user1StakedAmount,
            starEthRate: defaultStarEthRate,
            targetRateInEth,
          })

          expect(tokenBalance).to.be.bignumber.equal(expectedTokenBalance)
        })
      })

      describe('when given a low target rate', async () => {
        const user1StakedAmount = new BN(1500)
        const targetRateInEth = new BN(1)

        beforeEach(async () => {
          await deployStakingContract({ targetRateInEth })

          await increaseTimeTo(defaultStartTime)
          await stakingContract.stakeFor(user1, user1StakedAmount, HEAD)
          await increaseTimeTo(defaultEndTime.add(duration.seconds(100)))
          await stakingContract.withdrawAllReceivedTokens({ from: user1 })
        })

        it('transfers the correct amount of tokens', async () => {
          const tokenBalance = await tokenOnSale.balanceOf(user1)

          const expectedTokenBalance = computeExpectedBalance({
            decimalCorrectionFactor: defaultStarEthRateDecimalCorrectionFactor,
            declinePerRankPer1000: defaultDeclinePerRankPer1000,
            maxDiscountPer1000: defaultMaxDiscountPer1000,
            rank: new BN(1),
            stakedAmount: user1StakedAmount,
            starEthRate: defaultStarEthRate,
            targetRateInEth,
          })

          expect(tokenBalance).to.be.bignumber.equal(expectedTokenBalance)
        })
      })
    })

    it('transfers bought tokens and bonus', async () => {
      const user1StakedAmount = new BN(1500)

      await increaseTimeTo(defaultStartTime)
      await stakingContract.stakeFor(user1, user1StakedAmount, HEAD)
      await stakingContract.stakeFor(user2, new BN(1000), user1)
      await increaseTimeTo(defaultEndTime.add(duration.seconds(100)))

      await stakingContract.withdrawAllReceivedTokens({ from: user1 })

      const user1TokenBalance = await tokenOnSale.balanceOf(user1)
      const user2TokenBalance = await tokenOnSale.balanceOf(user2)

      const expectedUser1TokenBalance = computeExpectedBalance({
        decimalCorrectionFactor: defaultStarEthRateDecimalCorrectionFactor,
        declinePerRankPer1000: defaultDeclinePerRankPer1000,
        maxDiscountPer1000: defaultMaxDiscountPer1000,
        rank: new BN(1),
        stakedAmount: user1StakedAmount,
        starEthRate: defaultStarEthRate,
        targetRateInEth: defaultTargetRateInEth,
      })

      expect(user1TokenBalance).to.be.bignumber.equal(expectedUser1TokenBalance)
      expect(user2TokenBalance).to.be.bignumber.equal(new BN(0))
    })

    it('transfers less tokens for lower ranks', async () => {
      const user1StakedAmount = new BN(1500)
      const user2StakedAmount = new BN(1400)
      const user3StakedAmount = new BN(1300)
      const user4StakedAmount = new BN(1200)

      await increaseTimeTo(defaultStartTime)
      await stakingContract.stakeFor(user1, user1StakedAmount, HEAD)
      await stakingContract.stakeFor(user2, user2StakedAmount, user1)
      await stakingContract.stakeFor(user3, user3StakedAmount, user2)
      await stakingContract.stakeFor(user4, user4StakedAmount, user3)
      await increaseTimeTo(defaultEndTime.add(duration.seconds(100)))

      await stakingContract.withdrawAllReceivedTokens({ from: user2 })
      await stakingContract.withdrawAllReceivedTokens({ from: user3 })
      await stakingContract.withdrawAllReceivedTokens({ from: user4 })

      const user2TokenBalance = await tokenOnSale.balanceOf(user2)
      const user3TokenBalance = await tokenOnSale.balanceOf(user3)
      const user4TokenBalance = await tokenOnSale.balanceOf(user4)

      const expectedUser2TokenBalance = computeExpectedBalance({
        decimalCorrectionFactor: defaultStarEthRateDecimalCorrectionFactor,
        declinePerRankPer1000: defaultDeclinePerRankPer1000,
        maxDiscountPer1000: defaultMaxDiscountPer1000,
        rank: new BN(2),
        stakedAmount: user2StakedAmount,
        starEthRate: defaultStarEthRate,
        targetRateInEth: defaultTargetRateInEth,
      })

      const expectedUser3TokenBalance = computeExpectedBalance({
        decimalCorrectionFactor: defaultStarEthRateDecimalCorrectionFactor,
        declinePerRankPer1000: defaultDeclinePerRankPer1000,
        maxDiscountPer1000: defaultMaxDiscountPer1000,
        rank: new BN(3),
        stakedAmount: user3StakedAmount,
        starEthRate: defaultStarEthRate,
        targetRateInEth: defaultTargetRateInEth,
      })

      const expectedUser4TokenBalance = computeExpectedBalance({
        decimalCorrectionFactor: defaultStarEthRateDecimalCorrectionFactor,
        declinePerRankPer1000: defaultDeclinePerRankPer1000,
        maxDiscountPer1000: defaultMaxDiscountPer1000,
        rank: new BN(4),
        stakedAmount: user4StakedAmount,
        starEthRate: defaultStarEthRate,
        targetRateInEth: defaultTargetRateInEth,
      })

      expect(user2TokenBalance).to.be.bignumber.equal(expectedUser2TokenBalance)
      expect(user3TokenBalance).to.be.bignumber.equal(expectedUser3TokenBalance)
      expect(user4TokenBalance).to.be.bignumber.equal(expectedUser4TokenBalance)
    })

    it('transfers no bonus tokens for users not in top ranks', async () => {
      const user1StakedAmount = new BN(1500)
      const user2StakedAmount = new BN(1100)
      const user3StakedAmount = new BN(666)
      const topRanksMaxSize = new BN(2)

      await deployStakingContract({ topRanksMaxSize })

      await increaseTimeTo(defaultStartTime)
      await stakingContract.stakeFor(user1, user1StakedAmount, HEAD)
      await stakingContract.stakeFor(user2, user2StakedAmount, user1)
      await stakingContract.stakeFor(user3, user3StakedAmount, user2)
      await increaseTimeTo(defaultEndTime.add(duration.seconds(100)))
      await stakingContract.withdrawAllReceivedTokens({ from: user3 })

      const tokenBalance = await tokenOnSale.balanceOf(user3)

      const expectedTokenBalance = computeExpectedBalance({
        decimalCorrectionFactor: defaultStarEthRateDecimalCorrectionFactor,
        declinePerRankPer1000: defaultDeclinePerRankPer1000,
        maxDiscountPer1000: defaultMaxDiscountPer1000,
        rank: undefined,
        stakedAmount: user3StakedAmount,
        starEthRate: defaultStarEthRate,
        targetRateInEth: defaultTargetRateInEth,
      })

      expect(tokenBalance).to.be.bignumber.equal(expectedTokenBalance)
    })

    it('reverts when trying to withdraw more than once', async () => {
      await increaseTimeTo(defaultStartTime)
      await stakingContract.stakeFor(user1, new BN(1500), HEAD)
      await stakingContract.stakeFor(user2, new BN(1000), user1)
      await increaseTimeTo(defaultEndTime.add(duration.seconds(100)))

      await stakingContract.withdrawAllReceivedTokens({ from: user1 })

      try {
        await stakingContract.withdrawAllReceivedTokens({ from: user1 })
        assert.fail()
      } catch (error) {
        const expectedError = 'User has already withdrawn tokens!'
        ensuresException(error, expectedError)
      }
    })

    describe('when withdrawing remaining tokens', async () => {
      beforeEach(async () => {
        await increaseTimeTo(defaultStartTime)
        await stakingContract.stakeFor(user1, new BN(1500), HEAD)
        await increaseTimeTo(defaultEndTime.add(duration.days(59)))
      })

      describe('when claim period is not yet finished', async () => {
        it('reverts the transaction', async () => {
          await expectRevert(
            stakingContract.withdrawTokens(new BN(100)),
            'Claim period is not yet finished!'
          )
        })
      })

      describe('when claim period is finished', async () => {
        beforeEach(async () => {
          await increaseTimeTo(defaultEndTime.add(duration.days(61)))
        })

        describe('when not called by owner', async () => {
          it('reverts the transaction', async () => {
            await expectRevert(
              stakingContract.withdrawTokens(new BN(100), { from: user2 }),
              'Only owner is able call this function!'
            )
          })
        })

        it('withdraws requested amount of tokens', async () => {
          const requestedTokens = new BN(100)
          const ownerBalanceBefore = await tokenOnSale.balanceOf(user1)
          const saleBalanceBefore = await tokenOnSale.balanceOf(
            stakingContract.address
          )

          await stakingContract.withdrawTokens(requestedTokens, {
            from: user1,
          })

          const ownerBalanceAfter = await tokenOnSale.balanceOf(user1)
          const saleBalanceAfter = await tokenOnSale.balanceOf(
            stakingContract.address
          )

          expect(saleBalanceAfter).to.be.bignumber.equal(
            saleBalanceBefore.sub(requestedTokens)
          )
          expect(ownerBalanceAfter).to.be.bignumber.equal(
            ownerBalanceBefore.add(requestedTokens)
          )
        })
      })
    })
  })
})
