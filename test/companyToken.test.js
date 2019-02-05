const CompanyToken = artifacts.require('./CompanyToken.sol')

contract('CompanyToken', () => {
  let token

  beforeEach(async () => {
    token = await CompanyToken.new('Example Token', 'ETK')
  })

  it('has a name', async () => {
    const name = await token.name()
    name.should.be.equal('Example Token')
  })

  it('possesses a symbol', async () => {
    const symbol = await token.symbol()
    symbol.should.be.equal('ETK')
  })

  it('contains 18 decimals', async () => {
    const decimals = await token.decimals()
    decimals.should.be.bignumber.equal(18)
  })

  it('starts with token paused', async () => {
    const paused = await token.paused()
    paused.should.be.true
  })
})
