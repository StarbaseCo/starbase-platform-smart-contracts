pragma solidity 0.4.19;

import "zeppelin-solidity/contracts/lifecycle/Pausable.sol";
import "./custom-zeppelin-solidity/FinalizableCrowdsale.sol";
import "./TokenMold.sol";
import "./Whitelist.sol";

/**
 * @title Token Sale contract - crowdsale of company tokens.
 * @author Gustavo Guimaraes - <gustavoguimaraes@gmail.com>
 */

contract TokenSale is FinalizableCrowdsale, Pausable {
    uint256 public totalTokensForCrowdsale;

    // external contracts
    Whitelist public whitelist;

    event TokenRateChanged(uint256 previousRate, uint256 newRate);

    /**
     * @dev Contract constructor function
     * @param _startTime The timestamp of the beginning of the crowdsale
     * @param _endTime Timestamp when the crowdsale will finish
     * @param _whitelist contract containing the whitelisted addresses
     * @param _token ERC20 TokenMold contract address
     * @param _rate The token rate per ETH
     * @param _wallet Multisig wallet that will hold the crowdsale funds.
     * @param _totalTokensForCrowdsale Cap for the token sale
     */
    function TokenSale
        (
            uint256 _startTime,
            uint256 _endTime,
            address _whitelist,
            address _token,
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
                _token != address(0) &&
                _totalTokensForCrowdsale != 0
        );

        createTokenContract(_token);
        whitelist = Whitelist(_whitelist);

        totalTokensForCrowdsale = _totalTokensForCrowdsale;
        TokenMold(token).pause();
    }

    modifier whitelisted(address beneficiary) {
        require(whitelist.isWhitelisted(beneficiary));
        _;
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
     * @dev payable function that allow token purchases
     * @param beneficiary Address of the purchaser
     */
    function buyTokens(address beneficiary)
        public
        whenNotPaused
        whitelisted(beneficiary)
        payable
    {
        require(beneficiary != address(0));
        require(validPurchase() && token.totalSupply() < totalTokensForCrowdsale);

        uint256 weiAmount = msg.value;

        // calculate token amount to be created
        uint256 tokens = weiAmount.mul(rate);

        // update state
        weiRaised = weiRaised.add(weiAmount);

        token.mint(beneficiary, tokens);
        TokenPurchase(msg.sender, beneficiary, weiAmount, tokens);

        forwardFunds();
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
