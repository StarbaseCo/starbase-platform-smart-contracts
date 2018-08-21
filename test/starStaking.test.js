const BigNumber = require('bignumber.js');

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

contract('StarStaking', function([user1, user2, user3, user4, user5, user6]) {
    let stakingContract, token, initialBalance, openingTime, closingTime;

    beforeEach(async () => {
        initialBalance = new BigNumber(1000000000);
        token = await MintableToken.new();
       
        openingTime = new BigNumber(latestTime().toString()).plus(1000);
        closingTime = openingTime.plus(200000);
        stakingContract = await StarStaking.new(token.address, openingTime, closingTime);

        await token.mint(user1, initialBalance);
        await token.approve(stakingContract.address, initialBalance, {
            from: user1
        });
    });

    describe('staking period is open', async () => {
        beforeEach(async () => {
            await increaseTimeTo(openingTime);
        });

        it('transfers tokens to stakingContract when staked', async () => {
            await stakingContract.stake(initialBalance, HEAD);
            const userBalance = await token.balanceOf.call(user1);
            const stakingContractBalance = await token.balanceOf.call(
                stakingContract.address
            );

            userBalance.should.be.bignumber.equal(0);
            stakingContractBalance.should.be.bignumber.equal(initialBalance);
        });

        it('allows user to stake for other person', async () => {
            await stakingContract.stakeFor(user2, initialBalance, HEAD, { from: user1 });

            const user2TotalStaked = await stakingContract.totalStakedFor.call(
                user2
            );
            user2TotalStaked.should.be.bignumber.equal(initialBalance);
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
        const userTotalStakingPoints = await stakingContract.totalStakingPointsFor.call(user1);
        
        const pointsWithoutTimeAdvanced = computeStakingPoints({ amount, timeWhenSubmitted, timeAdvanced: false });
        const pointsWithTimeAdvanced = computeStakingPoints({ amount, timeWhenSubmitted, timeAdvanced: true });

        userTotalStakingPoints.should.be.bignumber.at.least(pointsWithoutTimeAdvanced);
        userTotalStakingPoints.should.be.bignumber.at.most(pointsWithTimeAdvanced);
    }

    describe('adding new stake', async () => {
        BALANCES.forEach(async (balance, i) => {
            describe(`staking ${balance.toNumber()} tokens`, async () => {
                it('calculates the points correctly at the beginning', async () => {
                    await increaseTimeTo(openingTime);
                    evaluateComputation(balance);
                });

                it('calculates the points correctly in the middle', async () => {
                    await increaseTimeTo(openingTime.plus(closingTime.minus(openingTime).div(2)));
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

            await increaseTimeTo(openingTime);
            await stakingContract.stakeFor(user2, totalStaked[4], HEAD, { from: user1 });
            timesWhenSubmitted.push(new BigNumber(latestTime().toString()));

            await increaseTimeTo(openingTime.plus(10));
            await stakingContract.stakeFor(user3, totalStaked[3], user2, { from: user1 });
            timesWhenSubmitted.push(new BigNumber(latestTime().toString()));

            await increaseTimeTo(openingTime.plus(15));
            await stakingContract.stakeFor(user4, totalStaked[2], user3, { from: user1 });
            timesWhenSubmitted.push(new BigNumber(latestTime().toString()));

            await increaseTimeTo(openingTime.plus(20));
            await stakingContract.stakeFor(user5, totalStaked[1], user4, { from: user1 });
            timesWhenSubmitted.push(new BigNumber(latestTime().toString()));

            await increaseTimeTo(openingTime.plus(25));
            await stakingContract.stakeFor(user6, totalStaked[0], user5, { from: user1 });
            timesWhenSubmitted.push(new BigNumber(latestTime().toString()));

            const result = await stakingContract.getTopRanksTuples();
            const addresses = [user6, user5, user4, user3, user2].map(user => new BigNumber(user).toNumber());

            listShouldEqualExpected(result, addresses, totalStaked, timesWhenSubmitted.reverse());
        });
    });

    describe('reading the top ranks with respective staking points and total staked', async () => {
        it('returns the correct flat list of tuples', async () => {
            const totalStaked = [6000,5000,4000,3000,2000,1000];
            const timesWhenSubmitted = [];

            await increaseTimeTo(openingTime);
            await stakingContract.stakeFor(user1, totalStaked[0], HEAD, { from: user1 });
            timesWhenSubmitted.push(new BigNumber(latestTime().toString()));

            await increaseTimeTo(closingTime.minus(50));
            await stakingContract.stakeFor(user2, totalStaked[1], user1, { from: user1 });
            timesWhenSubmitted.push(new BigNumber(latestTime().toString()));

            await increaseTimeTo(closingTime.minus(40));
            await stakingContract.stakeFor(user3, totalStaked[2], user2, { from: user1 });
            timesWhenSubmitted.push(new BigNumber(latestTime().toString()));

            await increaseTimeTo(closingTime.minus(30));
            await stakingContract.stakeFor(user4, totalStaked[3], user3, { from: user1 });
            timesWhenSubmitted.push(new BigNumber(latestTime().toString()));

            await increaseTimeTo(closingTime.minus(20));
            await stakingContract.stakeFor(user5, totalStaked[4], user4, { from: user1 });
            timesWhenSubmitted.push(new BigNumber(latestTime().toString()));

            await increaseTimeTo(closingTime.minus(10));
            await stakingContract.stakeFor(user6, totalStaked[5], user5, { from: user1 });
            timesWhenSubmitted.push(new BigNumber(latestTime().toString()));

            const result = await stakingContract.getTopRanksTuples();
            const addresses = [user1, user2, user3, user4, user5, user6].map(user => new BigNumber(user).toNumber());

            listShouldEqualExpected(result, addresses, totalStaked, timesWhenSubmitted);
        });
    });
});
