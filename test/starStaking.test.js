const BigNumber = web3.BigNumber

const StarStaking = artifacts.require('StarStaking.sol')
const MintableToken = artifacts.require('MintableToken.sol')

const { should, ensuresException } = require('./helpers/utils')
const { increaseTimeTo, latestTime } = require('./helpers/timer')

const HEAD = '0x0000000000000000000000000000000000000000'
const BALANCES = [1, 60000, 99999999].map(n => new BigNumber(n))

contract('StarStaking', accounts => {
  const [user1, user2, user3, user4, user5, user6, defaultWallet] = accounts
  let stakingContract,
    starToken,
    tokenOnSale,
    initialBalance,
    defaultStartTime,
    defaultClosingTime,
    defaultStakeSaleCap,
    defaultStarRatePer1000,
    defaultMaxDiscountPer1000,
    defaultDeclinePerRankPer1000

  beforeEach(async () => {
    initialBalance = new BigNumber(10000).times(new BigNumber(1e18))
    starToken = await MintableToken.new()
    tokenOnSale = await MintableToken.new()

    defaultStartTime = new BigNumber(latestTime().toString()).plus(10000)
    defaultClosingTime = defaultStartTime.plus(200000)

    defaultStarRatePer1000 = new BigNumber(2000) // = x2
    defaultMaxDiscountPer1000 = new BigNumber(500) // = 50%
    defaultDeclinePerRankPer1000 = new BigNumber(5) // = 0.5%

    defaultTopRanksMaxSize = new BigNumber(10)
    defaultStakeSaleCap = new BigNumber(1000)
    defaultMaxStakePerUser = new BigNumber(600)

    stakingContract = await StarStaking.new(
      starToken.address,
      tokenOnSale.address,
      defaultStartTime,
      defaultClosingTime,
      defaultTopRanksMaxSize,
      defaultStarRatePer1000,
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

  describe('when deploying the contract', () => {
    const itFailsToDeployContract = async ({
      starTokenAddress = starToken.address,
      tokenOnSaleAddress = tokenOnSale.address,
      startTime = defaultStartTime,
      closingTime = defaultClosingTime,
      topRanksMaxSize = defaultTopRanksMaxSize,
      starRatePer1000 = defaultStarRatePer1000,
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
          starTokenAddress,
          tokenOnSaleAddress,
          startTime,
          closingTime,
          topRanksMaxSize,
          starRatePer1000,
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
        startTime: defaultClosingTime,
        closingTime: defaultStartTime,
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

    it('does NOT allow to deploy with a starRatePer1000 of 0', async () => {
      await itFailsToDeployContract({
        starRatePer1000: 0,
        expectedError: 'Rate must be more than 0!',
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

    it('sets initial parameters correctly', async () => {
      const setTokenAddress = await stakingContract.starToken()
      const setTokenOnSale = await stakingContract.tokenOnSale()
      const setTopRanksMaxSize = await stakingContract.topRanksMaxSize()
      const setStartTime = await stakingContract.startTime()
      const setClosingTime = await stakingContract.closingTime()
      const setTopRanksCount = await stakingContract.topRanksCount()
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
      setClosingTime.should.be.bignumber.equal(
        defaultClosingTime,
        'Closing time not matching!'
      )
      setTopRanksCount.should.be.bignumber.equal(
        0,
        'Initial top ranks count should be 0!'
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
    const timeUntilEnd = defaultClosingTime.minus(adjustedTime)
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
            defaultStartTime.plus(
              defaultClosingTime.minus(defaultStartTime).div(2)
            )
          )
          evaluateComputation(balance)
        })

        it('calculates the points correctly at the end', async () => {
          await increaseTimeTo(defaultClosingTime.minus(20))
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
        await stakingContract.getSortedSpot(rcvStakingPoints[0] + 20),
      ]

      for (let i = 0; i < rcvStakingPoints.length; i++) {
        spots.push(
          await stakingContract.getSortedSpot(rcvStakingPoints[i] - 20)
        )
      }

      spots.should.eql([
        accounts[totalStaked.length - 1],
        ...accounts.slice(0, totalStaked.length).reverse(),
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

      await increaseTimeTo(defaultClosingTime.minus(999))
      await stakingContract.stakeFor(user3, totalStaked[2], user1, {
        from: user1,
      })
      timesWhenSubmitted.push(new BigNumber(latestTime().toString()))

      await increaseTimeTo(defaultClosingTime.minus(444))
      await stakingContract.stakeFor(user4, totalStaked[3], user1, {
        from: user1,
      })
      timesWhenSubmitted.push(new BigNumber(latestTime().toString()))

      await increaseTimeTo(defaultClosingTime.minus(84))
      await stakingContract.stakeFor(user5, totalStaked[4], user1, {
        from: user1,
      })
      timesWhenSubmitted.push(new BigNumber(latestTime().toString()))

      await increaseTimeTo(defaultClosingTime.minus(10))
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
      )
    })
  })
})
