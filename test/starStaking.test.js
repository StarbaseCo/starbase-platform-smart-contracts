const BigNumber = web3.BigNumber

const StarStaking = artifacts.require('StarStaking.sol')
const MintableToken = artifacts.require('MintableToken.sol')
const StarEthRate = artifacts.require('./StarEthRate.sol')

const { should, ensuresException } = require('./helpers/utils')
const { increaseTimeTo, latestTime } = require('./helpers/timer')

const HEAD = '0x0000000000000000000000000000000000000000'
const BALANCES = [1, 60000, 99999999].map(n => new BigNumber(n))

BigNumber.config({ DECIMAL_PLACES: 0 })

contract('StarStaking', accounts => {
  const [user1, user2, user3, user4, user5, user6, defaultWallet] = accounts
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
    defaultStarEthRate

  beforeEach(async () => {
    initialBalance = new BigNumber(10000).times(new BigNumber(1e18))
    starToken = await MintableToken.new()
    tokenOnSale = await MintableToken.new()

    defaultStartTime = new BigNumber(latestTime().toString()).plus(10000)
    defaultEndTime = defaultStartTime.plus(200000)

    defaultTargetRateInEth = new BigNumber(2000) // 2000 tokens per ETH
    defaultMaxDiscountPer1000 = new BigNumber(500) // = 50%
    defaultDeclinePerRankPer1000 = new BigNumber(5) // = 0.5%

    defaultTopRanksMaxSize = new BigNumber(10)
    defaultStakeSaleCap = new BigNumber(1000)
    defaultMaxStakePerUser = new BigNumber(600)

    defaultStarEthRate = new BigNumber(2) // 2/10 STAR = 1 ETH
    defaultStarEthRateDecimalCorrectionFactor = new BigNumber(10)

    starEthRate = await StarEthRate.new(
      defaultStarEthRateDecimalCorrectionFactor,
      defaultStarEthRate
    )

    stakingContract = await StarStaking.new(
      starEthRate.address,
      starToken.address,
      tokenOnSale.address,
      defaultStartTime,
      defaultEndTime,
      defaultTopRanksMaxSize,
      defaultTargetRateInEth,
      defaultMaxDiscountPer1000,
      defaultDeclinePerRankPer1000,
      defaultStakeSaleCap,
      defaultMaxStakePerUser,
      defaultWallet
    )

    await starToken.mint(user1, initialBalance)
    await tokenOnSale.mint(stakingContract.address, initialBalance)
    await starToken.approve(stakingContract.address, initialBalance, {
      from: user1,
    })
  })

  const deployStakingContract = async ({
    starEthRateAddress = starEthRate.address,
    starTokenAddress = starToken.address,
    tokenOnSaleAddress = tokenOnSale.address,
    startTime = defaultStartTime,
    endTime = defaultEndTime,
    topRanksMaxSize = defaultTopRanksMaxSize,
    targetRateInEth = defaultTargetRateInEth,
    maxDiscountPer1000 = defaultMaxDiscountPer1000,
    declinePerRankPer1000 = defaultDeclinePerRankPer1000,
    stakeSaleCap = defaultStakeSaleCap,
    maxStakePerUser = defaultMaxStakePerUser,
    wallet = defaultWallet,
  } = {}) => {
    stakingContract = await StarStaking.new(
      starEthRateAddress,
      starTokenAddress,
      tokenOnSaleAddress,
      startTime,
      endTime,
      topRanksMaxSize,
      targetRateInEth,
      maxDiscountPer1000,
      declinePerRankPer1000,
      stakeSaleCap,
      maxStakePerUser,
      wallet
    )
    await starToken.mint(user1, initialBalance)
    await tokenOnSale.mint(stakingContract.address, initialBalance)
    await starToken.approve(stakingContract.address, initialBalance, {
      from: user1,
    })
  }

  describe('when deploying the contract', () => {
    const itFailsToDeployContract = async ({
      starEthRateAddress = starEthRate.address,
      starTokenAddress = starToken.address,
      tokenOnSaleAddress = tokenOnSale.address,
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
          starEthRateAddress,
          starTokenAddress,
          tokenOnSaleAddress,
          startTime,
          endTime,
          topRanksMaxSize,
          targetRateInEth,
          maxDiscountPer1000,
          declinePerRankPer1000,
          stakeSaleCap,
          maxStakePerUser,
          wallet
        )
        assert.fail()
      } catch (error) {
        ensuresException(error, expectedError)
      }

      should.equal(emptyStakingContract, undefined)
    }

    it('does NOT allow to deploy without a starEthRate address', async () => {
      await itFailsToDeployContract({
        starEthRateAddress: 0,
        expectedError: 'StarEthRate address must be defined!',
      })
    })

    it('does NOT allow to deploy without a starToken address', async () => {
      await itFailsToDeployContract({
        starTokenAddress: 0,
        expectedError: 'Star token address must be defined!',
      })
    })

    it('does NOT allow to deploy without a tokenOnSale address', async () => {
      await itFailsToDeployContract({
        tokenOnSaleAddress: 0,
        expectedError: 'Token on sale address must be defined!',
      })
    })

    it('does NOT allow to deploy with a closing time before starting time', async () => {
      await itFailsToDeployContract({
        startTime: defaultEndTime,
        endTime: defaultStartTime,
        expectedError: 'Start time must be before closing time!',
      })
    })

    it('does NOT allow to deploy with a starting time before the current time', async () => {
      const earlyStartTime = new BigNumber(latestTime().toString()).minus(1000)
      await itFailsToDeployContract({
        startTime: earlyStartTime,
        expectedError: 'Start time must be after current time!',
      })
    })

    it('does NOT allow to deploy with a topRanksMaxSize of 0', async () => {
      await itFailsToDeployContract({
        topRanksMaxSize: 0,
        expectedError: 'Top ranks size must be more than 0!',
      })
    })

    it('does NOT allow to deploy with a targetRateInEth of 0', async () => {
      await itFailsToDeployContract({
        targetRateInEth: 0,
        expectedError: 'Target rate must be more than 0!',
      })
    })

    it('does NOT allow to deploy with a maxDiscountPer1000 of 0', async () => {
      await itFailsToDeployContract({
        maxDiscountPer1000: 0,
        expectedError: 'Max discount must be more than 0!',
      })
    })

    it('does NOT allow to deploy with a declinePerRankPer1000 of 0', async () => {
      await itFailsToDeployContract({
        declinePerRankPer1000: 0,
        expectedError: 'Decline per rank must be more than 0!',
      })
    })

    it('does NOT allow to deploy with a stakeSaleCap of 0', async () => {
      await itFailsToDeployContract({
        stakeSaleCap: 0,
        expectedError: 'StakingSale cap should be higher than 0!',
      })
    })

    it('does NOT allow to deploy with a maxStakePerUser of 0', async () => {
      await itFailsToDeployContract({
        maxStakePerUser: 0,
        expectedError: 'Max stake per user should be higher than 0!',
      })
    })

    it('does NOT allow to deploy with a maxStakePerUser higher than stakeSaleCap', async () => {
      await itFailsToDeployContract({
        maxStakePerUser: 200,
        stakeSaleCap: 100,
        expectedError:
          'Max stake per user should be smaller than StakeSale cap!',
      })
    })

    it('does NOT allow to deploy with a wallet of 0', async () => {
      await itFailsToDeployContract({
        wallet: 0,
        expectedError: 'Wallet address may must be defined!',
      })
    })

    it('does NOT allow to deploy with a max decline higher than max discount', async () => {
      await itFailsToDeployContract({
        declinePerRankPer1000: 51,
        maxDiscountPer1000: 500,
        topRanksMaxSize: 11,
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

      setTokenAddress.should.be.equal(
        starToken.address,
        'Token address not matching!'
      )
      setTokenOnSale.should.be.equal(
        tokenOnSale.address,
        'Token address not matching!'
      )
      setTopRanksMaxSize.should.be.bignumber.equal(
        defaultTopRanksMaxSize,
        'Top ranks size not matching!'
      )
      setStartTime.should.be.bignumber.equal(
        defaultStartTime,
        'Opening time not matching!'
      )
      setEndTime.should.be.bignumber.equal(
        defaultEndTime,
        'Closing time not matching!'
      )
      setStakeSaleCap.should.be.bignumber.equal(
        defaultStakeSaleCap.times(1e18),
        'Stake sale cap not matching!'
      )
      setMaxStakePerUser.should.be.bignumber.equal(
        defaultMaxStakePerUser.times(1e18),
        'Max stake per user not matching!'
      )
    })
  })

  describe('when adding to the top ranks count', () => {
    it('respects the maximum top ranks count', async () => {
      await increaseTimeTo(defaultStartTime)
      await stakingContract.stakeFor(user1, 10000, HEAD, {
        from: user1,
      })

      for (let i = 1; i < 11; i++) {
        const topRanksCount = await stakingContract.topRanksCount()
        topRanksCount.should.be.bignumber.equal(
          i,
          'Top ranks count is not incremented!'
        )
        await stakingContract.stakeFor(
          accounts[i],
          10000 - 500 * i,
          accounts[i - 1],
          { from: user1 }
        )
      }

      const topRanksCount = await stakingContract.topRanksCount()
      topRanksCount.should.be.bignumber.equal(
        10,
        'Top ranks count should not exceed maximum top ranks size!'
      )
    })
  })

  describe('when staking period is open', () => {
    beforeEach(async () => {
      await increaseTimeTo(defaultStartTime)
    })

    it('must have sufficient funds for the staking', async () => {
      await stakingContract.stakeFor(user2, 10, HEAD, {
        from: user1,
      })
      const timeWhenSubmitted = [new BigNumber(latestTime().toString())]

      try {
        await stakingContract.stakeFor(user3, 100, user2, {
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
        addresses: [new BigNumber(user2).toNumber()],
        totalStaked: [10],
        timesWhenSubmitted: timeWhenSubmitted,
      })
    })

    it('transfers tokens to the wallet when staked', async () => {
      const stakingAmount = new BigNumber(5000)

      await stakingContract.stake(stakingAmount, HEAD)
      const userBalance = await starToken.balanceOf.call(user1)
      const stakingContractBalance = await starToken.balanceOf.call(
        stakingContract.address
      )
      const walletBalance = await starToken.balanceOf.call(defaultWallet)

      userBalance.should.be.bignumber.equal(initialBalance.sub(stakingAmount))
      walletBalance.should.be.bignumber.equal(stakingAmount)
      stakingContractBalance.should.be.bignumber.equal(new BigNumber(0))
    })

    it('allows user to stake for other person', async () => {
      const stakingAmount = new BigNumber(5000)
      await stakingContract.stakeFor(user2, stakingAmount, HEAD, {
        from: user1,
      })

      const user1TotalStaked = await stakingContract.totalStakedFor.call(user2)
      user1TotalStaked.should.be.bignumber.equal(stakingAmount)
    })

    describe('when cap is reached', async () => {
      it('adds only the remaining staking tokens', async () => {
        await stakingContract.stakeFor(
          user1,
          defaultMaxStakePerUser.times(1e18),
          HEAD
        )
        await stakingContract.stakeFor(
          user2,
          defaultMaxStakePerUser.times(1e18),
          user1
        )

        const userBalance = await starToken.balanceOf.call(user1)
        const stakingContractBalance = await starToken.balanceOf.call(
          stakingContract.address
        )
        const walletBalance = await starToken.balanceOf.call(defaultWallet)
        const user2Staked = await stakingContract.totalStakedFor.call(user2)

        userBalance.should.be.bignumber.equal(
          initialBalance.minus(defaultStakeSaleCap.times(1e18))
        )
        stakingContractBalance.should.be.bignumber.equal(new BigNumber(0))
        walletBalance.should.be.bignumber.equal(defaultStakeSaleCap.times(1e18))
        user2Staked.should.be.bignumber.equal(
          defaultStakeSaleCap
            .times(1e18)
            .minus(defaultMaxStakePerUser.times(1e18))
        )
      })

      it('throws an error once cap when trying to add above cap', async () => {
        await stakingContract.stakeFor(
          user1,
          defaultMaxStakePerUser.times(1e18),
          HEAD
        )
        await stakingContract.stakeFor(
          user2,
          defaultMaxStakePerUser.times(1e18),
          user1
        )
        try {
          await stakingContract.stakeFor(
            user2,
            defaultMaxStakePerUser.times(1e18),
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

        userBalance.should.be.bignumber.equal(
          initialBalance.minus(defaultStakeSaleCap.times(1e18))
        )
        stakingContractBalance.should.be.bignumber.equal(new BigNumber(0))
        walletBalance.should.be.bignumber.equal(defaultStakeSaleCap.times(1e18))
        user2Staked.should.be.bignumber.equal(
          defaultStakeSaleCap
            .times(1e18)
            .minus(defaultMaxStakePerUser.times(1e18))
        )
      })
    })

    it('adds only the remaining staking tokens when defaultMaxStakePerUser is reached', async () => {
      await stakingContract.stake(
        defaultMaxStakePerUser.times(1e18).plus(10000),
        HEAD
      )
      const userBalance = await starToken.balanceOf.call(user1)
      const walletBalance = await starToken.balanceOf.call(defaultWallet)
      const stakingContractBalance = await starToken.balanceOf.call(
        stakingContract.address
      )

      userBalance.should.be.bignumber.equal(
        initialBalance.minus(defaultMaxStakePerUser.times(1e18))
      )
      walletBalance.should.be.bignumber.equal(
        defaultMaxStakePerUser.times(1e18)
      )
      stakingContractBalance.should.be.bignumber.equal(new BigNumber(0))
    })
  })

  function computeStakingPoints({ amount, timeWhenSubmitted, timeAdvanced }) {
    const adjustedTime = timeAdvanced
      ? timeWhenSubmitted.minus(1)
      : timeWhenSubmitted
    const timeUntilEnd = defaultEndTime.minus(adjustedTime)
    const stakingPoints = timeUntilEnd.times(amount)

    return stakingPoints
  }

  const evaluateComputation = async amount => {
    await stakingContract.stake(amount, HEAD)
    const timeWhenSubmitted = new BigNumber(latestTime())
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

    userTotalStakingPoints.should.be.bignumber.at.least(
      pointsWithoutTimeAdvanced
    )
    userTotalStakingPoints.should.be.bignumber.at.most(pointsWithTimeAdvanced)
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
            defaultStartTime.plus(defaultEndTime.minus(defaultStartTime).div(2))
          )
          evaluateComputation(balance)
        })

        it('calculates the points correctly at the end', async () => {
          await increaseTimeTo(defaultEndTime.minus(20))
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
        rcvAddrs.push(e.toNumber())
        rcvStakingPoints.push(result[i + 1])
        rcvTotalStaked.push(result[i + 2].toNumber())
      }
    })

    rcvAddrs.should.eql(addresses, 'Addresses should match user addresses!')
    rcvTotalStaked.should.eql(
      totalStaked,
      'Total amount of stake should match transferred amount!'
    )

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

      stakingPoints.should.be.bignumber.at.least(
        pointsWithoutTimeAdvanced,
        'Staking points should match computed staking points!'
      )
      stakingPoints.should.be.bignumber.at.most(
        pointsWithTimeAdvanced,
        'Staking points should match computed staking points!'
      )
    })
  }

  describe('when building the top ranks', () => {
    it('must provide an existing reference node', async () => {
      await increaseTimeTo(defaultStartTime)
      await stakingContract.stakeFor(user2, 10, HEAD, {
        from: user1,
      })
      const timeWhenSubmitted = [new BigNumber(latestTime().toString())]

      try {
        await stakingContract.stakeFor(user3, 100, user4, {
          from: user1,
        })
        assert.fail()
      } catch (error) {
        const expectedError = 'Node for suggested position does not exist!'
        ensuresException(error, expectedError)
      }

      const result = await stakingContract.getTopRanksTuples()
      listShouldEqualExpected({
        result,
        addresses: [new BigNumber(user2).toNumber()],
        totalStaked: [10],
        timesWhenSubmitted: timeWhenSubmitted,
      })
    })

    it('must provide a reference node that exists', async () => {
      await increaseTimeTo(defaultStartTime)
      await stakingContract.stakeFor(user2, 10, HEAD, {
        from: user1,
      })
      const timeWhenSubmitted = [new BigNumber(latestTime().toString())]

      try {
        await stakingContract.stakeFor(user3, 100, user4, {
          from: user1,
        })
        assert.fail()
      } catch (error) {
        const expectedError = 'Node for suggested position does not exist!'
        ensuresException(error, expectedError)
      }

      const result = await stakingContract.getTopRanksTuples()
      listShouldEqualExpected({
        result,
        addresses: [new BigNumber(user2).toNumber()],
        totalStaked: [10],
        timesWhenSubmitted: timeWhenSubmitted,
      })
    })

    it('must provide a reference node that is not equal to calling user', async () => {
      await increaseTimeTo(defaultStartTime)
      await stakingContract.stakeFor(user2, 10, HEAD, {
        from: user1,
      })
      const timeWhenSubmitted = [new BigNumber(latestTime().toString())]

      try {
        await stakingContract.stakeFor(user2, 100, user2, {
          from: user1,
        })
        assert.fail()
      } catch (error) {
        const expectedError = 'One rank above cannot be equal to inserted user!'
        ensuresException(error, expectedError)
      }

      const result = await stakingContract.getTopRanksTuples()
      listShouldEqualExpected({
        result,
        addresses: [new BigNumber(user2).toNumber()],
        totalStaked: [10],
        timesWhenSubmitted: timeWhenSubmitted,
      })
    })

    describe('referencing a node that is too low/high', () => {
      let timesWhenSubmitted = []

      beforeEach(async () => {
        await increaseTimeTo(defaultStartTime)
        await stakingContract.stakeFor(user1, 100, HEAD, {
          from: user1,
        })
        timesWhenSubmitted = [new BigNumber(latestTime().toString())]

        await stakingContract.stakeFor(user2, 10, user1, {
          from: user1,
        })
        timesWhenSubmitted.push(new BigNumber(latestTime().toString()))

        await stakingContract.stakeFor(user3, 1, user2, {
          from: user1,
        })
        timesWhenSubmitted.push(new BigNumber(latestTime().toString()))
      })

      it('throws an error for suggested positions that are too high', async () => {
        try {
          await stakingContract.stakeFor(user4, 5, user1, {
            from: user1,
          })
          assert.fail()
        } catch (error) {
          const expectedError = 'Suggested position into top ranks too high!'
          ensuresException(error, expectedError)
        }

        const result = await stakingContract.getTopRanksTuples()
        const addresses = accounts
          .slice(0, 3)
          .map(user => new BigNumber(user).toNumber())
        listShouldEqualExpected({
          result,
          addresses,
          totalStaked: [100, 10, 1],
          timesWhenSubmitted,
        })
      })

      it('throws an error for suggested positions that are too low', async () => {
        try {
          await stakingContract.stakeFor(user4, 1000, user3, {
            from: user1,
          })
          assert.fail()
        } catch (error) {
          const expectedError = 'Suggested position into top ranks too low!'
          ensuresException(error, expectedError)
        }

        const result = await stakingContract.getTopRanksTuples()
        const addresses = accounts
          .slice(0, 3)
          .map(user => new BigNumber(user).toNumber())
        listShouldEqualExpected({
          result,
          addresses,
          totalStaked: [100, 10, 1],
          timesWhenSubmitted,
        })
      })
    })

    it('correctly inserts into top ranks at first rank position', async () => {
      const totalStaked = [100000, 10000, 1000, 100, 10]
      const timesWhenSubmitted = []

      await increaseTimeTo(defaultStartTime)
      await stakingContract.stakeFor(user1, totalStaked[4], HEAD, {
        from: user1,
      })
      timesWhenSubmitted.push(new BigNumber(latestTime().toString()))

      for (let i = 1; i < totalStaked.length; i++) {
        await increaseTimeTo(defaultStartTime.plus(i * 5))
        await stakingContract.stakeFor(
          accounts[i],
          totalStaked[4 - i],
          accounts[i - 1],
          { from: user1 }
        )
        timesWhenSubmitted.push(new BigNumber(latestTime().toString()))
      }

      const result = await stakingContract.getTopRanksTuples()
      const addresses = accounts
        .slice(0, totalStaked.length)
        .reverse()
        .map(user => new BigNumber(user).toNumber())

      listShouldEqualExpected({
        result,
        addresses,
        totalStaked,
        timesWhenSubmitted: timesWhenSubmitted.reverse(),
      })
    })

    it('correctly updates adding more stake for current first rank', async () => {
      const totalStaked = [100000, 10000, 1000, 100, 10]
      const bigStake = 100e18

      await increaseTimeTo(defaultStartTime)
      await stakingContract.stakeFor(user1, totalStaked[4], HEAD, {
        from: user1,
      })

      for (let i = 1; i < totalStaked.length; i++) {
        await increaseTimeTo(defaultStartTime.plus(i * 5))
        await stakingContract.stakeFor(
          accounts[i],
          totalStaked[4 - i],
          accounts[i - 1],
          { from: user1 }
        )
      }
      const result1 = (await stakingContract.getTopRanksTuples())[0].toNumber()

      await stakingContract.stakeFor(accounts[5], bigStake, accounts[4], {
        from: user1,
      })
      const result2 = (await stakingContract.getTopRanksTuples())[0].toNumber()

      await stakingContract.stakeFor(accounts[5], bigStake, accounts[4], {
        from: user1,
      })
      const result3 = (await stakingContract.getTopRanksTuples())[0].toNumber()

      expect(result1).to.equal(new BigNumber(accounts[4]).toNumber())
      expect(result2).to.equal(new BigNumber(accounts[5]).toNumber())
      expect(result3).to.equal(new BigNumber(accounts[5]).toNumber())
    })

    it('correctly inserts into top ranks at last rank position', async () => {
      const totalStaked = [6000, 5000, 4000, 3000, 2000, 1000]
      const timesWhenSubmitted = []

      await increaseTimeTo(defaultStartTime)
      await stakingContract.stakeFor(user1, totalStaked[0], HEAD, {
        from: user1,
      })
      timesWhenSubmitted.push(new BigNumber(latestTime().toString()))

      for (let i = 1; i < totalStaked.length; i++) {
        await increaseTimeTo(defaultStartTime.plus(i * 1000))
        await stakingContract.stakeFor(
          accounts[i],
          totalStaked[i],
          accounts[i - 1],
          { from: user1 }
        )
        timesWhenSubmitted.push(new BigNumber(latestTime().toString()))
      }

      const result = await stakingContract.getTopRanksTuples()
      const addresses = accounts
        .slice(0, totalStaked.length)
        .map(user => new BigNumber(user).toNumber())

      listShouldEqualExpected({
        result,
        addresses,
        totalStaked,
        timesWhenSubmitted,
      })
    })

    it('correctly updates adding more stake for last rank', async () => {
      const totalStaked = [6000, 5000, 4000, 3000, 2000, 1000]
      const smallStake = 600

      await increaseTimeTo(defaultStartTime)
      await stakingContract.stakeFor(user1, totalStaked[0], HEAD, {
        from: user1,
      })

      for (let i = 1; i < totalStaked.length; i++) {
        await increaseTimeTo(defaultStartTime.plus(i * 1000))
        await stakingContract.stakeFor(
          accounts[i],
          totalStaked[i],
          accounts[i - 1],
          { from: user1 }
        )
      }

      const topRanks1 = await stakingContract.getTopRanksTuples()
      const result1 = topRanks1[topRanks1.length - 3].toNumber()

      await increaseTimeTo(defaultEndTime.minus(1000))
      await stakingContract.stakeFor(accounts[6], smallStake, accounts[5], {
        from: user1,
      })
      const topRanks2 = await stakingContract.getTopRanksTuples()
      const result2 = topRanks2[topRanks2.length - 3].toNumber()

      await stakingContract.stakeFor(accounts[6], smallStake, accounts[5], {
        from: user1,
      })
      const topRanks3 = await stakingContract.getTopRanksTuples()
      const result3 = topRanks3[topRanks3.length - 3].toNumber()

      expect(result1).to.equal(new BigNumber(accounts[5]).toNumber())
      expect(result2).to.equal(new BigNumber(accounts[6]).toNumber())
      expect(result3).to.equal(new BigNumber(accounts[6]).toNumber())
    })

    it('correctly inserts into top ranks for nodes already in the top ranks', async () => {
      const totalStaked = [6000, 5000, 4000, 3000, 2000, 1000]
      const timesWhenSubmitted = []

      await increaseTimeTo(defaultStartTime)
      await stakingContract.stakeFor(user1, totalStaked[0], HEAD, {
        from: user1,
      })
      timesWhenSubmitted.push(new BigNumber(latestTime().toString()))

      const initialStake = 10
      await stakingContract.stakeFor(accounts[2], initialStake, user1, {
        from: user1,
      })
      const timeWhenSubmittedFirst = new BigNumber(latestTime().toString())

      for (let i = 1; i < totalStaked.length; i++) {
        await increaseTimeTo(defaultStartTime.plus(i * 1000))
        await stakingContract.stakeFor(
          accounts[i],
          totalStaked[i],
          accounts[i - 1],
          { from: user1 }
        )
        timesWhenSubmitted.push(new BigNumber(latestTime().toString()))
      }

      const result = await stakingContract.getTopRanksTuples()
      const addresses = accounts
        .slice(0, totalStaked.length)
        .map(user => new BigNumber(user).toNumber())

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

      result[7].should.be.bignumber.at.least(
        points1WithoutTimeAdvanced.plus(points2WithoutTimeAdvanced),
        'Staking points should match computed staking points!'
      )
      result[7].should.be.bignumber.at.most(
        points1WithTimeAdvanced.plus(points2WithTimeAdvanced),
        'Staking points should match computed staking points!'
      )
    })
  })

  describe('when there is a sorted top ranking', async () => {
    it('getSortedSpot returns correct reference node', async () => {
      const totalStaked = [100000, 10000, 1000, 100, 10]
      const timesWhenSubmitted = []

      await increaseTimeTo(defaultStartTime)
      await stakingContract.stakeFor(user1, totalStaked[4], HEAD, {
        from: user1,
      })
      timesWhenSubmitted.push(new BigNumber(latestTime().toString()))

      for (let i = 1; i < totalStaked.length; i++) {
        await increaseTimeTo(defaultStartTime.plus(i * 5))
        await stakingContract.stakeFor(
          accounts[i],
          totalStaked[4 - i],
          accounts[i - 1],
          { from: user1 }
        )
        timesWhenSubmitted.push(new BigNumber(latestTime().toString()))
      }

      const result = await stakingContract.getTopRanksTuples()
      const rcvStakingPoints = []

      result.forEach((e, i) => {
        if (!(i % 3)) {
          rcvStakingPoints.push(result[i + 1].toNumber())
        }
      })
      const spots = [
        await stakingContract.getSortedSpot(rcvStakingPoints[0] + 20, {
          from: accounts[rcvStakingPoints.length - 1],
        }),
      ]

      for (let i = 0; i < rcvStakingPoints.length; i++) {
        spots.push(
          await stakingContract.getSortedSpot(rcvStakingPoints[i] - 20, {
            from: accounts[rcvStakingPoints.length - 1],
          })
        )
      }

      spots.should.eql([
        accounts[totalStaked.length - 2],
        accounts[totalStaked.length - 2],
        ...accounts.slice(0, totalStaked.length - 1).reverse(),
      ])
    })

    it('getSortedSpotForNewStake returns correct reference node', async () => {
      const totalStaked = [100000, 10000, 1000, 100, 10]
      const timesWhenSubmitted = []

      await increaseTimeTo(defaultStartTime)
      await stakingContract.stakeFor(user1, totalStaked[4], HEAD, {
        from: user1,
      })
      timesWhenSubmitted.push(new BigNumber(latestTime().toString()))

      for (let i = 1; i < totalStaked.length; i++) {
        await increaseTimeTo(defaultStartTime.plus(i * 5))
        await stakingContract.stakeFor(
          accounts[i],
          totalStaked[4 - i],
          accounts[i - 1],
          { from: user1 }
        )
        timesWhenSubmitted.push(new BigNumber(latestTime().toString()))
      }

      const spots = []

      for (let i = 0; i < totalStaked.length; i++) {
        spots.push(
          await stakingContract.getSortedSpotForNewStake(100, {
            from: accounts[i],
          })
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
  })

  describe('when reading the top ranks with respective staking points and total staked', async () => {
    function arrayFromIndices(array, indices) {
      const newArray = []

      for (let i = 0; i < indices.length; i++) {
        newArray.push(array[indices[i]])
      }

      return newArray
    }

    it('returns the correct flat list of tuples', async () => {
      const totalStaked = [500, 74444, 1, 9999, 100000, 44]
      const timesWhenSubmitted = []

      await increaseTimeTo(defaultStartTime)
      await stakingContract.stakeFor(user1, totalStaked[0], HEAD, {
        from: user1,
      })
      timesWhenSubmitted.push(new BigNumber(latestTime().toString()))

      await increaseTimeTo(defaultStartTime.plus(5000))
      await stakingContract.stakeFor(user2, totalStaked[1], user1, {
        from: user1,
      })
      timesWhenSubmitted.push(new BigNumber(latestTime().toString()))

      await increaseTimeTo(defaultEndTime.minus(999))
      await stakingContract.stakeFor(user3, totalStaked[2], user1, {
        from: user1,
      })
      timesWhenSubmitted.push(new BigNumber(latestTime().toString()))

      await increaseTimeTo(defaultEndTime.minus(444))
      await stakingContract.stakeFor(user4, totalStaked[3], user1, {
        from: user1,
      })
      timesWhenSubmitted.push(new BigNumber(latestTime().toString()))

      await increaseTimeTo(defaultEndTime.minus(84))
      await stakingContract.stakeFor(user5, totalStaked[4], user1, {
        from: user1,
      })
      timesWhenSubmitted.push(new BigNumber(latestTime().toString()))

      await increaseTimeTo(defaultEndTime.minus(10))
      await stakingContract.stakeFor(user6, totalStaked[5], user3, {
        from: user1,
      })
      timesWhenSubmitted.push(new BigNumber(latestTime().toString()))

      const result = await stakingContract.getTopRanksTuples()
      const expectedRankingIndices = [1, 0, 4, 3, 2, 5]

      const addresses = arrayFromIndices(accounts, expectedRankingIndices).map(
        user => new BigNumber(user).toNumber()
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
          ? maxDiscountPer1000.minus(declinePerRankPer1000.times(rank - 1))
          : 0
      const bonusTokens = baselineTokens.times(discountPer1000).div(1000)

      return baselineTokens.add(bonusTokens)
    }

    describe('when staking given different STAR/ETH rates', async () => {
      describe('with STAR/ETH rate of 10 STAR = 1 ETH', async () => {
        const user1StakedAmount = new BigNumber(1500)
        const starEthRate = new BigNumber(1)
        const starEthRateDecimalCorrectionFactor = new BigNumber(10)

        beforeEach(async () => {
          const starEthRateAddress = (await StarEthRate.new(
            starEthRateDecimalCorrectionFactor,
            starEthRate
          )).address
          await deployStakingContract({ starEthRateAddress })

          await increaseTimeTo(defaultStartTime)
          await stakingContract.stakeFor(user1, user1StakedAmount, HEAD, {
            from: user1,
          })
          await increaseTimeTo(defaultEndTime.plus(100))
          await stakingContract.withdrawAllReceivedTokens({ from: user1 })
        })

        it('gives 10 times less tokens for staking compared to target rate', async () => {
          const tokenBalance = await tokenOnSale.balanceOf(user1)

          const expectedTokenBalance = computeExpectedBalance({
            decimalCorrectionFactor: starEthRateDecimalCorrectionFactor,
            declinePerRankPer1000: defaultDeclinePerRankPer1000,
            maxDiscountPer1000: defaultMaxDiscountPer1000,
            rank: 1,
            stakedAmount: user1StakedAmount,
            starEthRate,
            targetRateInEth: defaultTargetRateInEth,
          })

          tokenBalance.should.be.bignumber.equal(expectedTokenBalance)
        })
      })
      describe('with STAR/ETH rate of 3,000,000 STAR = 50 ETH', async () => {
        const user1StakedAmount = new BigNumber(1500)
        const starEthRate = new BigNumber(50)
        const starEthRateDecimalCorrectionFactor = new BigNumber(3000000)

        beforeEach(async () => {
          const starEthRateAddress = (await StarEthRate.new(
            starEthRateDecimalCorrectionFactor,
            starEthRate
          )).address
          await deployStakingContract({ starEthRateAddress })

          await increaseTimeTo(defaultStartTime)
          await stakingContract.stakeFor(user1, user1StakedAmount, HEAD, {
            from: user1,
          })
          await increaseTimeTo(defaultEndTime.plus(100))
          await stakingContract.withdrawAllReceivedTokens({ from: user1 })
        })

        it('gives 60,000 times less tokens for staking compared to target rate', async () => {
          const tokenBalance = await tokenOnSale.balanceOf(user1)

          const expectedTokenBalance = computeExpectedBalance({
            decimalCorrectionFactor: starEthRateDecimalCorrectionFactor,
            declinePerRankPer1000: defaultDeclinePerRankPer1000,
            maxDiscountPer1000: defaultMaxDiscountPer1000,
            rank: 1,
            stakedAmount: user1StakedAmount,
            starEthRate,
            targetRateInEth: defaultTargetRateInEth,
          })

          tokenBalance.should.be.bignumber.equal(expectedTokenBalance)
        })
      })

      describe('with STAR/ETH rate of 1 STAR = 1 ETH', async () => {
        const user1StakedAmount = new BigNumber(1500)
        const starEthRate = new BigNumber(100)
        const starEthRateDecimalCorrectionFactor = new BigNumber(100)

        beforeEach(async () => {
          const starEthRateAddress = (await StarEthRate.new(
            starEthRateDecimalCorrectionFactor,
            starEthRate
          )).address
          await deployStakingContract({ starEthRateAddress })

          await increaseTimeTo(defaultStartTime)
          await stakingContract.stakeFor(user1, user1StakedAmount, HEAD, {
            from: user1,
          })
          await increaseTimeTo(defaultEndTime.plus(100))
          await stakingContract.withdrawAllReceivedTokens({ from: user1 })
        })

        it('gives the same amount of tokens as target rate', async () => {
          const tokenBalance = await tokenOnSale.balanceOf(user1)

          const expectedTokenBalance = computeExpectedBalance({
            decimalCorrectionFactor: starEthRateDecimalCorrectionFactor,
            declinePerRankPer1000: defaultDeclinePerRankPer1000,
            maxDiscountPer1000: defaultMaxDiscountPer1000,
            rank: 1,
            stakedAmount: user1StakedAmount,
            starEthRate,
            targetRateInEth: defaultTargetRateInEth,
          })

          tokenBalance.should.be.bignumber.equal(expectedTokenBalance)
        })
      })

      describe('when STAR is worth less than 1 project token', async () => {
        const user1StakedAmount = new BigNumber(1500)
        const starEthRate = new BigNumber(1)
        const starEthRateDecimalCorrectionFactor = new BigNumber(10000)

        beforeEach(async () => {
          const starEthRateAddress = (await StarEthRate.new(
            starEthRateDecimalCorrectionFactor,
            starEthRate
          )).address
          await deployStakingContract({ starEthRateAddress })

          await increaseTimeTo(defaultStartTime)
          await stakingContract.stakeFor(user1, user1StakedAmount, HEAD, {
            from: user1,
          })
          await increaseTimeTo(defaultEndTime.plus(100))
          await stakingContract.withdrawAllReceivedTokens({ from: user1 })
        })

        it('gives less tokens than STAR used for staking', async () => {
          const tokenBalance = await tokenOnSale.balanceOf(user1)

          const expectedTokenBalance = computeExpectedBalance({
            decimalCorrectionFactor: starEthRateDecimalCorrectionFactor,
            declinePerRankPer1000: defaultDeclinePerRankPer1000,
            maxDiscountPer1000: defaultMaxDiscountPer1000,
            rank: 1,
            stakedAmount: user1StakedAmount,
            starEthRate,
            targetRateInEth: defaultTargetRateInEth,
          })

          tokenBalance.should.be.bignumber.equal(expectedTokenBalance)
        })
      })
    })

    describe('when staking given different top rank discounts', async () => {
      describe('when given a high max discount and high decline per rank', async () => {
        const user1StakedAmount = new BigNumber(1500)
        const user2StakedAmount = new BigNumber(1100)
        const user3StakedAmount = new BigNumber(666)
        const maxDiscountPer1000 = new BigNumber(5000)
        const declinePerRankPer1000 = new BigNumber(500)

        beforeEach(async () => {
          await deployStakingContract({
            declinePerRankPer1000,
            maxDiscountPer1000,
          })

          await increaseTimeTo(defaultStartTime)
          await stakingContract.stakeFor(user1, user1StakedAmount, HEAD, {
            from: user1,
          })
          await stakingContract.stakeFor(user2, user2StakedAmount, user1, {
            from: user1,
          })
          await stakingContract.stakeFor(user3, user3StakedAmount, user2, {
            from: user1,
          })
          await increaseTimeTo(defaultEndTime.plus(100))
          await stakingContract.withdrawAllReceivedTokens({ from: user3 })
        })

        it('transfers the correct amount of tokens', async () => {
          const tokenBalance = await tokenOnSale.balanceOf(user3)

          const expectedTokenBalance = computeExpectedBalance({
            decimalCorrectionFactor: defaultStarEthRateDecimalCorrectionFactor,
            declinePerRankPer1000,
            maxDiscountPer1000,
            rank: 3,
            stakedAmount: user3StakedAmount,
            starEthRate: defaultStarEthRate,
            targetRateInEth: defaultTargetRateInEth,
          })

          tokenBalance.should.be.bignumber.equal(expectedTokenBalance)
        })
      })

      describe('when given a high max discount and low decline per rank', async () => {
        const user1StakedAmount = new BigNumber(1500)
        const user2StakedAmount = new BigNumber(1100)
        const user3StakedAmount = new BigNumber(666)
        const maxDiscountPer1000 = new BigNumber(5000)
        const declinePerRankPer1000 = new BigNumber(2)

        beforeEach(async () => {
          await deployStakingContract({
            declinePerRankPer1000,
            maxDiscountPer1000,
          })

          await increaseTimeTo(defaultStartTime)
          await stakingContract.stakeFor(user1, user1StakedAmount, HEAD, {
            from: user1,
          })
          await stakingContract.stakeFor(user2, user2StakedAmount, user1, {
            from: user1,
          })
          await stakingContract.stakeFor(user3, user3StakedAmount, user2, {
            from: user1,
          })
          await increaseTimeTo(defaultEndTime.plus(100))
          await stakingContract.withdrawAllReceivedTokens({ from: user3 })
        })

        it('transfers the correct amount of tokens', async () => {
          const tokenBalance = await tokenOnSale.balanceOf(user3)

          const expectedTokenBalance = computeExpectedBalance({
            decimalCorrectionFactor: defaultStarEthRateDecimalCorrectionFactor,
            declinePerRankPer1000,
            maxDiscountPer1000,
            rank: 3,
            stakedAmount: user3StakedAmount,
            starEthRate: defaultStarEthRate,
            targetRateInEth: defaultTargetRateInEth,
          })

          tokenBalance.should.be.bignumber.equal(expectedTokenBalance)
        })
      })

      describe('when given a low max discount and high decline per rank', async () => {
        const user1StakedAmount = new BigNumber(1500)
        const user2StakedAmount = new BigNumber(1100)
        const user3StakedAmount = new BigNumber(666)
        const maxDiscountPer1000 = new BigNumber(60)
        const declinePerRankPer1000 = new BigNumber(20)
        const topRanksMaxSize = new BigNumber(3)

        beforeEach(async () => {
          await deployStakingContract({
            declinePerRankPer1000,
            maxDiscountPer1000,
            topRanksMaxSize,
          })

          await increaseTimeTo(defaultStartTime)
          await stakingContract.stakeFor(user1, user1StakedAmount, HEAD, {
            from: user1,
          })
          await stakingContract.stakeFor(user2, user2StakedAmount, user1, {
            from: user1,
          })
          await stakingContract.stakeFor(user3, user3StakedAmount, user2, {
            from: user1,
          })
          await increaseTimeTo(defaultEndTime.plus(100))
          await stakingContract.withdrawAllReceivedTokens({ from: user3 })
        })

        it('transfers the correct amount of tokens', async () => {
          const tokenBalance = await tokenOnSale.balanceOf(user3)

          const expectedTokenBalance = computeExpectedBalance({
            decimalCorrectionFactor: defaultStarEthRateDecimalCorrectionFactor,
            declinePerRankPer1000,
            maxDiscountPer1000,
            rank: 3,
            stakedAmount: user3StakedAmount,
            starEthRate: defaultStarEthRate,
            targetRateInEth: defaultTargetRateInEth,
          })

          tokenBalance.should.be.bignumber.equal(expectedTokenBalance)
        })
      })

      describe('when given a low max discount and low decline per rank', async () => {
        const user1StakedAmount = new BigNumber(1500)
        const user2StakedAmount = new BigNumber(1100)
        const user3StakedAmount = new BigNumber(666)
        const maxDiscountPer1000 = new BigNumber(5)
        const declinePerRankPer1000 = new BigNumber(1)
        const topRanksMaxSize = new BigNumber(3)

        beforeEach(async () => {
          await deployStakingContract({
            declinePerRankPer1000,
            maxDiscountPer1000,
            topRanksMaxSize,
          })

          await increaseTimeTo(defaultStartTime)
          await stakingContract.stakeFor(user1, user1StakedAmount, HEAD, {
            from: user1,
          })
          await stakingContract.stakeFor(user2, user2StakedAmount, user1, {
            from: user1,
          })
          await stakingContract.stakeFor(user3, user3StakedAmount, user2, {
            from: user1,
          })
          await increaseTimeTo(defaultEndTime.plus(100))
          await stakingContract.withdrawAllReceivedTokens({ from: user3 })
        })

        it('transfers the correct amount of tokens', async () => {
          const tokenBalance = await tokenOnSale.balanceOf(user3)

          const expectedTokenBalance = computeExpectedBalance({
            decimalCorrectionFactor: defaultStarEthRateDecimalCorrectionFactor,
            declinePerRankPer1000,
            maxDiscountPer1000,
            rank: 3,
            stakedAmount: user3StakedAmount,
            starEthRate: defaultStarEthRate,
            targetRateInEth: defaultTargetRateInEth,
          })

          tokenBalance.should.be.bignumber.equal(expectedTokenBalance)
        })
      })
    })

    describe('when staking given different target rates', async () => {
      describe('when given a high target rate', async () => {
        const user1StakedAmount = new BigNumber(1500)
        const targetRateInEth = new BigNumber(2000000)

        beforeEach(async () => {
          await deployStakingContract({ targetRateInEth })

          await increaseTimeTo(defaultStartTime)
          await stakingContract.stakeFor(user1, user1StakedAmount, HEAD, {
            from: user1,
          })
          await increaseTimeTo(defaultEndTime.plus(100))
          await stakingContract.withdrawAllReceivedTokens({ from: user1 })
        })

        it('transfers the correct amount of tokens', async () => {
          const tokenBalance = await tokenOnSale.balanceOf(user1)

          const expectedTokenBalance = computeExpectedBalance({
            decimalCorrectionFactor: defaultStarEthRateDecimalCorrectionFactor,
            declinePerRankPer1000: defaultDeclinePerRankPer1000,
            maxDiscountPer1000: defaultMaxDiscountPer1000,
            rank: 1,
            stakedAmount: user1StakedAmount,
            starEthRate: defaultStarEthRate,
            targetRateInEth,
          })

          tokenBalance.should.be.bignumber.equal(expectedTokenBalance)
        })
      })

      describe('when given a low target rate', async () => {
        const user1StakedAmount = new BigNumber(1500)
        const targetRateInEth = new BigNumber(1)

        beforeEach(async () => {
          await deployStakingContract({ targetRateInEth })

          await increaseTimeTo(defaultStartTime)
          await stakingContract.stakeFor(user1, user1StakedAmount, HEAD, {
            from: user1,
          })
          await increaseTimeTo(defaultEndTime.plus(100))
          await stakingContract.withdrawAllReceivedTokens({ from: user1 })
        })

        it('transfers the correct amount of tokens', async () => {
          const tokenBalance = await tokenOnSale.balanceOf(user1)

          const expectedTokenBalance = computeExpectedBalance({
            decimalCorrectionFactor: defaultStarEthRateDecimalCorrectionFactor,
            declinePerRankPer1000: defaultDeclinePerRankPer1000,
            maxDiscountPer1000: defaultMaxDiscountPer1000,
            rank: 1,
            stakedAmount: user1StakedAmount,
            starEthRate: defaultStarEthRate,
            targetRateInEth,
          })

          tokenBalance.should.be.bignumber.equal(expectedTokenBalance)
        })
      })
    })

    it('transfers bought tokens and bonus', async () => {
      const user1StakedAmount = new BigNumber(1500)

      await increaseTimeTo(defaultStartTime)
      await stakingContract.stakeFor(user1, user1StakedAmount, HEAD, {
        from: user1,
      })
      await stakingContract.stakeFor(user2, 1000, user1, {
        from: user1,
      })
      await increaseTimeTo(defaultEndTime.plus(100))

      await stakingContract.withdrawAllReceivedTokens({ from: user1 })

      const user1TokenBalance = await tokenOnSale.balanceOf(user1)
      const user2TokenBalance = await tokenOnSale.balanceOf(user2)

      const expectedUser1TokenBalance = computeExpectedBalance({
        decimalCorrectionFactor: defaultStarEthRateDecimalCorrectionFactor,
        declinePerRankPer1000: defaultDeclinePerRankPer1000,
        maxDiscountPer1000: defaultMaxDiscountPer1000,
        rank: 1,
        stakedAmount: user1StakedAmount,
        starEthRate: defaultStarEthRate,
        targetRateInEth: defaultTargetRateInEth,
      })

      user1TokenBalance.should.be.bignumber.equal(expectedUser1TokenBalance)
      user2TokenBalance.should.be.bignumber.equal(new BigNumber(0))
    })

    it('transfers less tokens for lower ranks', async () => {
      const user1StakedAmount = new BigNumber(1500)
      const user2StakedAmount = new BigNumber(1400)
      const user3StakedAmount = new BigNumber(1300)
      const user4StakedAmount = new BigNumber(1200)

      await increaseTimeTo(defaultStartTime)
      await stakingContract.stakeFor(user1, user1StakedAmount, HEAD, {
        from: user1,
      })
      await stakingContract.stakeFor(user2, user2StakedAmount, user1, {
        from: user1,
      })
      await stakingContract.stakeFor(user3, user3StakedAmount, user2, {
        from: user1,
      })
      await stakingContract.stakeFor(user4, user4StakedAmount, user3, {
        from: user1,
      })
      await increaseTimeTo(defaultEndTime.plus(100))

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
        rank: 2,
        stakedAmount: user2StakedAmount,
        starEthRate: defaultStarEthRate,
        targetRateInEth: defaultTargetRateInEth,
      })

      const expectedUser3TokenBalance = computeExpectedBalance({
        decimalCorrectionFactor: defaultStarEthRateDecimalCorrectionFactor,
        declinePerRankPer1000: defaultDeclinePerRankPer1000,
        maxDiscountPer1000: defaultMaxDiscountPer1000,
        rank: 3,
        stakedAmount: user3StakedAmount,
        starEthRate: defaultStarEthRate,
        targetRateInEth: defaultTargetRateInEth,
      })

      const expectedUser4TokenBalance = computeExpectedBalance({
        decimalCorrectionFactor: defaultStarEthRateDecimalCorrectionFactor,
        declinePerRankPer1000: defaultDeclinePerRankPer1000,
        maxDiscountPer1000: defaultMaxDiscountPer1000,
        rank: 4,
        stakedAmount: user4StakedAmount,
        starEthRate: defaultStarEthRate,
        targetRateInEth: defaultTargetRateInEth,
      })

      user2TokenBalance.should.be.bignumber.equal(expectedUser2TokenBalance)
      user3TokenBalance.should.be.bignumber.equal(expectedUser3TokenBalance)
      user4TokenBalance.should.be.bignumber.equal(expectedUser4TokenBalance)
    })

    it('transfers no bonus tokens for users not in top ranks', async () => {
      const user1StakedAmount = new BigNumber(1500)
      const user2StakedAmount = new BigNumber(1100)
      const user3StakedAmount = new BigNumber(666)
      const topRanksMaxSize = new BigNumber(2)

      await deployStakingContract({ topRanksMaxSize })

      await increaseTimeTo(defaultStartTime)
      await stakingContract.stakeFor(user1, user1StakedAmount, HEAD, {
        from: user1,
      })
      await stakingContract.stakeFor(user2, user2StakedAmount, user1, {
        from: user1,
      })
      await stakingContract.stakeFor(user3, user3StakedAmount, user2, {
        from: user1,
      })
      await increaseTimeTo(defaultEndTime.plus(100))
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

      tokenBalance.should.be.bignumber.equal(expectedTokenBalance)
    })

    it('reverts when trying to withdraw more than once', async () => {
      await increaseTimeTo(defaultStartTime)
      await stakingContract.stakeFor(user1, 1500, HEAD, {
        from: user1,
      })
      await stakingContract.stakeFor(user2, 1000, user1, {
        from: user1,
      })
      await increaseTimeTo(defaultEndTime.plus(100))

      await stakingContract.withdrawAllReceivedTokens({ from: user1 })

      try {
        await stakingContract.withdrawAllReceivedTokens({ from: user1 })
        assert.fail()
      } catch (error) {
        const expectedError = 'User has already withdrawn tokens!'
        ensuresException(error, expectedError)
      }
    })
  })
})
