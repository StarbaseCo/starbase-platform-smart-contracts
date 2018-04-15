const StarTokenReturn = artifacts.require('StarTokenReturn.sol');
const TokenMock = artifacts.require('./mocks/Token.sol');

contract('StarTokenReturn', function([user]) {
    let bank, token, returnToken, initialBalance;

    beforeEach(async () => {
        initialBalance = 10000;
        token = await TokenMock.new();
        returnToken = await TokenMock.new();
        bank = await StarTokenReturn.new(token.address, returnToken.address, 2);

        await token.mint(user, initialBalance);
        await returnToken.mint(bank.address, initialBalance * 2);
    });

    it('should transfer tokens to bank when staked', async () => {
        await bank.stake(initialBalance, '0x0');

        assert.equal(await token.balanceOf.call(user), 0);
        assert.equal(await token.balanceOf.call(bank.address), initialBalance);
        assert.equal(
            await returnToken.balanceOf.call(user),
            initialBalance * 2
        );
        assert.equal(await returnToken.balanceOf.call(bank.address), 0);
    });

    it('should transfer tokens to user when staking for someone else', async () => {
        await bank.stakeFor(user, initialBalance, '0x0');

        assert.equal(await token.balanceOf.call(user), 0);
        assert.equal(await token.balanceOf.call(bank.address), initialBalance);
        assert.equal(
            await returnToken.balanceOf.call(user),
            initialBalance * 2
        );
        assert.equal(await returnToken.balanceOf.call(bank.address), 0);
    });

    it('should allow user to unstake tokens', async () => {
        await bank.stake(initialBalance, '0x0');
        assert.equal(await bank.totalStakedFor.call(user), initialBalance);
        assert.equal(
            await returnToken.balanceOf.call(user),
            initialBalance * 2
        );
        assert.equal(await returnToken.balanceOf.call(bank.address), 0);

        let amount = initialBalance / 2;
        await bank.unstake(amount, '0x0');
        assert.equal(await bank.totalStakedFor.call(user), amount);
        assert.equal(
            await returnToken.balanceOf.call(user),
            initialBalance * 2 - amount / 2
        );
        assert.equal(
            await returnToken.balanceOf.call(bank.address),
            amount / 2
        );
    });
});
