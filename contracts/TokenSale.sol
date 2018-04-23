pragma solidity 0.4.21;

import "zeppelin-solidity/contracts/lifecycle/Pausable.sol";
import "./custom-zeppelin-solidity/FinalizableCrowdsale.sol";
import "./TokenFactory.sol";
import "./Whitelist.sol";


/**
 * @title Token Sale contract - crowdsale of company tokens.
 * @author Gustavo Guimaraes - <gustavo@starbase.co>
 */
contract TokenSale is FinalizableCrowdsale, Pausable {
    uint256 public crowdsaleCap;
    // amount of raised money in STAR
    uint256 public starRaised;
    address public initialTokenOwner;

    // external contracts
    Whitelist public whitelist;
    StandardToken public star;

    event TokenRateChanged(uint256 previousRate, uint256 newRate);

    /**
     * @dev Contract constructor function
     * @param _startTime The timestamp of the beginning of the crowdsale
     * @param _endTime Timestamp when the crowdsale will finish
     * @param _whitelist contract containing the whitelisted addresses
     * @param _starToken STAR token contract address
     * @param _companyToken ERC20 TokenFactory contract address
     * @param _rate The token rate per ETH
     * @param _wallet Multisig wallet that will hold the crowdsale funds.
     * @param _crowdsaleCap Cap for the token sale
     */
    function TokenSale
        (
            uint256 _startTime,
            uint256 _endTime,
            address _whitelist,
            address _starToken,
            address _companyToken,
            uint256 _rate,
            address _wallet,
            uint256 _crowdsaleCap
        )
        public
        FinalizableCrowdsale()
        Crowdsale(_startTime, _endTime, _rate, _wallet)
    {
        require(
                _whitelist != address(0) &&
                _starToken != address(0) &&
                _companyToken != address(0) &&
                _crowdsaleCap != 0
        );

        token = TokenFactory(_companyToken);
        whitelist = Whitelist(_whitelist);
        star = StandardToken(_starToken);

        initialTokenOwner = TokenFactory(token).owner();
        uint256 tokenDecimals = TokenFactory(token).decimals();
        crowdsaleCap = _crowdsaleCap.mul(10 ** tokenDecimals);

        require(TokenFactory(token).paused());
    }

    modifier whitelisted(address beneficiary) {
        require(whitelist.isWhitelisted(beneficiary));
        _;
    }

    modifier crowdsaleIsTokenOwner() {
        // token owner should be contract address
        require(token.owner() == address(this));
        _;
    }

    /**
     * @dev override fallback function. Does not accept payment in ether
     */
    function () external payable {
        revert();
    }

    /**
     * @dev change crowdsale rate
     * @param newRate Figure that corresponds to the new rate per token
     */
    function setRate(uint256 newRate) external onlyOwner {
        require(newRate != 0);

        TokenRateChanged(rate, newRate);
        rate = newRate;
    }

    /**
     * @dev function that allows token purchases with STAR
     * @param beneficiary Address of the purchaser
     */
    function buyTokens(address beneficiary)
        public
        whenNotPaused
        whitelisted(beneficiary)
        crowdsaleIsTokenOwner
    {
        require(beneficiary != address(0));
        require(validPurchase() && token.totalSupply() < crowdsaleCap);

        // beneficiary must allow TokenSale address to transfer star tokens on its behalf
        uint256 starAllocationToTokenSale = star.allowance(beneficiary, this);
        require(starAllocationToTokenSale > 0);

        // calculate token amount to be created
        uint256 tokens = starAllocationToTokenSale.mul(rate);

        //remainder logic
        if (token.totalSupply().add(tokens) > crowdsaleCap) {
            tokens = crowdsaleCap.sub(token.totalSupply());

            starAllocationToTokenSale = tokens.div(rate);
        }

        // update state
        starRaised = starRaised.add(starAllocationToTokenSale);

        token.mint(beneficiary, tokens);
        TokenPurchase(msg.sender, beneficiary, starAllocationToTokenSale, tokens);

        // forward funds
        star.transferFrom(beneficiary, wallet, starAllocationToTokenSale);
    }

    // override Crowdsale#hasEnded to add cap logic
    // @return true if crowdsale event has ended
    function hasEnded() public view returns (bool) {
        if (token.totalSupply() == crowdsaleCap) {
            return true;
        }

        return super.hasEnded();
    }

    /**
     * @dev override Crowdsale#validPurchase
     * @return true if the transaction can buy tokens
     */
    function validPurchase() internal view returns (bool) {
      return now >= startTime && now <= endTime;
    }

    /**
     * @dev finalizes crowdsale
     */
    function finalization() internal {
        if (crowdsaleCap > token.totalSupply()) {
            uint256 remainingTokens = crowdsaleCap.sub(token.totalSupply());

            token.mint(wallet, remainingTokens);
        }

        token.transferOwnership(initialTokenOwner);
        super.finalization();
    }
}
