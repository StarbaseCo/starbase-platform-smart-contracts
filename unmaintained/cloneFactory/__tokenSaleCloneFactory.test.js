const { latestTime, duration } = require('../../test/helpers/timer')
const TokenSaleCloneFactory = artifacts.require('./TokenSaleCloneFactory.sol')
const TokenSale = artifacts.require('./TokenSale.sol')
const CompanyToken = artifacts.require('./CompanyToken.sol')
const StandardToken = artifacts.require('./StandardToken.sol')
const StarEthRate = artifacts.require('./StarEthRate.sol')

const BigNumber = require('bignumber.js')

contract('TokenSaleCloneFactory', ([owner, wallet, _unused, whitelist]) => {
  let tokenSaleCloneFactory,
    tokenSale,
    starToken,
    companyToken,
    tokenOwnerAfterSale,
    startTime,
    endTime,
    starEthRate

  if (!_unused) {
    // do nothing
  }

  const starEthRateDecimalCorrectionFactor = new BigNumber(1000000)
  const rate = new BigNumber(50)
  const softCap = new BigNumber(200000) // 200 000
  const crowdsaleCap = new BigNumber(20000000) // 20M
  const isWeiAcceptedDefaultValue = true
  const isMinting = true

  beforeEach(async () => {
    startTime = (await latestTime()) + 20 // crowdsale starts in 20 seconds
    endTime = startTime + duration.days(70) // 70 days

    starToken = await StandardToken.new()
    tokenSale = await TokenSale.new()
    starEthRate = await StarEthRate.new(
      starEthRateDecimalCorrectionFactor,
      rate
    )
    tokenSaleCloneFactory = await TokenSaleCloneFactory.new(
      tokenSale.address,
      starToken.address
    )
    companyToken = await CompanyToken.new('Example Token', 'EXT')
    tokenOwnerAfterSale = await companyToken.owner()
  })

  describe('tokenSale clone factory contract deployment', () => {
    it('deploys new tokenSale contract', async () => {
      const tokenSaleTx = await tokenSaleCloneFactory.create.call(
        startTime,
        endTime,
        whitelist,
        companyToken.address,
        tokenOwnerAfterSale,
        rate,
        starEthRate,
        wallet,
        softCap,
        crowdsaleCap,
        isWeiAcceptedDefaultValue,
        isMinting
      )

      expect(tokenSaleTx).to.exist
    })

    it('emits ContractInstantiation', async () => {
      const { logs } = await tokenSaleCloneFactory.create(
        startTime,
        endTime,
        whitelist,
        companyToken.address,
        tokenOwnerAfterSale,
        rate,
        starEthRate,
        wallet,
        softCap,
        crowdsaleCap,
        isWeiAcceptedDefaultValue,
        isMinting,
        { from: owner }
      )

      const event = logs.find(e => e.event === 'ContractInstantiation')
      expect(event).to.exist

      const { args } = logs[0]
      const { msgSender, instantiation } = args
      msgSender.should.be.equal(owner)

      const isInstantiation = await tokenSaleCloneFactory.isInstantiation.call(
        instantiation
      )
      isInstantiation.should.be.true
    })

    it('registers the number of tokenSale contract deployed per address', async () => {
      await tokenSaleCloneFactory.create(
        startTime,
        endTime,
        whitelist,
        companyToken.address,
        tokenOwnerAfterSale,
        rate,
        starEthRate,
        wallet,
        softCap,
        crowdsaleCap,
        isWeiAcceptedDefaultValue,
        isMinting,
        { from: owner }
      )

      let numberOfInstantiations = await tokenSaleCloneFactory.getInstantiationCount(
        owner
      )
      numberOfInstantiations.should.be.bignumber.equal(1)

      await tokenSaleCloneFactory.create(
        startTime,
        endTime,
        whitelist,
        companyToken.address,
        tokenOwnerAfterSale,
        rate,
        starEthRate,
        wallet,
        softCap,
        crowdsaleCap,
        isWeiAcceptedDefaultValue,
        isMinting,
        { from: owner }
      )

      numberOfInstantiations = await tokenSaleCloneFactory.getInstantiationCount(
        owner
      )
      numberOfInstantiations.should.be.bignumber.equal(2)
    })
  })
})
