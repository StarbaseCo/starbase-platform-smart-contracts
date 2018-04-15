const StarStaking = artifacts.require('StarStaking.sol');
const TokenMock = artifacts.require('./mocks/Token.sol');
const { increaseTimeTo, latestTime } = require('./helpers/timer');

contract('StarStaking', function([user]) {
    let bank, token, initialBalance;

    beforeEach(async () => {
        initialBalance = 10000;
        token = await TokenMock.new();
        bank = await StarStaking.new(token.address);

        await token.mint(user, initialBalance);
    });

    it('should transfer tokens to bank when staked', async () => {
        await bank.stake(initialBalance, '0x0');

        assert.equal(await token.balanceOf.call(user), 0);
        assert.equal(await token.balanceOf.call(bank.address), initialBalance);
    });

    it('should allow user to unstake tokens', async () => {
        await bank.stake(initialBalance, '0x0');
        assert.equal(await bank.totalStakedFor.call(user), initialBalance);
        await bank.unstake(initialBalance / 2, '0x0');
        assert.equal(await bank.totalStakedFor.call(user), initialBalance / 2);
    });

    it('should allow user to stake for other person', async () => {
        await bank.stakeFor(user, initialBalance, '0x0');
        assert.equal(await bank.totalStakedFor.call(user), initialBalance);
        await bank.unstake(initialBalance / 2, '0x0', { from: user });
        assert.equal(await bank.totalStakedFor.call(user), initialBalance / 2);
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

        it('should return full staked value when calling totalStaked', async () => {
            assert.equal(await bank.totalStakedFor.call(user), initialBalance);
        });

        it('should return correct amount staked at block', async () => {
            assert.equal(
                await bank.totalStakedForAt.call(user, firstBlock),
                initialBalance / 2
            );
        });

        it('should return correct block when calling lastStaked', async () => {
            assert.equal(await bank.lastStakedFor.call(user), secondBlock);
        });

        it('should return correct amount staked at block in future', async () => {
            assert.equal(
                await bank.totalStakedForAt.call(user, secondBlock * 2),
                initialBalance
            );
        });
    });

    it('should return correct total amount staked', async () => {
        await bank.stake(initialBalance / 2, '0x0', { from: user });
        let result = await bank.stake(initialBalance / 2, '0x0', {
            from: user
        });

        let block = result['receipt']['blockNumber'];
        assert.equal(await bank.totalStakedAt.call(block * 2), initialBalance);
    });
});
