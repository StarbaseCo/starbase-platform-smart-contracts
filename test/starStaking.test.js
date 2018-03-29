const StarStaking = artifacts.require('StarStaking.sol');
const TokenMock = artifacts.require('./mocks/Token.sol');
const { increaseTimeTo } = require('./helpers/timer');

contract('StarStaking', function(accounts) {
    let bank, token, initialBalance;

    beforeEach(async () => {
        initialBalance = 10000;
        token = await TokenMock.new();
        bank = await StarStaking.new(token.address);

        await token.mint(accounts[0], initialBalance);
    });

    it('should transfer tokens to bank when staked', async () => {
        await bank.stake(initialBalance, '0x0');

        assert.equal(await token.balanceOf.call(accounts[0]), 0);
        assert.equal(await token.balanceOf.call(bank.address), initialBalance);
    });

    it('should allow user to unstake tokens', async () => {
        await bank.stake(initialBalance, '0x0');
        assert.equal(
            await bank.totalStakedFor.call(accounts[0]),
            initialBalance
        );
        await bank.unstake(initialBalance / 2, '0x0');
        assert.equal(
            await bank.totalStakedFor.call(accounts[0]),
            initialBalance / 2
        );
    });

    it('should allow user to stake for other person', async () => {
        await bank.stakeFor(accounts[1], initialBalance, '0x0');
        assert.equal(
            await bank.totalStakedFor.call(accounts[1]),
            initialBalance
        );
        await bank.unstake(initialBalance / 2, '0x0', { from: accounts[1] });
        assert.equal(
            await bank.totalStakedFor.call(accounts[1]),
            initialBalance / 2
        );
    });

    context('staking constants', async () => {
        let firstBlock;
        let secondBlock;

        beforeEach(async () => {
            firstBlock = web3.eth.blockNumber;
            secondBlock = firstBlock + 5;

            let result = await bank.stake(initialBalance / 2, '0x0');
            firstBlock = result['receipt']['blockNumber'];

            await increaseTimeTo(secondBlock);

            result = await bank.stake(initialBalance / 2, '0x0');
            secondBlock = result['receipt']['blockNumber'];
        });

        it('should return full staked value when calling totalStaked', async () => {
            assert.equal(
                await bank.totalStakedFor.call(accounts[0]),
                initialBalance
            );
        });

        it('should return correct amount staked at block', async () => {
            assert.equal(
                await bank.totalStakedForAt.call(accounts[0], firstBlock),
                initialBalance / 2
            );
        });

        it('should return correct block when calling lastStaked', async () => {
            assert.equal(
                await bank.lastStakedFor.call(accounts[0]),
                secondBlock
            );
        });

        it('should return correct amount staked at block in future', async () => {
            assert.equal(
                await bank.totalStakedForAt.call(accounts[0], secondBlock * 2),
                initialBalance
            );
        });
    });

    it('should return correct total amount staked', async () => {
        await bank.stake(initialBalance / 2, '0x0', { from: accounts[0] });
        let result = await bank.stake(initialBalance / 2, '0x0', {
            from: accounts[1]
        });

        let block = result['receipt']['blockNumber'];
        assert.equal(await bank.totalStakedAt.call(block * 2), initialBalance);
    });
});
