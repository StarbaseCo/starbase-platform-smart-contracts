const FundsSplitter = artifacts.require("./FundsSplitter.sol");
const MintableToken = artifacts.require("./MintableToken.sol");

contract("FundsSplitter", ([_, client, starbase]) => {
  let token, tokenOnSale, fundsSplitter;
  const starbasePercentageNumber = 10;

  beforeEach(async () => {
    token = await MintableToken.new();
    tokenOnSale = await MintableToken.new();
    fundsSplitter = await FundsSplitter.new(
      client,
      starbase,
      starbasePercentageNumber,
      token.address,
      tokenOnSale.address,
    );
  });

  describe("#splitFunds", () => {
    it("split funds between client and starbase", async () => {
        const clientBalanceBefore = await web3.eth.getBalance(client);
        const starbaseBalanceBefore = await web3.eth.getBalance(starbase);

        await fundsSplitter.sendTransaction({ from: _, value: 20e18 });

        const clientBalanceAfter = await web3.eth.getBalance(client);
        const starbaseBalanceAfter = await web3.eth.getBalance(starbase);

        const clientBalanceDifference = clientBalanceAfter.minus(clientBalanceBefore);
        const starbaseBalanceDifference = starbaseBalanceAfter.minus(starbaseBalanceBefore);

        starbaseBalanceDifference.should.be.bignumber.equal(2e18);
        clientBalanceDifference.should.be.bignumber.equal(18e18);
    });
  });

  describe("#splitStarFunds", () => {
    beforeEach(async () => {
        token.mint(fundsSplitter.address, 10e18);
    });

    it("split funds between client and starbase", async () => {
        await fundsSplitter.splitStarFunds({ from: _ });

        const clientStarBalance = await token.balanceOf(client);
        const starbaseStarBalance = await token.balanceOf(starbase);

        starbaseStarBalance.should.be.bignumber.equal(1e18);
        clientStarBalance.should.be.bignumber.equal(9e18);
    });
  });

  describe("#withdrawRemainingTokens", () => {
    beforeEach(async () => {
      tokenOnSale.mint(fundsSplitter.address, 10e18);
    });

    it("withdraw all remaining tokens on sale to client", async () => {
        await fundsSplitter.withdrawRemainingTokens({ from: _ });

        const clientStarBalance = await tokenOnSale.balanceOf(client);
        clientStarBalance.should.be.bignumber.equal(10e18);
    });
  });
});
