pragma solidity 0.4.19;

import "zeppelin-solidity/contracts/lifecycle/Pausable.sol";
import "zeppelin-solidity/contracts/token/ERC20/StandardToken.sol";
import "./custom-zeppelin-solidity/FinalizableCrowdsale.sol";
import "./TokenMold.sol";
import "./Whitelist.sol";

/**
 * @title Token Sale contract - crowdsale of company tokens.
 * @author Gustavo Guimaraes - <gustavoguimaraes@gmail.com>
 */

contract TokenSale is FinalizableCrowdsale, Pausable {
    uint256 public totalTokensForCrowdsale;
    // amount of raised money in STAR
    uint256 public starRaised;

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
     * @param _companyToken ERC20 TokenMold contract address
     * @param _rate The token rate per ETH
     * @param _wallet Multisig wallet that will hold the crowdsale funds.
     * @param _totalTokensForCrowdsale Cap for the token sale
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
            uint256 _totalTokensForCrowdsale
        )
        public
        FinalizableCrowdsale()
        Crowdsale(_startTime, _endTime, _rate, _wallet)
    {
        require(
                _whitelist != address(0) &&
                _starToken != address(0) &&
                _companyToken != address(0) &&
                _totalTokensForCrowdsale != 0
        );

        createTokenContract(_companyToken);
        whitelist = Whitelist(_whitelist);
        star = StandardToken(_starToken);

        totalTokensForCrowdsale = _totalTokensForCrowdsale;
        TokenMold(token).pause();
    }

    modifier whitelisted(address beneficiary) {
        require(whitelist.isWhitelisted(beneficiary));
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
     * @dev function that allow token purchases with STAR
     * @param beneficiary Address of the purchaser
     */
    function buyTokens(address beneficiary)
        public
        whenNotPaused
        whitelisted(beneficiary)
    {
        require(beneficiary != address(0));
        require(validPurchase() && token.totalSupply() < totalTokensForCrowdsale);

        // beneficiary must allow TokenSale address to transfer star tokens on its behalf
        uint256 starAllocationToTokenSale = star.allowance(beneficiary, this);
        require(starAllocationToTokenSale > 0);

        // calculate token amount to be created
        uint256 tokens = starAllocationToTokenSale.mul(rate);

        // update state
        starRaised = starRaised.add(starAllocationToTokenSale);

        token.mint(beneficiary, tokens);
        TokenPurchase(msg.sender, beneficiary, starAllocationToTokenSale, tokens);

        // forward funds
        star.transferFrom(beneficiary, wallet, starAllocationToTokenSale);
    }

    // overriding Crowdsale#hasEnded to add cap logic
    // @return true if crowdsale event has ended
    function hasEnded() public view returns (bool) {
        if (token.totalSupply() == totalTokensForCrowdsale) {
            return true;
        }

        return super.hasEnded();
    }

    /**
     * @dev Creates token contract. This is called on the constructor function of the Crowdsale contract
     * @param _token Address of token contract
     */
    function createTokenContract(address _token) internal returns (MintableToken) {
        token = TokenMold(_token);
        return token;
    }

    /**
     * @dev finalizes crowdsale
     */
    function finalization() internal {
        if (totalTokensForCrowdsale > token.totalSupply()) {
            uint256 remainingTokens = totalTokensForCrowdsale.sub(token.totalSupply());

            token.mint(wallet, remainingTokens);
        }

        super.finalization();
    }
}
