const StarStakingWithTokenReturn = artifacts.require(
    'StarStakingWithTokenReturn.sol'
);
const MintableToken = artifacts.require('MintableToken.sol');

const { should } = require('./helpers/utils');

contract('StarStakingWithTokenReturn', function([user, user2]) {
    let stakingContract, token, returnToken, initialBalance;

    beforeEach(async () => {
        initialBalance = 10000;
        token = await MintableToken.new();
        returnToken = await MintableToken.new();
        stakingContract = await StarStakingWithTokenReturn.new(
            token.address,
            returnToken.address,
            2
        );

        await token.mint(user, initialBalance);
        await token.approve(stakingContract.address, initialBalance, {
            from: user
        });
        await returnToken.mint(stakingContract.address, initialBalance * 2);
    });

    it('transfers tokens to stakingContract when staked', async () => {
        await stakingContract.stake(initialBalance);

        const userBalance = await token.balanceOf.call(user);
        const stakingContractBalance = await token.balanceOf.call(
            stakingContract.address
        );

        userBalance.should.be.bignumber.equal(0);
        stakingContractBalance.should.be.bignumber.equal(initialBalance);

        const returnUserBalance = await returnToken.balanceOf.call(user);
        const returnBankBalance = await returnToken.balanceOf.call(
            stakingContract.address
        );

        returnUserBalance.should.be.bignumber.equal(initialBalance * 2);
        returnBankBalance.should.be.bignumber.equal(0);
    });

    it('transfers tokens to user when staking for someone else', async () => {
        await stakingContract.stakeFor(user2, initialBalance, { from: user });

        const user2Balance = await token.balanceOf.call(user2);
        const stakingContractBalance = await token.balanceOf.call(
            stakingContract.address
        );

        user2Balance.should.be.bignumber.equal(0);
        stakingContractBalance.should.be.bignumber.equal(initialBalance);

        const returnUser2Balance = await returnToken.balanceOf.call(user2);
        const returnBankBalance = await returnToken.balanceOf.call(
            stakingContract.address
        );

        returnUser2Balance.should.be.bignumber.equal(initialBalance * 2);
        returnBankBalance.should.be.bignumber.equal(0);
    });

    it('allows user to unstake tokens', async () => {
        await stakingContract.stake(initialBalance);

        let userTotalStaked = await stakingContract.totalStakedFor.call(user);
        userTotalStaked.should.be.bignumber.equal(initialBalance);

        let returnUserBalance = await returnToken.balanceOf.call(user);
        let returnBankBalance = await returnToken.balanceOf.call(
            stakingContract.address
        );

        returnUserBalance.should.be.bignumber.equal(initialBalance * 2);
        returnBankBalance.should.be.bignumber.equal(0);

        let amount = initialBalance / 2;
        await returnToken.approve(stakingContract.address, amount, {
            from: user
        });
        await stakingContract.unstake(amount);

        userTotalStaked = await stakingContract.totalStakedFor.call(user);
        userTotalStaked.should.be.bignumber.equal(amount);

        returnUserBalance = await returnToken.balanceOf.call(user);
        returnBankBalance = await returnToken.balanceOf.call(
            stakingContract.address
        );

        returnUserBalance.should.be.bignumber.equal(
            initialBalance * 2 - amount / 2
        );
        returnBankBalance.should.be.bignumber.equal(amount / 2);
    });
});
