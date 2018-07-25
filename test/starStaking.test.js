const BigNumber = require('bignumber.js');

const StarStaking = artifacts.require('StarStaking.sol');
const MintableToken = artifacts.require('MintableToken.sol');

const { should } = require('./helpers/utils');
const { increaseTimeTo, latestTime } = require('./helpers/timer');

const BALANCES = [
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

contract('StarStaking', function([user, user2]) {
    let stakingContract, token, initialBalance, openingTime, closingTime;

    beforeEach(async () => {
        initialBalance = new BigNumber(1000000000);
        token = await MintableToken.new();
       
        openingTime = new BigNumber(latestTime()).plus(1000);
        closingTime = openingTime.plus(200000);
        stakingContract = await StarStaking.new(token.address, openingTime, closingTime);

        await token.mint(user, initialBalance);
        await token.approve(stakingContract.address, initialBalance, {
            from: user
        });
    });

    describe('staking period is open', async () => {
        beforeEach(async () => {
            await increaseTimeTo(openingTime);
        });

        it('transfers tokens to stakingContract when staked', async () => {
            await stakingContract.stake(initialBalance);
            const userBalance = await token.balanceOf.call(user);
            const stakingContractBalance = await token.balanceOf.call(
                stakingContract.address
            );

            userBalance.should.be.bignumber.equal(0);
            stakingContractBalance.should.be.bignumber.equal(initialBalance);
        });

        it('allows user to stake for other person', async () => {
            await stakingContract.stakeFor(user2, initialBalance, { from: user });

            const user2TotalStaked = await stakingContract.totalStakedFor.call(
                user2
            );
            user2TotalStaked.should.be.bignumber.equal(initialBalance);
        });           
    });

    function computeStakingPoints({ amount, timeAdvanced }) {
        let currentTime = new BigNumber(latestTime());
        currentTime = timeAdvanced ? currentTime.minus(1) : currentTime;
        const timeUntilEnd = closingTime.minus(currentTime);
        const stakingPoints = timeUntilEnd.times(amount);

        return stakingPoints;
    }

    async function evaluateComputation(amount) {
        await stakingContract.stake(amount);
        const userTotalStakingPoints = await stakingContract.totalStakingPointsFor.call(user);

        const pointsWithoutTimeAdvanced = computeStakingPoints({ amount, timeAdvanced: false });
        const pointsWithTimeAdvanced = computeStakingPoints({ amount, timeAdvanced: true });

        userTotalStakingPoints.should.be.bignumber.at.least(pointsWithoutTimeAdvanced);
        userTotalStakingPoints.should.be.bignumber.at.most(pointsWithTimeAdvanced);
    }

    describe(`adding new stake`, async () => {
        BALANCES.forEach(async balance => {
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
});
