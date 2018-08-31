const TokenSale = artifacts.require("./TokenSale.sol");
const TokenSaleCloneFactory = artifacts.require("./TokenSaleCloneFactory.sol");
const CompanyToken = artifacts.require("./CompanyToken.sol");
const MintableToken = artifacts.require("./MintableToken.sol");
const Whitelist = artifacts.require("./Whitelist.sol");

const { should, ensuresException } = require("./helpers/utils");
const { latestTime, duration, increaseTimeTo } = require("./helpers/timer");
const expect = require("chai").expect;

const BigNumber = web3.BigNumber;

contract("TokenSale", ([owner, wallet, buyer, buyer2, user1, fakeWallet]) => {
  const starRate = new BigNumber(10);
  const newStarRate = new BigNumber(20);
  const rate = new BigNumber(50);
  const newRate = new BigNumber(60);
  const value = 1e18;
  const isWeiAcceptedDefaultValue = false;

  const crowdsaleCap = new BigNumber(20000000); // 20M

  let startTime, endTime;
  let crowdsale, token, star, whitelist;
  let crowdsaleTokensLeftover;

  const newCrowdsale = async (rate, starRate) => {
    startTime = latestTime() + 15; // crowdsale starts in seconds into the future
    endTime = startTime + duration.days(70); // 70 days

    whitelist = await Whitelist.new();
    star = await MintableToken.new();
    token = await CompanyToken.new("Example Token", "EXT", 18);
    const tokenSaleLibrary = await TokenSale.new();

    const tokenSaleFactory = await TokenSaleCloneFactory.new(
      tokenSaleLibrary.address,
      star.address
    );
    const tx = await tokenSaleFactory.create(
      startTime,
      endTime,
      whitelist.address,
      token.address,
      rate,
      starRate,
      wallet,
      crowdsaleCap,
      isWeiAcceptedDefaultValue
    );

    const event = tx.logs.find(
      event => event.event === "ContractInstantiation"
    );

    crowdsale = TokenSale.at(event.args.instantiation);
  };

  beforeEach("initialize contract", async () => {
    await newCrowdsale(rate, starRate);
  });

  afterEach(
    "check for invariant: total token supply <= total token cap",
    async () => {
      expect(await token.totalSupply()).to.be.bignumber.most(
        await crowdsale.crowdsaleCap()
      );
    }
  );

  it("deployment fails when both starRate and rate are zero", async () => {
    try {
      await newCrowdsale(0, 0);
      assert.fail();
    } catch (error) {
      ensuresException(error);
    }
  });

  it("deployment succeds when either starRate or rate are set", async () => {
    await newCrowdsale(rate, 0);
    // deployment without starRate
    (await crowdsale.starRate()).should.be.bignumber.eq(0);

    // deployment without rate
    await newCrowdsale(0, starRate);
    (await crowdsale.rate()).should.be.bignumber.eq(0);
  });

  it("has a normal crowdsale rate", async () => {
    const crowdsaleRate = await crowdsale.rate();
    crowdsaleRate.toNumber().should.equal(rate.toNumber());
  });

  it("has a normal crowdsale starRate", async () => {
    const crowdsaleStarRate = await crowdsale.starRate();
    crowdsaleStarRate.toNumber().should.equal(starRate.toNumber());
  });

  it("has a whitelist contract", async () => {
    const whitelistContract = await crowdsale.whitelist();
    whitelistContract.should.equal(whitelist.address);
  });

  it("has a token contract", async () => {
    const tokenContract = await crowdsale.tokenOnSale();
    tokenContract.should.equal(token.address);
  });

  it("has a star contract", async () => {
    const starContract = await crowdsale.starToken();
    starContract.should.equal(star.address);
  });

  it("has a wallet", async () => {
    const walletAddress = await crowdsale.wallet();
    walletAddress.should.equal(wallet);
  });

  it("owner is the tx originator and NOT the tokenSaleCloneFactory", async () => {
    const contractOwner = await crowdsale.owner();
    contractOwner.should.equal(owner);
  });

  it("has a crowdsaleCap variable", async () => {
    const crowdsaleCapFigure = await crowdsale.crowdsaleCap();

    crowdsaleCapFigure.should.be.bignumber.equal(crowdsaleCap * 1e18);
  });

  it("starts with token paused", async () => {
    const paused = await token.paused();
    paused.should.be.true;
  });

  it("saves the initial token owner", async () => {
    const tokenOwner = await token.owner();
    const initialTokenOwner = await crowdsale.initialTokenOwner();
    initialTokenOwner.should.be.equal(tokenOwner);
  });

  it("cannot call init again once initial values are set", async () => {
    // attempt to override initial values should throw exceptions
    try {
      await crowdsale.init(
        latestTime() + 2,
        endTime,
        whitelist.address,
        star.address,
        token.address,
        rate,
        starRate,
        fakeWallet,
        crowdsaleCap,
        isWeiAcceptedDefaultValue
      );
      assert.fail();
    } catch (error) {
      ensuresException(error);
    }

    const crowdsaleWallet = await crowdsale.wallet();
    // fakeWallet did not override wallet
    crowdsaleWallet.should.be.bignumber.equal(wallet);
  });

  describe("changing rate", () => {
    it("does NOT allow anyone to change rate other than the owner", async () => {
      try {
        await crowdsale.setRate(newRate, { from: buyer });
        assert.fail();
      } catch (e) {
        ensuresException(e);
      }

      const rate = await crowdsale.rate();
      rate.should.be.bignumber.equal(rate);
    });

    it("cannot set a rate that is zero", async () => {
      const zeroRate = new BigNumber(0);

      try {
        await crowdsale.setRate(zeroRate, { from: owner });
        assert.fail();
      } catch (e) {
        ensuresException(e);
      }

      const rate = await crowdsale.rate();
      rate.should.be.bignumber.equal(rate);
    });

    it("allows owner to change rate", async () => {
      const { logs } = await crowdsale.setRate(newRate, {
        from: owner
      });

      const event = logs.find(e => e.event === "TokenRateChanged");
      should.exist(event);

      const rate = await crowdsale.rate();
      rate.should.be.bignumber.equal(newRate);
    });
  });

  describe("changing starRate", () => {
    it("does NOT allows anyone to change starRate other than the owner", async () => {
      try {
        await crowdsale.setStarRate(newStarRate, { from: buyer });
        assert.fail();
      } catch (e) {
        ensuresException(e);
      }

      const starRate = await crowdsale.starRate();
      starRate.should.be.bignumber.equal(starRate);
    });

    it("cannot set a starRate that is zero", async () => {
      const zeroStarRate = new BigNumber(0);

      try {
        await crowdsale.setStarRate(zeroStarRate, { from: owner });
        assert.fail();
      } catch (e) {
        ensuresException(e);
      }

      const starRate = await crowdsale.starRate();
      starRate.should.be.bignumber.equal(starRate);
    });

    it("allows owner to change starRate", async () => {
      const { logs } = await crowdsale.setStarRate(newStarRate, {
        from: owner
      });

      const event = logs.find(e => e.event === "TokenStarRateChanged");
      should.exist(event);

      const starRate = await crowdsale.starRate();
      starRate.should.be.bignumber.equal(newStarRate);
    });
  });

  describe("#isWeiAccepted", () => {
    it("does NOT allows anyone to set isWeiAccepted other than the owner", async () => {
      try {
        await crowdsale.setIsWeiAccepted(true, { from: buyer });
        assert.fail();
      } catch (e) {
        ensuresException(e);
      }

      const isWeiAccepted = await crowdsale.isWeiAccepted();
      isWeiAccepted.should.be.false;
    });

    it("requires rate to be set", async () => {
      await newCrowdsale(0, starRate);

      try {
        await crowdsale.setIsWeiAccepted(true, { from: owner });
        assert.fail();
      } catch (e) {
        ensuresException(e);
      }

      const isWeiAccepted = await crowdsale.isWeiAccepted();
      isWeiAccepted.should.be.false;
    });

    it("allows owner to set isWeiAccepted", async () => {
      await crowdsale.setIsWeiAccepted(true, { from: owner });

      let isWeiAccepted = await crowdsale.isWeiAccepted();
      isWeiAccepted.should.be.true;

      await crowdsale.setIsWeiAccepted(false, { from: owner });

      isWeiAccepted = await crowdsale.isWeiAccepted();
      isWeiAccepted.should.be.false;
    });
  });

  describe("whitelist", () => {
    it("only allows owner to add to the whitelist", async () => {
      await increaseTimeTo(latestTime() + duration.days(1));

      try {
        await whitelist.addManyToWhitelist([buyer, buyer2], {
          from: buyer
        });
        assert.fail();
      } catch (e) {
        ensuresException(e);
      }

      let isBuyerWhitelisted = await whitelist.allowedAddresses.call(buyer);
      isBuyerWhitelisted.should.be.false;

      await whitelist.addManyToWhitelist([buyer, buyer2], {
        from: owner
      });

      isBuyerWhitelisted = await whitelist.allowedAddresses.call(buyer);
      isBuyerWhitelisted.should.be.true;
    });

    it("only allows owner to remove from the whitelist", async () => {
      await increaseTimeTo(latestTime() + duration.days(1));
      await whitelist.addManyToWhitelist([buyer, buyer2], {
        from: owner
      });

      try {
        await whitelist.removeManyFromWhitelist([buyer], {
          from: buyer2
        });
        assert.fail();
      } catch (e) {
        ensuresException(e);
      }

      let isBuyerWhitelisted = await whitelist.allowedAddresses.call(buyer2);
      isBuyerWhitelisted.should.be.true;

      await whitelist.removeManyFromWhitelist([buyer], { from: owner });

      isBuyerWhitelisted = await whitelist.allowedAddresses.call(buyer);
      isBuyerWhitelisted.should.be.false;
    });

    it("shows whitelist addresses", async () => {
      await increaseTimeTo(latestTime() + duration.days(1));
      await whitelist.addManyToWhitelist([buyer, buyer2], {
        from: owner
      });

      const isBuyerWhitelisted = await whitelist.allowedAddresses.call(buyer);
      const isBuyer2Whitelisted = await whitelist.allowedAddresses.call(buyer2);

      isBuyerWhitelisted.should.be.true;
      isBuyer2Whitelisted.should.be.true;
    });

    it("has WhitelistUpdated event", async () => {
      await increaseTimeTo(latestTime() + duration.days(1));
      const { logs } = await whitelist.addManyToWhitelist([buyer, buyer2], {
        from: owner
      });

      const event = logs.find(e => e.event === "WhitelistUpdated");
      expect(event).to.exist;
    });

    it("has WhitelistUpdated event upon removal", async () => {
      await whitelist.addToWhitelist([buyer]);

      let tx = await whitelist.removeManyFromWhitelist([buyer], {
        from: owner
      });
      let entry = tx.logs.find(entry => entry.event === "WhitelistUpdated");

      expect(entry).to.exist;
      expect(entry.args.operation).to.be.equal("Removed");
      expect(entry.args.member).to.be.bignumber.equal(buyer);
    });
  });

  describe("token purchases", () => {
    beforeEach("initialize contract", async () => {
      await whitelist.addManyToWhitelist([buyer, buyer2]);
      await token.transferOwnership(crowdsale.address);

      await star.mint(buyer, 10e18);
      await star.mint(user1, 10e18);
    });

    it("cannot buy with empty beneficiary address", async () => {
      await increaseTimeTo(latestTime() + duration.days(52));

      await star.approve(crowdsale.address, 5e18, { from: buyer });

      try {
        await crowdsale.buyTokens("0x00", { from: buyer });
        assert.fail();
      } catch (e) {
        ensuresException(e);
      }

      const buyerBalance = await token.balanceOf(buyer);
      buyerBalance.should.be.bignumber.equal(0);
    });

    it("allows ONLY whitelisted addresses to purchase tokens", async () => {
      await increaseTimeTo(latestTime() + duration.days(52));

      await star.approve(crowdsale.address, 5e18, { from: buyer });
      // user1 is not whitelisted
      await star.approve(crowdsale.address, 5e18, { from: user1 });

      try {
        await crowdsale.buyTokens(user1, { from: user1 });
        assert.fail();
      } catch (e) {
        ensuresException(e);
      }

      const userBalance = await token.balanceOf(user1);
      userBalance.should.be.bignumber.equal(0);

      // purchase occurrence
      await crowdsale.buyTokens(buyer, { from: buyer });

      const buyerBalance = await token.balanceOf(buyer);
      buyerBalance.should.be.bignumber.equal(50e18);
    });

    it("allows ONLY STAR tokens to purchase tokens at first", async () => {
      await increaseTimeTo(latestTime() + duration.days(22));

      await star.approve(crowdsale.address, 5e18, { from: buyer });

      try {
        await crowdsale.buyTokens(buyer, { from: owner, value });
        assert.fail();
      } catch (e) {
        ensuresException(e);
      }

      // purchase happens
      await crowdsale.buyTokens(buyer, { from: owner });

      // only the STAR purchase
      const buyerBalance = await token.balanceOf(buyer);
      buyerBalance.should.be.bignumber.equal(50e18);
    });

    it("cannot buy tokens by sending star transaction to contract", async () => {
      await increaseTimeTo(latestTime() + duration.days(52));

      await whitelist.addManyToWhitelist([user1]);
      await star.approve(crowdsale.address, 5e18, { from: user1 });

      try {
        await crowdsale.sendTransaction({ from: user1 });
        assert.fail();
      } catch (e) {
        ensuresException(e);
      }

      const buyerBalance = await token.balanceOf(buyer);
      buyerBalance.should.be.bignumber.equal(0);
    });

    it("cannot buy tokens by sending wei when isWeiAccepted is disabled", async () => {
      await increaseTimeTo(latestTime() + duration.days(22));
      await whitelist.addManyToWhitelist([user1]);

      try {
        await crowdsale.buyTokens(user1, { from: user1, value });
        assert.fail();
      } catch (e) {
        ensuresException(e);
      }

      const userBalance = await token.balanceOf(user1);
      userBalance.should.be.bignumber.equal(0);

      // purchase occurence
      await crowdsale.setIsWeiAccepted(true, { from: owner });
      await crowdsale.buyTokens(user1, { from: user1, value });

      const buyerBalance = await token.balanceOf(user1);
      buyerBalance.should.be.bignumber.equal(50e18);
    });

    it("buys tokens by sending wei when it is enabled", async () => {
      await increaseTimeTo(latestTime() + duration.days(52));
      await whitelist.addManyToWhitelist([user1]);
      await crowdsale.setIsWeiAccepted(true, { from: owner });

      await crowdsale.buyTokens(user1, { from: user1, value });

      const userBalance = await token.balanceOf(user1);
      userBalance.should.be.bignumber.equal(50e18);

      await crowdsale.buyTokens(user1, { from: user1, value });

      const buyerBalance = await token.balanceOf(user1);
      buyerBalance.should.be.bignumber.equal(100e18);
    });

    it("updates wei raised", async () => {
      await increaseTimeTo(latestTime() + duration.days(52));
      await whitelist.addManyToWhitelist([user1]);
      await crowdsale.setIsWeiAccepted(true);

      await crowdsale.buyTokens(user1, { from: user1, value });

      let weiRaised = await crowdsale.weiRaised();
      weiRaised.should.be.bignumber.equal(1e18);

      await crowdsale.buyTokens(user1, { from: user1, value });

      weiRaised = await crowdsale.weiRaised();
      weiRaised.should.be.bignumber.equal(2e18);
    });

    it("does NOT buy tokens when crowdsale is paused", async () => {
      await increaseTimeTo(latestTime() + duration.days(52));

      await star.approve(crowdsale.address, 5e18, { from: buyer });

      await crowdsale.pause();
      let buyerBalance;

      try {
        await crowdsale.buyTokens(buyer, { from: buyer });
        assert.fail();
      } catch (e) {
        ensuresException(e);
      }

      buyerBalance = await token.balanceOf(buyer);
      buyerBalance.should.be.bignumber.equal(0);

      await crowdsale.unpause();
      await crowdsale.buyTokens(buyer, { from: buyer });

      buyerBalance = await token.balanceOf(buyer);
      buyerBalance.should.be.bignumber.equal(50e18);
    });

    it("does NOT allow purchase when token ownership does not currently belong to crowdsale contract", async () => {
      await newCrowdsale(rate, starRate);
      await whitelist.addManyToWhitelist([buyer, user1]);

      await star.mint(buyer, 10e18);
      await star.mint(user1, 10e18);

      await star.approve(crowdsale.address, 5e18, { from: user1 });
      await star.approve(crowdsale.address, 5e18, { from: buyer });

      await increaseTimeTo(latestTime() + duration.days(52));

      try {
        await crowdsale.buyTokens(buyer, {
          from: buyer
        });
        assert.fail();
      } catch (e) {
        ensuresException(e);
      }

      const buyerBalance = await token.balanceOf(buyer);
      buyerBalance.should.be.bignumber.equal(0);

      await token.transferOwnership(crowdsale.address);

      await crowdsale.buyTokens(user1, {
        from: user1
      });

      const userBalance = await token.balanceOf(user1);
      userBalance.should.be.bignumber.equal(50e18);
    });

    it("updates STAR raised", async () => {
      await increaseTimeTo(latestTime() + duration.days(52));

      await star.approve(crowdsale.address, 8e18, { from: buyer });

      // puchase occurence
      await crowdsale.buyTokens(buyer, { from: owner });

      const buyerBalance = await token.balanceOf(buyer);
      buyerBalance.should.be.bignumber.equal(80e18);

      const starRaised = await crowdsale.starRaised();
      starRaised.should.be.bignumber.equal(8e18);
    });

    it("sends STAR raised to wallet", async () => {
      await newCrowdsale(crowdsaleCap, crowdsaleCap);
      await whitelist.addManyToWhitelist([buyer]);
      await token.transferOwnership(crowdsale.address);
      await star.mint(buyer, 10e18);
      await star.approve(crowdsale.address, 1, { from: buyer });

      await increaseTimeTo(latestTime() + duration.days(34));

      await crowdsale.buyTokens(buyer, { from: buyer });

      const buyerBalance = await token.balanceOf(buyer);
      buyerBalance.should.be.bignumber.equal(crowdsaleCap);

      const walletBalance = await star.balanceOf(wallet);
      walletBalance.should.be.bignumber.equal(1);
    });

    it("mints tokens up to crowdsale cap when buying with wei and sends remaining wei back to the buyer", async () => {
      await newCrowdsale(crowdsaleCap, crowdsaleCap);
      await whitelist.addManyToWhitelist([buyer]);
      await token.transferOwnership(crowdsale.address);

      await increaseTimeTo(latestTime() + duration.days(52));

      const buyerWeiBalanceBeforePurchase = web3.eth.getBalance(buyer);

      await crowdsale.setIsWeiAccepted(true);
      await crowdsale.buyTokens(buyer, { from: buyer, value: value * 3 });

      const buyerBalance = await token.balanceOf(buyer);
      buyerBalance.should.be.bignumber.equal(crowdsaleCap.mul(1e18));

      const buyerWeiBalanceAfterPurchase = web3.eth.getBalance(buyer);

      buyerWeiBalanceAfterPurchase
        .toNumber()
        .should.be.approximately(
          buyerWeiBalanceBeforePurchase.toNumber() - 1e18,
          1e17
        );

      try {
        await crowdsale.buyTokens(buyer, { value, from: buyer });
        assert.fail();
      } catch (e) {
        ensuresException(e);
      }
    });

    it("transfers received wei to wallet", async () => {
      let walletBalanceBefore = await web3.eth.getBalance(wallet);

      await increaseTimeTo(latestTime() + duration.days(52));
      await whitelist.addManyToWhitelist([user1]);
      await crowdsale.setIsWeiAccepted(true);

      await crowdsale.buyTokens(user1, { from: user1, value });

      let walletBalanceAfter = await web3.eth.getBalance(wallet);

      expect(walletBalanceAfter).to.be.bignumber.least(
        walletBalanceBefore.plus(value)
      );
    });

    it("only mints tokens up to crowdsale cap", async () => {
      await newCrowdsale(crowdsaleCap, crowdsaleCap);
      await whitelist.addManyToWhitelist([buyer]);
      await token.transferOwnership(crowdsale.address);
      await star.mint(buyer, 10e18);
      await star.approve(crowdsale.address, 2e18, { from: buyer });

      await increaseTimeTo(latestTime() + duration.days(34));

      await crowdsale.buyTokens(buyer, { from: buyer });

      let buyerBalance = await token.balanceOf(buyer);
      buyerBalance.should.be.bignumber.equal(crowdsaleCap * 1e18);

      try {
        await crowdsale.buyTokens(buyer, { from: buyer });
        assert.fail();
      } catch (error) {
        ensuresException(error);
      }

      buyerBalance = await token.balanceOf(buyer);
      buyerBalance.should.be.bignumber.equal(crowdsaleCap * 1e18);
    });

    it("ends crowdsale when all tokens are sold", async () => {
      await newCrowdsale(crowdsaleCap, crowdsaleCap);
      await whitelist.addManyToWhitelist([buyer]);
      await token.transferOwnership(crowdsale.address);
      await star.mint(buyer, 10e18);
      await star.approve(crowdsale.address, 1e18, { from: buyer });

      await increaseTimeTo(latestTime() + duration.days(34));

      await crowdsale.buyTokens(buyer, { from: buyer });

      const hasEnded = await crowdsale.hasEnded();
      hasEnded.should.be.true;
    });

    it("ends crowdsale when all tokens are sold with wei", async () => {
      await newCrowdsale(crowdsaleCap, crowdsaleCap);
      await whitelist.addManyToWhitelist([buyer]);
      await token.transferOwnership(crowdsale.address);

      await increaseTimeTo(latestTime() + duration.days(54));
      await crowdsale.setIsWeiAccepted(true);
      await crowdsale.buyTokens(buyer, { from: buyer, value });

      const hasEnded = await crowdsale.hasEnded();
      hasEnded.should.be.true;
    });
  });

  describe("crowdsale finalization", function() {
    beforeEach(async () => {
      crowdsaleTokensLeftover = 10;

      await newCrowdsale(
        crowdsaleCap.sub(crowdsaleTokensLeftover),
        crowdsaleCap.sub(crowdsaleTokensLeftover)
      );
      await whitelist.addManyToWhitelist([buyer]);
      await token.transferOwnership(crowdsale.address);

      await star.mint(buyer, 1e18);

      await increaseTimeTo(latestTime() + duration.days(52));

      await star.approve(crowdsale.address, 1e18, { from: buyer });
      await crowdsale.buyTokens(buyer, { from: buyer });

      await increaseTimeTo(latestTime() + duration.days(30));

      await crowdsale.finalize();
    });

    it("shows that crowdsale is finalized", async function() {
      const isCrowdsaleFinalized = await crowdsale.isFinalized();
      isCrowdsaleFinalized.should.be.true;
    });

    it("returns token ownership to original owner", async function() {
      const initialTokenOwner = await crowdsale.initialTokenOwner();
      const tokenOwner = await token.owner();
      tokenOwner.should.be.equal(initialTokenOwner);
    });

    it("mints remaining crowdsale tokens to wallet", async function() {
      const buyerBalance = await token.balanceOf(buyer);

      const walletTokenBalance = await token.balanceOf(wallet);

      walletTokenBalance.should.be.bignumber.equal(
        crowdsaleTokensLeftover * 1e18
      );
    });
  });
});
