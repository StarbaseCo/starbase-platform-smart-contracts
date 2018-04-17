const StarStaking = artifacts.require('StarStaking.sol');
const TokenMock = artifacts.require('./mocks/Token.sol');

const { should } = require('./helpers/utils');
const { increaseTimeTo, latestTime } = require('./helpers/timer');

contract('StarStaking', function([user, user2]) {
    let bank, token, initialBalance;

    beforeEach(async () => {
        initialBalance = 10000;
        token = await TokenMock.new();
        bank = await StarStaking.new(token.address);

        await token.mint(user, initialBalance);
    });

    it('transfers tokens to bank when staked', async () => {
        await bank.stake(initialBalance, '0x0');
        const userBalance = await token.balanceOf.call(user);
        const bankBalance = await token.balanceOf.call(bank.address);

        userBalance.should.be.bignumber.equal(0);
        bankBalance.should.be.bignumber.equal(initialBalance);
    });

    it('allows user to unstake tokens', async () => {
        await bank.stake(initialBalance, '0x0');

        const userTotalStaked = await bank.totalStakedFor.call(user);
        userTotalStaked.should.be.bignumber.equal(initialBalance);

        await bank.unstake(initialBalance / 2, '0x0');

        const userNewTotalStake = await bank.totalStakedFor.call(user);
        userNewTotalStake.should.be.bignumber.equal(initialBalance / 2);
    });

    it('allows user to stake for other person', async () => {
        await bank.stakeFor(user2, initialBalance, '0x0', { from: user });

        const user2TotalStaked = await bank.totalStakedFor.call(user2);
        user2TotalStaked.should.be.bignumber.equal(initialBalance);

        await bank.unstake(initialBalance / 2, '0x0', { from: user2 });

        const user2NewTotalStake = await bank.totalStakedFor.call(user2);
        user2NewTotalStake.should.be.bignumber.equal(initialBalance / 2);
    });

    describe('staking constants', async () => {
        let firstBlock;
        let secondBlock;

        beforeEach(async () => {
            let result = await bank.stake(initialBalance / 2, '0x0');
            firstBlock = result['receipt']['blockNumber'];

            await increaseTimeTo(latestTime() + 5);

            result = await bank.stake(initialBalance / 2, '0x0');
            secondBlock = result['receipt']['blockNumber'];
        });

        it('returns full staked value when calling totalStaked', async () => {
            const userTotalStaked = await bank.totalStakedFor.call(user);
            userTotalStaked.should.be.bignumber.equal(initialBalance);
        });

        it('returns correct amount staked at block', async () => {
            const userTotalStakedAtBlock = await bank.totalStakedForAt.call(
                user,
                firstBlock
            );
            userTotalStakedAtBlock.should.be.bignumber.equal(
                initialBalance / 2
            );
        });

        it('returns correct block when calling lastStaked', async () => {
            const userLastStaked = await bank.lastStakedFor.call(user);
            userLastStaked.should.be.bignumber.equal(secondBlock);
            // assert.equal(await bank.lastStakedFor.call(user), secondBlock);
        });

        it('returns correct amount staked at block in future', async () => {
            const userTotalStakedAtBlock = await bank.totalStakedForAt.call(
                user,
                secondBlock * 2
            );
            userTotalStakedAtBlock.should.be.bignumber.equal(initialBalance);
        });
    });

    it('returns correct total amount staked', async () => {
        await bank.stake(initialBalance / 2, '0x0', { from: user });
        let result = await bank.stake(initialBalance / 2, '0x0', {
            from: user
        });

        let block = result['receipt']['blockNumber'];

        const userTotalStakedAt = await bank.totalStakedAt.call(block * 2);
        userTotalStakedAt.should.be.bignumber.equal(initialBalance);
    });
});
