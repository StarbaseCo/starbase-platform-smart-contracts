const BigNumber = web3.BigNumber;

const StarStaking = artifacts.require('StarStaking.sol');
const MintableToken = artifacts.require('MintableToken.sol');

const { should } = require('./helpers/utils');
const { increaseTimeTo, latestTime } = require('./helpers/timer');

const HEAD = '0x0000000000000000000000000000000000000000';
const PREV = false;
const NEXT = true;

const  BALANCES = [
    new BigNumber(10),
    new BigNumber(200),
    new BigNumber(4000),
    new BigNumber(10000),
    new BigNumber(60000),
    new BigNumber(200000),
    new BigNumber(3333333),
    new BigNumber(44444444),
    new BigNumber(999999999),
    new BigNumber(1000000000),
];

contract('StarStaking', _accounts => {
    let stakingContract, token, initialBalance, startTime, closingTime, accounts;

    beforeEach(async () => {
        accounts = _accounts;
        initialBalance = new BigNumber(1000000000);
        token = await MintableToken.new();
       
        topRanksMaxSize = new BigNumber(10);
        startTime = new BigNumber(latestTime().toString()).plus(1000);
        closingTime = startTime.plus(200000);
        stakingContract = await StarStaking.new(token.address, topRanksMaxSize, startTime, closingTime);

        await token.mint(accounts[0], initialBalance);
        await token.approve(stakingContract.address, initialBalance, {
            from: accounts[0]
        });
    });

    describe('when deploying the contract', () => {
        it('sets initial parameters correctly', async () => {
            const tokenAddress = await stakingContract.token();
            const _topRanksMaxSize = await stakingContract.topRanksMaxSize();
            const _startTime = await stakingContract.startTime();
            const _closingTime = await stakingContract.closingTime();
            const topRanksCount = await stakingContract.topRanksCount();
    
            tokenAddress.should.be.equal(token.address, 'Token address not matching!');
            _topRanksMaxSize.should.be.bignumber.equal(topRanksMaxSize, 'Top ranks size not matching!');
            _startTime.should.be.bignumber.equal(startTime, 'Opening time not matching!');
            _closingTime.should.be.bignumber.equal(closingTime, 'Closing time not matching!');
            topRanksCount.should.be.bignumber.equal(0, 'Initial top ranks count should be 0!');
        });
    });
        beforeEach(async () => {
            await increaseTimeTo(startTime);
        });

        it('transfers tokens to stakingContract when staked', async () => {
            await stakingContract.stake(initialBalance, HEAD);
            const userBalance = await token.balanceOf.call(accounts[0]);
            const stakingContractBalance = await token.balanceOf.call(
                stakingContract.address
            );

            userBalance.should.be.bignumber.equal(0);
            stakingContractBalance.should.be.bignumber.equal(initialBalance);
        });

        it('allows user to stake for other person', async () => {
            await stakingContract.stakeFor(accounts[1], initialBalance, HEAD, { from: accounts[0] });

            const user1TotalStaked = await stakingContract.totalStakedFor.call(
                accounts[1]
            );
            user1TotalStaked.should.be.bignumber.equal(initialBalance);
        });           
    });

    function computeStakingPoints({ amount, timeWhenSubmitted, timeAdvanced }) {
        const adjustedTime = timeAdvanced ? timeWhenSubmitted.minus(1) : timeWhenSubmitted;
        const timeUntilEnd = closingTime.minus(adjustedTime);
        const stakingPoints = timeUntilEnd.times(amount);

        return stakingPoints;
    }

    async function evaluateComputation(amount) {
        await stakingContract.stake(amount, HEAD);
        const timeWhenSubmitted = new BigNumber(latestTime());
        const userTotalStakingPoints = await stakingContract.totalStakingPointsFor.call(accounts[0]);
        
        const pointsWithoutTimeAdvanced = computeStakingPoints({ amount, timeWhenSubmitted, timeAdvanced: false });
        const pointsWithTimeAdvanced = computeStakingPoints({ amount, timeWhenSubmitted, timeAdvanced: true });

        userTotalStakingPoints.should.be.bignumber.at.least(pointsWithoutTimeAdvanced);
        userTotalStakingPoints.should.be.bignumber.at.most(pointsWithTimeAdvanced);
    }

    describe('adding new stake', () => {
        BALANCES.forEach(async (balance, i) => {
            describe(`staking ${balance.toNumber()} tokens`, async () => {
                it('calculates the points correctly at the beginning', async () => {
                    await increaseTimeTo(startTime);
                    evaluateComputation(balance);
                });

                it('calculates the points correctly in the middle', async () => {
                    await increaseTimeTo(startTime.plus(closingTime.minus(startTime).div(2)));
                    evaluateComputation(balance);
                });
        
                it('calculates the points correctly at the end', async () => {
                    await increaseTimeTo(closingTime.minus(20));
                    evaluateComputation(balance);
                });
            });
        });
    });

    function listShouldEqualExpected(result, addresses, totalStaked, timesWhenSubmitted) {
        const [rcvAddrs, rcvStakingPoints, rcvTotalStaked] = [[], [], []];

        result.map((e, i) => {
            if (!(i % 3)) {
                rcvAddrs.push(e.toNumber());
                rcvStakingPoints.push(result[i + 1]);
                rcvTotalStaked.push(result[i + 2].toNumber());
            }
        });

        rcvAddrs.should.eql(addresses, 'Addresses should match user addresses!');
        rcvTotalStaked.should.eql(totalStaked, 'Total amount of stake should match transferred amount!');

        rcvStakingPoints.forEach((stakingPoints, i) => {
            const amount = totalStaked[i];
            const timeWhenSubmitted = timesWhenSubmitted[i];

            const pointsWithoutTimeAdvanced = computeStakingPoints({ amount, timeWhenSubmitted, timeAdvanced: false });
            const pointsWithTimeAdvanced = computeStakingPoints({ amount, timeWhenSubmitted, timeAdvanced: true });

            stakingPoints.should.be.bignumber.at.least(
                pointsWithoutTimeAdvanced,
                'Staking points should match computed staking points!'
            );
            stakingPoints.should.be.bignumber.at.most(
                pointsWithTimeAdvanced,
                'Staking points should match computed staking points!'
            );
        });
    }

    describe('building the top ranks', () => {
        it('correctly insert into top ranks', async () => {
            const totalStaked = [100000,10000,1000,100,10];
            const timesWhenSubmitted = [];

            await increaseTimeTo(startTime);
            await stakingContract.stakeFor(accounts[1], totalStaked[4], HEAD, { from: accounts[0] });
            timesWhenSubmitted.push(new BigNumber(latestTime().toString()));

            await increaseTimeTo(startTime.plus(10));
            await stakingContract.stakeFor(accounts[2], totalStaked[3], accounts[1], { from: accounts[0] });
            timesWhenSubmitted.push(new BigNumber(latestTime().toString()));

            await increaseTimeTo(startTime.plus(15));
            await stakingContract.stakeFor(accounts[3], totalStaked[2], accounts[2], { from: accounts[0] });
            timesWhenSubmitted.push(new BigNumber(latestTime().toString()));

            await increaseTimeTo(startTime.plus(20));
            await stakingContract.stakeFor(accounts[4], totalStaked[1], accounts[3], { from: accounts[0] });
            timesWhenSubmitted.push(new BigNumber(latestTime().toString()));

            await increaseTimeTo(startTime.plus(25));
            await stakingContract.stakeFor(accounts[5], totalStaked[0], accounts[4], { from: accounts[0] });
            timesWhenSubmitted.push(new BigNumber(latestTime().toString()));

            const result = await stakingContract.getTopRanksTuples();
            const addresses = [accounts[5], accounts[4], accounts[3], accounts[2], accounts[1]].map(
                user => new BigNumber(user).toNumber()
            );

            listShouldEqualExpected(result, addresses, totalStaked, timesWhenSubmitted.reverse());
        });
    });

    describe('reading the top ranks with respective staking points and total staked', async () => {
        it('returns the correct flat list of tuples', async () => {
            const totalStaked = [6000,5000,4000,3000,2000,1000];
            const timesWhenSubmitted = [];

            await increaseTimeTo(startTime);
            await stakingContract.stakeFor(accounts[0], totalStaked[0], HEAD, { from: accounts[0] });
            timesWhenSubmitted.push(new BigNumber(latestTime().toString()));

            await increaseTimeTo(closingTime.minus(50));
            await stakingContract.stakeFor(accounts[1], totalStaked[1], accounts[0], { from: accounts[0] });
            timesWhenSubmitted.push(new BigNumber(latestTime().toString()));

            await increaseTimeTo(closingTime.minus(40));
            await stakingContract.stakeFor(accounts[2], totalStaked[2], accounts[1], { from: accounts[0] });
            timesWhenSubmitted.push(new BigNumber(latestTime().toString()));

            await increaseTimeTo(closingTime.minus(30));
            await stakingContract.stakeFor(accounts[3], totalStaked[3], accounts[2], { from: accounts[0] });
            timesWhenSubmitted.push(new BigNumber(latestTime().toString()));

            await increaseTimeTo(closingTime.minus(20));
            await stakingContract.stakeFor(accounts[4], totalStaked[4], accounts[3], { from: accounts[0] });
            timesWhenSubmitted.push(new BigNumber(latestTime().toString()));

            await increaseTimeTo(closingTime.minus(10));
            await stakingContract.stakeFor(accounts[5], totalStaked[5], accounts[4], { from: accounts[0] });
            timesWhenSubmitted.push(new BigNumber(latestTime().toString()));

            const result = await stakingContract.getTopRanksTuples();
            const addresses = [accounts[0], accounts[1], accounts[2], accounts[3], accounts[4], accounts[5]].map(user => new BigNumber(user).toNumber());

            listShouldEqualExpected(result, addresses, totalStaked, timesWhenSubmitted);
        });
    });
});
