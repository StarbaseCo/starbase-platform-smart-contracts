const StarStaking = artifacts.require('StarStaking.sol');
const MintableToken = artifacts.require('MintableToken.sol');

const { should } = require('./helpers/utils');
const { increaseTimeTo, latestTime } = require('./helpers/timer');

contract('StarStaking', function([user, user2]) {
    let stakingContract, token, initialBalance;

    beforeEach(async () => {
        initialBalance = 10000;
        token = await MintableToken.new();
        stakingContract = await StarStaking.new(token.address);

        await token.mint(user, initialBalance);
        await token.approve(stakingContract.address, initialBalance, {
            from: user
        });
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

    it('allows user to unstake tokens', async () => {
        await stakingContract.stake(initialBalance);

        const userTotalStaked = await stakingContract.totalStakedFor.call(user);
        userTotalStaked.should.be.bignumber.equal(initialBalance);

        await stakingContract.unstake(initialBalance / 2);

        const userNewTotalStake = await stakingContract.totalStakedFor.call(
            user
        );
        userNewTotalStake.should.be.bignumber.equal(initialBalance / 2);
    });

    it('allows user to stake for other person', async () => {
        await stakingContract.stakeFor(user2, initialBalance, { from: user });

        const user2TotalStaked = await stakingContract.totalStakedFor.call(
            user2
        );
        user2TotalStaked.should.be.bignumber.equal(initialBalance);

        await stakingContract.unstake(initialBalance / 2, { from: user2 });

        const user2NewTotalStake = await stakingContract.totalStakedFor.call(
            user2
        );
        user2NewTotalStake.should.be.bignumber.equal(initialBalance / 2);
    });

    describe('staking constants', async () => {
        let firstBlock;
        let secondBlock;

        beforeEach(async () => {
            let result = await stakingContract.stake(initialBalance / 2);
            firstBlock = result['receipt']['blockNumber'];

            await increaseTimeTo(latestTime() + 5);

            result = await stakingContract.stake(initialBalance / 2);
            secondBlock = result['receipt']['blockNumber'];
        });

        it('returns full staked value when calling totalStaked', async () => {
            const userTotalStaked = await stakingContract.totalStakedFor.call(
                user
            );
            userTotalStaked.should.be.bignumber.equal(initialBalance);
        });

        it('returns correct amount staked at block', async () => {
            const userTotalStakedAtBlock = await stakingContract.totalStakedForAt.call(
                user,
                firstBlock
            );
            userTotalStakedAtBlock.should.be.bignumber.equal(
                initialBalance / 2
            );
        });

        it('returns correct block when calling lastStaked', async () => {
            const userLastStaked = await stakingContract.lastStakedFor.call(
                user
            );
            userLastStaked.should.be.bignumber.equal(secondBlock);
        });

        it('returns correct amount staked at block in future', async () => {
            const userTotalStakedAtBlock = await stakingContract.totalStakedForAt.call(
                user,
                secondBlock * 2
            );
            userTotalStakedAtBlock.should.be.bignumber.equal(initialBalance);
        });
    });

    it('returns correct total amount staked', async () => {
        await stakingContract.stake(initialBalance / 2, { from: user });
        let result = await stakingContract.stake(initialBalance / 2, {
            from: user
        });

        let block = result['receipt']['blockNumber'];

        const userTotalStakedAt = await stakingContract.totalStakedAt.call(
            block * 2
        );
        userTotalStakedAt.should.be.bignumber.equal(initialBalance);
    });
});
