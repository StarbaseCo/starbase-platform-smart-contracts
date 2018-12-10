const { ensuresException } = require("./helpers/utils");
const { latestTime, duration } = require("./helpers/timer");
const TokenSaleCloneFactory = artifacts.require("./TokenSaleCloneFactory.sol");
const TokenSale = artifacts.require("./TokenSale.sol");
const CompanyToken = artifacts.require("./CompanyToken.sol");
const StandardToken = artifacts.require("./StandardToken.sol");

const BigNumber = web3.BigNumber;

contract(
  "TokenSaleCloneFactory",
  ([owner, wallet, otherAddress, whitelist]) => {
    let tokenSaleCloneFactory,
      tokenSale,
      starToken,
      newTokenSale,
      companyToken,
      startTime,
      endTime;
    const starRate = new BigNumber(10);
    const rate = new BigNumber(50);
    const crowdsaleCap = new BigNumber(20000000); // 20M
    const isWeiAcceptedDefaultValue = true;

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
    });

    describe("#setLibraryAddress", () => {
      beforeEach(async () => {
        newTokenSale = await TokenSale.new();
      });

      it("does NOT allow a NON owner to set new library address", async () => {
        try {
          await tokenSaleCloneFactory.setLibraryAddress(newTokenSale.address, {
            from: otherAddress
          });
          assert.fail();
        } catch (e) {
          ensuresException(e);
        }

        const libraryAddress = await tokenSaleCloneFactory.libraryAddress();
        libraryAddress.should.be.equal(tokenSale.address);
      });

      it("does NOT allow owner to set an empty address as a library address", async () => {
        try {
          await tokenSaleCloneFactory.setLibraryAddress(
            "0x0000000000000000000000000000000000000000",
            { from: owner }
          );
          assert.fail();
        } catch (e) {
          ensuresException(e);
        }

        const libraryAddress = await tokenSaleCloneFactory.libraryAddress();
        libraryAddress.should.be.equal(tokenSale.address);
      });

      it("allows owner to set new library address", async () => {
        await tokenSaleCloneFactory.setLibraryAddress(newTokenSale.address, {
          from: owner
        });

        const libraryAddress = await tokenSaleCloneFactory.libraryAddress();
        libraryAddress.should.be.equal(newTokenSale.address);
      });
    });

    describe("tokenSale clone factory contract deployment", () => {
      it("deploys new tokenSale contract", async () => {
        const tokenSaleTx = await tokenSaleCloneFactory.create.call(
          startTime,
          endTime,
          whitelist,
          companyToken.address,
          rate,
          starRate,
          wallet,
          crowdsaleCap,
          isWeiAcceptedDefaultValue
        );

        expect(tokenSaleTx).to.exist;
      });

      it("emits ContractInstantiation", async () => {
        const { logs } = await tokenSaleCloneFactory.create(
          startTime,
          endTime,
          whitelist,
          companyToken.address,
          rate,
          starRate,
          wallet,
          crowdsaleCap,
          isWeiAcceptedDefaultValue,
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
          rate,
          starRate,
          wallet,
          crowdsaleCap,
          isWeiAcceptedDefaultValue,
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
          rate,
          starRate,
          wallet,
          crowdsaleCap,
          isWeiAcceptedDefaultValue,
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
