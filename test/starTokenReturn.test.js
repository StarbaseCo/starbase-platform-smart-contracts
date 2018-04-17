const StarTokenReturn = artifacts.require('StarTokenReturn.sol');
const TokenMock = artifacts.require('./mocks/Token.sol');

const { should } = require('./helpers/utils');

contract('StarTokenReturn', function([user, user2]) {
    let bank, token, returnToken, initialBalance;

    beforeEach(async () => {
        initialBalance = 10000;
        token = await TokenMock.new();
        returnToken = await TokenMock.new();
        bank = await StarTokenReturn.new(token.address, returnToken.address, 2);

        await token.mint(user, initialBalance);
        await returnToken.mint(bank.address, initialBalance * 2);
    });

    it('transfers tokens to bank when staked', async () => {
        await bank.stake(initialBalance, '0x0');

        const userBalance = await token.balanceOf.call(user);
        const bankBalance = await token.balanceOf.call(bank.address);

        userBalance.should.be.bignumber.equal(0);
        bankBalance.should.be.bignumber.equal(initialBalance);

        const returnUserBalance = await returnToken.balanceOf.call(user);
        const returnBankBalance = await returnToken.balanceOf.call(
            bank.address
        );

        returnUserBalance.should.be.bignumber.equal(initialBalance * 2);
        returnBankBalance.should.be.bignumber.equal(0);
    });

    it('transfers tokens to user when staking for someone else', async () => {
        await bank.stakeFor(user2, initialBalance, '0x0', { from: user });

        const user2Balance = await token.balanceOf.call(user2);
        const bankBalance = await token.balanceOf.call(bank.address);

        user2Balance.should.be.bignumber.equal(0);
        bankBalance.should.be.bignumber.equal(initialBalance);

        const returnUser2Balance = await returnToken.balanceOf.call(user2);
        const returnBankBalance = await returnToken.balanceOf.call(
            bank.address
        );

        returnUser2Balance.should.be.bignumber.equal(initialBalance * 2);
        returnBankBalance.should.be.bignumber.equal(0);
    });

    it('allows user to unstake tokens', async () => {
        await bank.stake(initialBalance, '0x0');

        let userTotalStaked = await bank.totalStakedFor.call(user);
        userTotalStaked.should.be.bignumber.equal(initialBalance);

        let returnUserBalance = await returnToken.balanceOf.call(user);
        let returnBankBalance = await returnToken.balanceOf.call(bank.address);

        returnUserBalance.should.be.bignumber.equal(initialBalance * 2);
        returnBankBalance.should.be.bignumber.equal(0);

        let amount = initialBalance / 2;
        await bank.unstake(amount, '0x0');

        userTotalStaked = await bank.totalStakedFor.call(user);
        userTotalStaked.should.be.bignumber.equal(amount);

        returnUserBalance = await returnToken.balanceOf.call(user);
        returnBankBalance = await returnToken.balanceOf.call(bank.address);

        returnUserBalance.should.be.bignumber.equal(
            initialBalance * 2 - amount / 2
        );
        returnBankBalance.should.be.bignumber.equal(amount / 2);
    });
});
