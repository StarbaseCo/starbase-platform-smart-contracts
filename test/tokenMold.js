const { should } = require('./helpers/utils');
const TokenMold = artifacts.require('./TokenMold.sol');

contract('TokenMold', () => {
    let token;

    beforeEach(async () => {
        token = await TokenMold.deployed();
    });

    it('has a name', async () => {
        const name = await token.name();
        name.should.be.equal('Example Token');
    });

    it('possesses a symbol', async () => {
        const symbol = await token.symbol();
        symbol.should.be.equal('ETK');
    });

    it('contains 18 decimals', async () => {
        const decimals = await token.decimals();
        decimals.should.be.bignumber.equal(18);
    });

    it('starts with token paused', async () => {
        const paused = await token.paused();
        paused.should.be.true;
    });
});
