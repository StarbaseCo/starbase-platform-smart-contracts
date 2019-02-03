const { latestTime, duration } = require("./helpers/timer");
const TokenSaleCloneFactory = artifacts.require("./TokenSaleCloneFactory.sol");
const TokenSale = artifacts.require("./TokenSale.sol");
const CompanyToken = artifacts.require("./CompanyToken.sol");
const StandardToken = artifacts.require("./StandardToken.sol");

const BigNumber = web3.BigNumber;

contract(
  "TokenSaleCloneFactory",
  ([owner, wallet, _, whitelist]) => {
    let tokenSaleCloneFactory,
      tokenSale,
      starToken,
      companyToken,
      tokenOwnerAfterSale,
      startTime,
      endTime;
    const starRatePer1000 = new BigNumber(10);
    const rate = new BigNumber(50);
    const softCap = new BigNumber(200000); // 200 000
    const crowdsaleCap = new BigNumber(20000000); // 20M
    const isWeiAcceptedDefaultValue = true;
    const isMinting = true;

    beforeEach(async () => {
      startTime = latestTime() + 20; // crowdsale starts in 20 seconds
      endTime = startTime + duration.days(70); // 70 days

      starToken = await StandardToken.new();
      tokenSale = await TokenSale.new();
      tokenSaleCloneFactory = await TokenSaleCloneFactory.new(
        tokenSale.address,
        starToken.address
      );
      companyToken = await CompanyToken.new("Example Token", "EXT");
      tokenOwnerAfterSale = await companyToken.owner();
    });

    describe("tokenSale clone factory contract deployment", () => {
      it("deploys new tokenSale contract", async () => {
        const tokenSaleTx = await tokenSaleCloneFactory.create.call(
          startTime,
          endTime,
          whitelist,
          companyToken.address,
          tokenOwnerAfterSale,
          rate,
          starRatePer1000,
          wallet,
          softCap,
          crowdsaleCap,
          isWeiAcceptedDefaultValue,
          isMinting
        );

        expect(tokenSaleTx).to.exist;
      });

      it("emits ContractInstantiation", async () => {
        const { logs } = await tokenSaleCloneFactory.create(
          startTime,
          endTime,
          whitelist,
          companyToken.address,
          tokenOwnerAfterSale,
          rate,
          starRatePer1000,
          wallet,
          softCap,
          crowdsaleCap,
          isWeiAcceptedDefaultValue,
          isMinting,
          { from: owner }
        );

        const event = logs.find(e => e.event === "ContractInstantiation");
        expect(event).to.exist;

        const { args } = logs[0];
        const { msgSender, instantiation } = args;
        msgSender.should.be.equal(owner);

        const isInstantiation = await tokenSaleCloneFactory.isInstantiation.call(
          instantiation
        );
        isInstantiation.should.be.true;
      });

      it("registers the number of tokenSale contract deployed per address", async () => {
        await tokenSaleCloneFactory.create(
          startTime,
          endTime,
          whitelist,
          companyToken.address,
          tokenOwnerAfterSale,
          rate,
          starRatePer1000,
          wallet,
          softCap,
          crowdsaleCap,
          isWeiAcceptedDefaultValue,
          isMinting,
          { from: owner }
        );

        let numberOfInstantiations = await tokenSaleCloneFactory.getInstantiationCount(
          owner
        );
        numberOfInstantiations.should.be.bignumber.equal(1);

        await tokenSaleCloneFactory.create(
          startTime,
          endTime,
          whitelist,
          companyToken.address,
          tokenOwnerAfterSale,
          rate,
          starRatePer1000,
          wallet,
          softCap,
          crowdsaleCap,
          isWeiAcceptedDefaultValue,
          isMinting,
          { from: owner }
        );

        numberOfInstantiations = await tokenSaleCloneFactory.getInstantiationCount(
          owner
        );
        numberOfInstantiations.should.be.bignumber.equal(2);
      });
    });
  }
);
