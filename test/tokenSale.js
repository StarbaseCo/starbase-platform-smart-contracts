const TokenSale = artifacts.require('./TokenSale.sol');
const TokenMold = artifacts.require('./TokenMold.sol');
const MintableToken = artifacts.require('./MintableToken.sol');
const Whitelist = artifacts.require('./Whitelist.sol');

const { should, ensuresException } = require('./helpers/utils');
const { latestTime, duration, increaseTimeTo } = require('./helpers/timer');
const expect = require('chai').expect;

const BigNumber = web3.BigNumber;

contract('TokenSale', ([owner, wallet, buyer, buyer2, user1]) => {
    const rate = new BigNumber(10);
    const newRate = new BigNumber(20);

    const value = new BigNumber(1);

    const totalTokensForCrowdsale = new BigNumber(20000000e18);

    let startTime, endTime;
    let crowdsale, token, star, whitelist;

    const newCrowdsale = rate => {
        startTime = latestTime() + 2; // crowdsale starts in 2 seconds
        endTime = startTime + duration.days(70); // 70 days

        return Whitelist.new()
            .then(whitelistRegistry => {
                whitelist = whitelistRegistry;
                return MintableToken.new();
            })
            .then(mintableToken => {
                star = mintableToken;
                return TokenMold.new('Example Token', 'EXT', 18);
            })
            .then(tokenMold => {
                token = tokenMold;
                return TokenSale.new(
                    startTime,
                    endTime,
                    whitelist.address,
                    star.address,
                    token.address,
                    rate,
                    wallet,
                    totalTokensForCrowdsale
                );
            });
    };

    beforeEach('initialize contract', async () => {
        crowdsale = await newCrowdsale(rate);
    });

    it('has a normal crowdsale rate', async () => {
        const crowdsaleRate = await crowdsale.rate();
        crowdsaleRate.toNumber().should.equal(rate.toNumber());
    });

    it('has a whitelist contract', async () => {
        const whitelistContract = await crowdsale.whitelist();
        whitelistContract.should.equal(whitelist.address);
    });

    it('has a token contract', async () => {
        const tokenContract = await crowdsale.token();
        tokenContract.should.equal(token.address);
    });

    it('has a star contract', async () => {
        const starContract = await crowdsale.star();
        starContract.should.equal(star.address);
    });

    it('has a wallet', async () => {
        const walletAddress = await crowdsale.wallet();
        walletAddress.should.equal(wallet);
    });

    it('has a totalTokensForCrowdsale variable', async () => {
        const totalTokensForCrowdsaleFigure = await crowdsale.totalTokensForCrowdsale();
        totalTokensForCrowdsaleFigure.should.be.bignumber.equal(
            totalTokensForCrowdsale
        );
    });

    it('starts with token paused', async () => {
        const paused = await token.paused();
        paused.should.be.true;
    });

    describe('changing rate', () => {
        it('does NOT allows anyone to change rate other than the owner', async () => {
            try {
                await crowdsale.setRate(newRate, { from: buyer });
                assert.fail();
            } catch (e) {
                ensuresException(e);
            }

            const rate = await crowdsale.rate();
            rate.should.be.bignumber.equal(rate);
        });

        it('cannot set a rate that is zero', async () => {
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

        it('allows owner to change rate', async () => {
            const { logs } = await crowdsale.setRate(newRate, {
                from: owner
            });

            const event = logs.find(e => e.event === 'TokenRateChanged');
            should.exist(event);

            const rate = await crowdsale.rate();
            rate.should.be.bignumber.equal(newRate);
        });
    });

    describe('whitelist', () => {
        it('only allows owner to add to the whitelist', async () => {
            await increaseTimeTo(latestTime() + duration.days(1));

            try {
                await whitelist.addToWhitelist([buyer, buyer2], {
                    from: buyer
                });
                assert.fail();
            } catch (e) {
                ensuresException(e);
            }

            let isBuyerWhitelisted = await whitelist.isWhitelisted.call(buyer);
            isBuyerWhitelisted.should.be.false;

            await whitelist.addToWhitelist([buyer, buyer2], {
                from: owner
            });

            isBuyerWhitelisted = await whitelist.isWhitelisted.call(buyer);
            isBuyerWhitelisted.should.be.true;
        });

        it('only allows owner to remove from the whitelist', async () => {
            await increaseTimeTo(latestTime() + duration.days(1));
            await whitelist.addToWhitelist([buyer, buyer2], {
                from: owner
            });

            try {
                await whitelist.removeFromWhitelist([buyer], {
                    from: buyer2
                });
                assert.fail();
            } catch (e) {
                ensuresException(e);
            }

            let isBuyerWhitelisted = await whitelist.isWhitelisted.call(buyer2);
            isBuyerWhitelisted.should.be.true;

            await whitelist.removeFromWhitelist([buyer], { from: owner });

            isBuyerWhitelisted = await whitelist.isWhitelisted.call(buyer);
            isBuyerWhitelisted.should.be.false;
        });

        it('shows whitelist addresses', async () => {
            await increaseTimeTo(latestTime() + duration.days(1));
            await whitelist.addToWhitelist([buyer, buyer2], {
                from: owner
            });

            const isBuyerWhitelisted = await whitelist.isWhitelisted.call(
                buyer
            );
            const isBuyer2Whitelisted = await whitelist.isWhitelisted.call(
                buyer2
            );

            isBuyerWhitelisted.should.be.true;
            isBuyer2Whitelisted.should.be.true;
        });

        it('has WhitelistUpdated event', async () => {
            await increaseTimeTo(latestTime() + duration.days(1));
            const { logs } = await whitelist.addToWhitelist([buyer, buyer2], {
                from: owner
            });

            const event = logs.find(e => e.event === 'WhitelistUpdated');
            expect(event).to.exist;
        });
    });

    describe('token purchases', () => {
        beforeEach('initialize contract', async () => {
            await whitelist.addToWhitelist([buyer, buyer2]);
            await token.transferOwnership(crowdsale.address);

            await star.mint(buyer, 10e18);
            await star.mint(user1, 10e18);
        });

        it('cannot buy with empty beneficiary address', async () => {
            await increaseTimeTo(latestTime() + duration.days(52));

            await star.approve(crowdsale.address, 5e18, { from: buyer });

            try {
                await crowdsale.buyTokens('0x00', { from: buyer });
                assert.fail();
            } catch (e) {
                ensuresException(e);
            }

            const buyerBalance = await token.balanceOf(buyer);
            buyerBalance.should.be.bignumber.equal(0);
        });

        it('allows ONLY whitelisted addresses to purchase tokens', async () => {
            await increaseTimeTo(latestTime() + duration.days(52));

            await star.approve(crowdsale.address, 5e18, { from: user1 });
            await star.approve(crowdsale.address, 5e18, { from: buyer });

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

        it('allows ONLY addresses with STAR tokens to purchase tokens', async () => {
            await increaseTimeTo(latestTime() + duration.days(52));

            await star.approve(crowdsale.address, 5e18, { from: buyer });

            try {
                await crowdsale.buyTokens(buyer2, { from: owner });
                assert.fail();
            } catch (e) {
                ensuresException(e);
            }

            const userBalance = await token.balanceOf(buyer2);
            userBalance.should.be.bignumber.equal(0);

            // puchase occurence
            await crowdsale.buyTokens(buyer, { from: owner });

            const buyerBalance = await token.balanceOf(buyer);
            buyerBalance.should.be.bignumber.equal(50e18);
        });

        it('cannot buy tokens by sending transaction to contract', async () => {
            await increaseTimeTo(latestTime() + duration.days(52));

            await star.approve(crowdsale.address, 5e18, { from: user1 });
            await star.approve(crowdsale.address, 5e18, { from: buyer });

            try {
                await crowdsale.sendTransaction({ from: user1 });
                assert.fail();
            } catch (e) {
                ensuresException(e);
            }

            const userBalance = await token.balanceOf(user1);
            userBalance.should.be.bignumber.equal(0);

            // puchase occurence
            await crowdsale.buyTokens(buyer, { from: owner });

            const buyerBalance = await token.balanceOf(buyer);
            buyerBalance.should.be.bignumber.equal(50e18);
        });

        it('does NOT buy tokens when crowdsale is paused', async () => {
            await increaseTimeTo(latestTime() + duration.days(52));

            await star.approve(crowdsale.address, 5e18, { from: user1 });
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

        it('does NOT allow purchase when token ownership does not currently belong to crowdsale contract', async () => {
            crowdsale = await newCrowdsale(rate);
            await whitelist.addToWhitelist([buyer, user1]);

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

        it('updates STAR raised', async () => {
            await increaseTimeTo(latestTime() + duration.days(52));

            await star.approve(crowdsale.address, 8e18, { from: buyer });

            // puchase occurence
            await crowdsale.buyTokens(buyer, { from: owner });

            const buyerBalance = await token.balanceOf(buyer);
            buyerBalance.should.be.bignumber.equal(80e18);

            const starRaised = await crowdsale.starRaised();
            starRaised.should.be.bignumber.equal(8e18);
        });

        it('sends STAR raised to wallet', async () => {
            crowdsale = await newCrowdsale(totalTokensForCrowdsale);
            await whitelist.addToWhitelist([buyer]);
            await token.transferOwnership(crowdsale.address);
            await star.mint(buyer, 10e18);
            await star.approve(crowdsale.address, 1, { from: buyer });

            await increaseTimeTo(latestTime() + duration.days(34));

            await crowdsale.buyTokens(buyer, { from: buyer });

            const buyerBalance = await token.balanceOf(buyer);
            buyerBalance.should.be.bignumber.equal(totalTokensForCrowdsale);

            const walletBalance = await star.balanceOf(wallet);
            walletBalance.should.be.bignumber.equal(1);
        });

        it('only mints tokens up to crowdsale cap; saves the remainder info in contract', async () => {
            crowdsale = await newCrowdsale(totalTokensForCrowdsale);
            await whitelist.addToWhitelist([buyer]);
            await token.transferOwnership(crowdsale.address);
            await star.mint(buyer, 10e18);
            await star.approve(crowdsale.address, 2, { from: buyer });

            await increaseTimeTo(latestTime() + duration.days(34));

            await crowdsale.buyTokens(buyer, { from: buyer });

            const remainderPurchaser = await crowdsale.remainderPurchaser();
            remainderPurchaser.should.equal(buyer);

            const remainder = await crowdsale.remainderStarAmount();
            remainder.toNumber().should.be.equal(1);

            let buyerBalance = await token.balanceOf(buyer);
            buyerBalance.should.be.bignumber.equal(totalTokensForCrowdsale);

            try {
                await crowdsale.buyTokens(buyer, { from: buyer });
                assert.fail();
            } catch (error) {
                ensuresException(error);
            }

            buyerBalance = await token.balanceOf(buyer);
            buyerBalance.should.be.bignumber.equal(totalTokensForCrowdsale);
        });

        it('ends crowdsale when all tokens are sold', async () => {
            crowdsale = await newCrowdsale(totalTokensForCrowdsale);
            await whitelist.addToWhitelist([buyer]);
            await token.transferOwnership(crowdsale.address);
            await star.mint(buyer, 10e18);
            await star.approve(crowdsale.address, 1, { from: buyer });

            await increaseTimeTo(latestTime() + duration.days(34));

            await crowdsale.buyTokens(buyer, { from: buyer });

            const hasEnded = await crowdsale.hasEnded();
            hasEnded.should.be.true;
        });
    });

    describe('crowdsale finalization', function() {
        beforeEach(async () => {
            await whitelist.addToWhitelist([buyer]);
            await token.transferOwnership(crowdsale.address);

            await star.mint(buyer, 10e18);

            await increaseTimeTo(latestTime() + duration.days(52));

            await star.approve(crowdsale.address, 5e18, { from: buyer });
            await crowdsale.buyTokens(buyer, { from: buyer });

            await increaseTimeTo(latestTime() + duration.days(20));

            await crowdsale.finalize(owner);
        });

        it('shows that crowdsale is finalized', async function() {
            const isCrowdsaleFinalized = await crowdsale.isFinalized();
            isCrowdsaleFinalized.should.be.true;
        });

        it('returns token ownership to original owner', async function() {
            const tokenOwner = await token.owner();
            tokenOwner.should.be.equal(owner);
        });

        it('mints remaining crowdsale tokens to wallet', async function() {
            const buyerBalance = await token.balanceOf(buyer);

            const walletTokenBalance = await token.balanceOf(wallet);
            walletTokenBalance.should.be.bignumber.equal(
                totalTokensForCrowdsale.sub(buyerBalance)
            );
        });
    });
});
