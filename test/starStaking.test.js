const BigNumber = web3.BigNumber

const StarStaking = artifacts.require('StarStaking.sol')
const MintableToken = artifacts.require('MintableToken.sol')

const { should, ensuresException } = require('./helpers/utils')
const { increaseTimeTo, latestTime } = require('./helpers/timer')

const NULL = '0x0000000000000000000000000000000000000000'
const BALANCES = [1, 60000, 99999999].map(n => new BigNumber(n))

contract('StarStaking', _accounts => {
  let stakingContract,
    token,
    initialBalance,
    startTime,
    closingTime,
    stakeSaleCap,
    accounts

  beforeEach(async () => {
    accounts = _accounts
    initialBalance = new BigNumber(10000000000)
    token = await MintableToken.new()

    topRanksMaxSize = new BigNumber(10)
    startTime = new BigNumber(latestTime().toString()).plus(1000)
    closingTime = startTime.plus(200000)
    stakeSaleCap = new BigNumber(1000000000)
    maxStakePerUser = new BigNumber(600000000)
    stakingContract = await StarStaking.new(
      token.address,
      topRanksMaxSize,
      startTime,
      closingTime,
      stakeSaleCap,
      maxStakePerUser
    )

    await token.mint(accounts[0], initialBalance)
    await token.approve(stakingContract.address, initialBalance, {
      from: accounts[0],
    })
  })

  describe('when deploying the contract', () => {
    async function itFailsToDeployContract(
      _address,
      _topRanksMaxSize,
      _startTime,
      _closingTime,
      _stakingSaleCap,
      _maxStakePerUser
    ) {
      let emptyStakingContract

      try {
        emptyStakingContract = await StarStaking.new(
          _address,
          _topRanksMaxSize,
          _startTime,
          _closingTime,
          _stakingSaleCap,
          _maxStakePerUser
        )
        assert.fail()
      } catch (e) {
        ensuresException(e)
      }

      should.equal(emptyStakingContract, undefined)
    }

    it('does NOT allow to deploy without a token address', () => {
      itFailsToDeployContract(
        0,
        topRanksMaxSize,
        startTime,
        closingTime,
        stakeSaleCap,
        maxStakePerUser
      )
    })

    it('does NOT allow to deploy with a closing time before starting time', () => {
      itFailsToDeployContract(
        token.address,
        topRanksMaxSize,
        closingTime,
        startTime,
        stakeSaleCap,
        maxStakePerUser
      )
    })

    it('does NOT allow to deploy with a starting time before the current time', () => {
      const earlyStartTime = new BigNumber(latestTime().toString()).minus(1000)
      itFailsToDeployContract(
        token.address,
        topRanksMaxSize,
        earlyStartTime,
        closingTime,
        stakeSaleCap,
        maxStakePerUser
      )
    })

    it('does NOT allow to deploy with a topRanksMaxSize of 0', () => {
      itFailsToDeployContract(
        token.address,
        0,
        startTime,
        closingTime,
        stakeSaleCap,
        maxStakePerUser
      )
    })

    it('does NOT allow to deploy with a stakeSaleCap of 0', () => {
      itFailsToDeployContract(
        token.address,
        topRanksMaxSize,
        startTime,
        closingTime,
        0,
        maxStakePerUser
      )
    })

    it('does NOT allow to deploy with a stakeSaleCap of 0', () => {
      itFailsToDeployContract(
        token.address,
        topRanksMaxSize,
        startTime,
        closingTime,
        0,
        maxStakePerUser
      )
    })

    it('does NOT allow to deploy with a maxStakePerUser of 0', () => {
      itFailsToDeployContract(
        token.address,
        topRanksMaxSize,
        startTime,
        closingTime,
        stakeSaleCap,
        0
      )
    })

    it('sets initial parameters correctly', async () => {
      const setTokenAddress = await stakingContract.token()
      const setTopRanksMaxSize = await stakingContract.topRanksMaxSize()
      const setStartTime = await stakingContract.startTime()
      const setClosingTime = await stakingContract.closingTime()
      const setTopRanksCount = await stakingContract.topRanksCount()
      const setStakeSaleCap = await stakingContract.stakeSaleCap()
      const setMaxStakePerUser = await stakingContract.maxStakePerUser()

      setTokenAddress.should.be.equal(
        token.address,
        'Token address not matching!'
      )
      setTopRanksMaxSize.should.be.bignumber.equal(
        topRanksMaxSize,
        'Top ranks size not matching!'
      )
      setStartTime.should.be.bignumber.equal(
        startTime,
        'Opening time not matching!'
      )
      setClosingTime.should.be.bignumber.equal(
        closingTime,
        'Closing time not matching!'
      )
      setTopRanksCount.should.be.bignumber.equal(
        0,
        'Initial top ranks count should be 0!'
      )
      setStakeSaleCap.should.be.bignumber.equal(
        stakeSaleCap,
        'Stake sale cap not matching!'
      )
      setMaxStakePerUser.should.be.bignumber.equal(
        maxStakePerUser,
        'Max stake per user not matching!'
      )
    })
  })

  describe('topRanksMaxSize', () => {
    it('respects the maximum top ranks count', async () => {
      await increaseTimeTo(startTime)
      await stakingContract.stakeFor(accounts[0], 10000, NULL, {
        from: accounts[0],
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
          { from: accounts[0] }
        )
      }

      const topRanksCount = await stakingContract.topRanksCount()
      topRanksCount.should.be.bignumber.equal(
        10,
        'Top ranks count should not exceed maximum top ranks size!'
      )
    })
  })

  describe('staking period is open', () => {
    beforeEach(async () => {
      await increaseTimeTo(startTime)
    })

    it('must have sufficient funds for the staking', async () => {
      await stakingContract.stakeFor(accounts[1], 10, NULL, {
        from: accounts[0],
      })
      const timeWhenSubmitted = [new BigNumber(latestTime().toString())]

      try {
        await stakingContract.stakeFor(accounts[2], 100, accounts[1], {
          from: accounts[2],
        })
        assert.fail()
      } catch (e) {
        ensuresException(e)
      }

      const result = await stakingContract.getTopRanksTuples()
      listShouldEqualExpected(
        result,
        [new BigNumber(accounts[1]).toNumber()],
        [10],
        timeWhenSubmitted
      )
    })

    it('transfers tokens to stakingContract when staked', async () => {
      const stakingAmount = new BigNumber(5000)

      await stakingContract.stake(stakingAmount, NULL)
      const userBalance = await token.balanceOf.call(accounts[0])
      const stakingContractBalance = await token.balanceOf.call(
        stakingContract.address
      )

      userBalance.should.be.bignumber.equal(initialBalance.sub(stakingAmount))
      stakingContractBalance.should.be.bignumber.equal(stakingAmount)
    })

    it('allows user to stake for other person', async () => {
      const stakingAmount = new BigNumber(5000)
      await stakingContract.stakeFor(accounts[1], stakingAmount, NULL, {
        from: accounts[0],
      })

      const user1TotalStaked = await stakingContract.totalStakedFor.call(
        accounts[1]
      )
      user1TotalStaked.should.be.bignumber.equal(stakingAmount)
    })

    it('adds only the remaining staking tokens when cap is reached', async () => {
      await stakingContract.stakeFor(accounts[0], maxStakePerUser, NULL)
      await stakingContract.stakeFor(accounts[1], maxStakePerUser, accounts[0])

      const userBalance = await token.balanceOf.call(accounts[0])
      const stakingContractBalance = await token.balanceOf.call(
        stakingContract.address
      )

      userBalance.should.be.bignumber.equal(initialBalance.minus(stakeSaleCap))
      stakingContractBalance.should.be.bignumber.equal(stakeSaleCap)
    })

    it('adds only the remaining staking tokens when maxStakePerUser is reached', async () => {
      await stakingContract.stake(maxStakePerUser.plus(10000), NULL)
      const userBalance = await token.balanceOf.call(accounts[0])
      const stakingContractBalance = await token.balanceOf.call(
        stakingContract.address
      )

      userBalance.should.be.bignumber.equal(
        initialBalance.minus(maxStakePerUser)
      )
      stakingContractBalance.should.be.bignumber.equal(maxStakePerUser)
    })
  })

  function computeStakingPoints({ amount, timeWhenSubmitted, timeAdvanced }) {
    const adjustedTime = timeAdvanced
      ? timeWhenSubmitted.minus(1)
      : timeWhenSubmitted
    const timeUntilEnd = closingTime.minus(adjustedTime)
    const stakingPoints = timeUntilEnd.times(amount)

    return stakingPoints
  }

  async function evaluateComputation(amount) {
    await stakingContract.stake(amount, NULL)
    const timeWhenSubmitted = new BigNumber(latestTime())
    const userTotalStakingPoints = await stakingContract.totalStakingPointsFor.call(
      accounts[0]
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

  describe('adding new stake', () => {
    BALANCES.forEach(async balance => {
      describe(`staking ${balance.toNumber()} tokens`, async () => {
        it('calculates the points correctly at the beginning', async () => {
          await increaseTimeTo(startTime)
          evaluateComputation(balance)
        })

        it('calculates the points correctly in the middle', async () => {
          await increaseTimeTo(
            startTime.plus(closingTime.minus(startTime).div(2))
          )
          evaluateComputation(balance)
        })

        it('calculates the points correctly at the end', async () => {
          await increaseTimeTo(closingTime.minus(20))
          evaluateComputation(balance)
        })
      })
    })
  })

  function listShouldEqualExpected(
    result,
    addresses,
    totalStaked,
    timesWhenSubmitted
  ) {
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

  describe('building the top ranks', () => {
    it('must provide a reference node when topRanksCount less than max size', async () => {
      await increaseTimeTo(startTime)
      await stakingContract.stakeFor(accounts[1], 10, NULL, {
        from: accounts[0],
      })
      const timeWhenSubmitted = [new BigNumber(latestTime().toString())]

      try {
        await stakingContract.stakeFor(accounts[2], 100, NULL, {
          from: accounts[0],
        })
        assert.fail()
      } catch (e) {
        ensuresException(e)
      }

      const result = await stakingContract.getTopRanksTuples()
      listShouldEqualExpected(
        result,
        [new BigNumber(accounts[1]).toNumber()],
        [10],
        timeWhenSubmitted
      )
    })

    it('must provide a reference node that exists', async () => {
      await increaseTimeTo(startTime)
      await stakingContract.stakeFor(accounts[1], 10, NULL, {
        from: accounts[0],
      })
      const timeWhenSubmitted = [new BigNumber(latestTime().toString())]

      try {
        await stakingContract.stakeFor(accounts[2], 100, accounts[3], {
          from: accounts[0],
        })
        assert.fail()
      } catch (e) {
        ensuresException(e)
      }

      const result = await stakingContract.getTopRanksTuples()
      listShouldEqualExpected(
        result,
        [new BigNumber(accounts[1]).toNumber()],
        [10],
        timeWhenSubmitted
      )
    })

    describe('referencing a node that is too low/high', () => {
      let timesWhenSubmitted = []

      beforeEach(async () => {
        await increaseTimeTo(startTime)
        await stakingContract.stakeFor(accounts[0], 100, NULL, {
          from: accounts[0],
        })
        timesWhenSubmitted = [new BigNumber(latestTime().toString())]

        await stakingContract.stakeFor(accounts[1], 10, accounts[0], {
          from: accounts[0],
        })
        timesWhenSubmitted.push(new BigNumber(latestTime().toString()))

        await stakingContract.stakeFor(accounts[2], 1, accounts[1], {
          from: accounts[0],
        })
        timesWhenSubmitted.push(new BigNumber(latestTime().toString()))
      })

      it('throws an error for suggested positions that are too high', async () => {
        try {
          await stakingContract.stakeFor(accounts[3], 5, accounts[0], {
            from: accounts[0],
          })
          assert.fail()
        } catch (e) {
          ensuresException(e)
        }

        const result = await stakingContract.getTopRanksTuples()
        const addresses = accounts
          .slice(0, 3)
          .map(user => new BigNumber(user).toNumber())
        listShouldEqualExpected(
          result,
          addresses,
          [100, 10, 1],
          timesWhenSubmitted
        )
      })

      it('throws an error for suggested positions that are too low', async () => {
        try {
          await stakingContract.stakeFor(accounts[3], 1000, accounts[2], {
            from: accounts[0],
          })
          assert.fail()
        } catch (e) {
          ensuresException(e)
        }

        const result = await stakingContract.getTopRanksTuples()
        const addresses = accounts
          .slice(0, 3)
          .map(user => new BigNumber(user).toNumber())
        listShouldEqualExpected(
          result,
          addresses,
          [100, 10, 1],
          timesWhenSubmitted
        )
      })
    })

    it('correctly insert into top ranks at first rank position', async () => {
      const totalStaked = [100000, 10000, 1000, 100, 10]
      const timesWhenSubmitted = []

      await increaseTimeTo(startTime)
      await stakingContract.stakeFor(accounts[0], totalStaked[4], NULL, {
        from: accounts[0],
      })
      timesWhenSubmitted.push(new BigNumber(latestTime().toString()))

      for (let i = 1; i < totalStaked.length; i++) {
        await increaseTimeTo(startTime.plus(i * 5))
        await stakingContract.stakeFor(
          accounts[i],
          totalStaked[4 - i],
          accounts[i - 1],
          { from: accounts[0] }
        )
        timesWhenSubmitted.push(new BigNumber(latestTime().toString()))
      }

      const result = await stakingContract.getTopRanksTuples()
      const addresses = accounts
        .slice(0, totalStaked.length)
        .reverse()
        .map(user => new BigNumber(user).toNumber())

      listShouldEqualExpected(
        result,
        addresses,
        totalStaked,
        timesWhenSubmitted.reverse()
      )
    })

    it('correctly insert into top ranks at last rank position', async () => {
      const totalStaked = [6000, 5000, 4000, 3000, 2000, 1000]
      const timesWhenSubmitted = []

      await increaseTimeTo(startTime)
      await stakingContract.stakeFor(accounts[0], totalStaked[0], NULL, {
        from: accounts[0],
      })
      timesWhenSubmitted.push(new BigNumber(latestTime().toString()))

      for (let i = 1; i < totalStaked.length; i++) {
        await increaseTimeTo(startTime.plus(i * 1000))
        await stakingContract.stakeFor(
          accounts[i],
          totalStaked[i],
          accounts[i - 1],
          { from: accounts[0] }
        )
        timesWhenSubmitted.push(new BigNumber(latestTime().toString()))
      }

      const result = await stakingContract.getTopRanksTuples()
      const addresses = accounts
        .slice(0, totalStaked.length)
        .map(user => new BigNumber(user).toNumber())

      listShouldEqualExpected(
        result,
        addresses,
        totalStaked,
        timesWhenSubmitted
      )
    })
  })

  describe('when there is a sorted top ranking', async () => {
    it('getSortedSpot returns correct reference node', async () => {
      const totalStaked = [100000, 10000, 1000, 100, 10]
      const timesWhenSubmitted = []

      await increaseTimeTo(startTime)
      await stakingContract.stakeFor(accounts[0], totalStaked[4], NULL, {
        from: accounts[0],
      })
      timesWhenSubmitted.push(new BigNumber(latestTime().toString()))

      for (let i = 1; i < totalStaked.length; i++) {
        await increaseTimeTo(startTime.plus(i * 5))
        await stakingContract.stakeFor(
          accounts[i],
          totalStaked[4 - i],
          accounts[i - 1],
          { from: accounts[0] }
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

  describe('reading the top ranks with respective staking points and total staked', async () => {
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

      await increaseTimeTo(startTime)
      await stakingContract.stakeFor(accounts[0], totalStaked[0], NULL, {
        from: accounts[0],
      })
      timesWhenSubmitted.push(new BigNumber(latestTime().toString()))

      await increaseTimeTo(startTime.plus(5000))
      await stakingContract.stakeFor(accounts[1], totalStaked[1], accounts[0], {
        from: accounts[0],
      })
      timesWhenSubmitted.push(new BigNumber(latestTime().toString()))

      await increaseTimeTo(closingTime.minus(999))
      await stakingContract.stakeFor(accounts[2], totalStaked[2], accounts[0], {
        from: accounts[0],
      })
      timesWhenSubmitted.push(new BigNumber(latestTime().toString()))

      await increaseTimeTo(closingTime.minus(444))
      await stakingContract.stakeFor(accounts[3], totalStaked[3], accounts[0], {
        from: accounts[0],
      })
      timesWhenSubmitted.push(new BigNumber(latestTime().toString()))

      await increaseTimeTo(closingTime.minus(84))
      await stakingContract.stakeFor(accounts[4], totalStaked[4], accounts[0], {
        from: accounts[0],
      })
      timesWhenSubmitted.push(new BigNumber(latestTime().toString()))

      await increaseTimeTo(closingTime.minus(10))
      await stakingContract.stakeFor(accounts[5], totalStaked[5], accounts[2], {
        from: accounts[0],
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

      listShouldEqualExpected(
        result,
        addresses,
        sortedTotalStaked,
        sortedTimesWhenSubmitted
      )
    })
  })
})
