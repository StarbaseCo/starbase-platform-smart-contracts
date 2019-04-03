pragma solidity 0.4.25;

import "./lib/ERC20Plus.sol";
import "./lib/FinalizableCrowdsale.sol";
import "./lib/Pausable.sol";

import "./FundsSplitterInterface.sol";
import "./StarEthRateInterface.sol";
import "./TokenSaleInterface.sol";
import "./Whitelist.sol";

/**
 * @title Token Sale contract - crowdsale of company tokens.
 * @author Gustavo Guimaraes - <gustavo@starbase.co>
 * @author Markus Waas - <markus@starbase.co>
 */
contract TokenSale is FinalizableCrowdsale, Pausable {
    uint256 public softCap;
    uint256 public crowdsaleCap;
    uint256 public tokensSold;
    // amount of raised money in STAR
    uint256 public starRaised;
    address public tokenOwnerAfterSale;
    bool public isWeiAccepted;
    bool public isMinting;
    bool private isInitialized;

    // external contracts
    Whitelist public whitelist;
    ERC20Plus public starToken;
    FundsSplitterInterface public wallet;
    StarEthRateInterface public starEthRateInterface;

    // The token being sold
    ERC20Plus public tokenOnSale;

    // Keep track of user investments
    mapping (address => uint256) public ethInvestments;
    mapping (address => uint256) public starInvestments;

    event TokenRateChanged(uint256 previousRate, uint256 newRate);
    event TokenStarRateChanged(uint256 previousStarRate, uint256 newStarRate);
    event TokenPurchaseWithStar(address indexed purchaser, address indexed beneficiary, uint256 value, uint256 amount);

    /**
     * @dev initialization function
     * @param _startTime The timestamp of the beginning of the crowdsale
     * @param _endTime Timestamp when the crowdsale will finish
     * @param _whitelist contract containing the whitelisted addresses
     * @param _starToken STAR token contract address
     * @param _companyToken ERC20 contract address that has minting capabilities
     * @param _tokenOwnerAfterSale Address that this TokenSale will pass the token ownership to after it's finished. Only works when TokenSale mints tokens, otherwise must be `0x0`.
     * @param _rate The token rate per ETH
     * @param _starEthRateInterface The StarEthRate contract address .
     * @param _wallet FundsSplitter wallet that redirects funds to client and Starbase.
     * @param _softCap Soft cap of the token sale
     * @param _crowdsaleCap Cap for the token sale
     * @param _isWeiAccepted Bool for acceptance of ether in token sale
     * @param _isMinting Bool that indicates whether token sale mints ERC20 tokens on sale or simply transfers them
     */
    function init(
        uint256 _startTime,
        uint256 _endTime,
        address _whitelist,
        address _starToken,
        address _companyToken,
        address _tokenOwnerAfterSale,
        uint256 _rate,
        address _starEthRateInterface,
        address _wallet,
        uint256 _softCap,
        uint256 _crowdsaleCap,
        bool    _isWeiAccepted,
        bool    _isMinting
    )
        external
    {
        require(!isInitialized, "Contract instance was initialized already!");
        isInitialized = true;

        require(
            _whitelist != address(0) &&
            _starToken != address(0) &&
            _starEthRateInterface != address(0) &&
            _rate > 0 &&
            _companyToken != address(0) &&
            _crowdsaleCap != 0 &&
            _wallet != 0,
            "Parameter variables cannot be empty!"
        );

        require(_softCap < _crowdsaleCap, "SoftCap should be smaller than crowdsaleCap!");

        initCrowdsale(_startTime, _endTime, _rate);
        tokenOnSale = ERC20Plus(_companyToken);
        whitelist = Whitelist(_whitelist);
        starToken = ERC20Plus(_starToken);
        wallet = FundsSplitterInterface(_wallet);
        tokenOwnerAfterSale = _tokenOwnerAfterSale;
        starEthRateInterface = StarEthRateInterface(_starEthRateInterface);
        isWeiAccepted = _isWeiAccepted;
        isMinting = _isMinting;
        _owner = tx.origin;

        softCap = _softCap.mul(10 ** 18);
        crowdsaleCap = _crowdsaleCap.mul(10 ** 18);

        if (isMinting) {
            require(tokenOwnerAfterSale != address(0), "TokenOwnerAftersale cannot be empty when minting tokens!");
            require(ERC20Plus(tokenOnSale).paused(), "Company token must be paused upon initialization!");
        } else {
            require(tokenOwnerAfterSale == address(0), "TokenOwnerAftersale must be empty when minting tokens!");
        }

        require(ERC20Plus(tokenOnSale).decimals() == 18, "Only sales for tokens with 18 decimals are supported!");
    }

    modifier isWhitelisted(address beneficiary) {
        require(whitelist.allowedAddresses(beneficiary), "Beneficiary not whitelisted!");
        _;
    }

    /**
     * @dev override fallback function. cannot use it
     */
    function () external payable {
        revert("No fallback function defined!");
    }

    /**
     * @dev change crowdsale ETH rate
     * @param newRate Figure that corresponds to the new ETH rate per token
     */
    function setRate(uint256 newRate) external onlyOwner {
        require(newRate > 0, "ETH rate must be more than 0!");

        emit TokenRateChanged(rate, newRate);
        rate = newRate;
    }

    /**
     * @dev function that allows token purchases with STAR or ETH
     * @param beneficiary Address of the purchaser
     */
    function buyTokens(address beneficiary)
        public
        payable
        whenNotPaused
        isWhitelisted(beneficiary)
    {
        require(beneficiary != address(0), "Purchaser address cant be zero!");
        require(validPurchase(), "TokenSale over or not yet started!");
        require(tokensSold < crowdsaleCap, "All tokens sold!");
        if (isMinting) {
            require(tokenOnSale.owner() == address(this), "The token owner must be contract address!");
        }

        if (!isWeiAccepted) {
            require(msg.value == 0, "Only purchases with STAR are allowed!");
        } else if (msg.value > 0) {
            buyTokensWithWei(beneficiary);
        }

        uint256 decimalCorrectionFactor =
            starEthRateInterface.decimalCorrectionFactor();
        uint256 starEthRate = starEthRateInterface.starEthRate();
        uint256 starRate = starEthRate
            .mul(rate)
            .div(decimalCorrectionFactor);

        // beneficiary must allow TokenSale address to transfer star tokens on its behalf
        uint256 starAllocationToTokenSale = starToken.allowance(beneficiary, this);
        if (starAllocationToTokenSale > 0) {
            // calculate token amount to be created
            uint256 tokens = starAllocationToTokenSale.mul(starRate);

            // remainder logic
            if (tokensSold.add(tokens) > crowdsaleCap) {
                tokens = crowdsaleCap.sub(tokensSold);

                starAllocationToTokenSale = tokens.div(starRate);
            }

            // update state
            starRaised = starRaised.add(starAllocationToTokenSale);
            starInvestments[msg.sender] = starInvestments[msg.sender].add(starAllocationToTokenSale);

            tokensSold = tokensSold.add(tokens);
            sendPurchasedTokens(beneficiary, tokens);
            emit TokenPurchaseWithStar(msg.sender, beneficiary, starAllocationToTokenSale, tokens);

            forwardsStarFunds(beneficiary, starAllocationToTokenSale);
        }
    }

    /**
     * @dev function that allows token purchases with Wei
     * @param beneficiary Address of the purchaser
     */
    function buyTokensWithWei(address beneficiary)
        internal
    {
        uint256 weiAmount = msg.value;
        uint256 weiRefund;

        // calculate token amount to be created
        uint256 tokens = weiAmount.mul(rate);

        // remainder logic
        if (tokensSold.add(tokens) > crowdsaleCap) {
            tokens = crowdsaleCap.sub(tokensSold);
            weiAmount = tokens.div(rate);

            weiRefund = msg.value.sub(weiAmount);
        }

        // update state
        weiRaised = weiRaised.add(weiAmount);
        ethInvestments[msg.sender] = ethInvestments[msg.sender].add(weiAmount);

        tokensSold = tokensSold.add(tokens);
        sendPurchasedTokens(beneficiary, tokens);
        emit TokenPurchase(msg.sender, beneficiary, weiAmount, tokens);

        forwardsWeiFunds(weiRefund);
    }

    // isMinting checker -- it either mints ERC20 token or transfers them
    function sendPurchasedTokens(address _beneficiary, uint256 _tokens) internal {
        isMinting ? tokenOnSale.mint(_beneficiary, _tokens) : tokenOnSale.transfer(_beneficiary, _tokens);
    }

    // check for softCap achievement
    // @return true when softCap is reached
    function hasReachedSoftCap() public view returns (bool) {
        if (tokensSold >= softCap) return true;

        return false;
    }

    // override Crowdsale#hasEnded to add cap logic
    // @return true if crowdsale event has ended
    function hasEnded() public view returns (bool) {
        if (tokensSold >= crowdsaleCap) return true;

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
     * @dev forward wei funds
     */
    function forwardsWeiFunds(uint256 _weiRefund) internal {
        if (softCap == 0 || hasReachedSoftCap()) {
            if (_weiRefund > 0) msg.sender.transfer(_weiRefund);

            // when there is still balance left send to wallet contract
            if (address(this).balance > 0) {
                address(wallet).transfer(address(this).balance);
                wallet.splitFunds();
            }
        }
    }

    /**
     * @dev forward star funds
     */
    function forwardsStarFunds(address _beneficiary, uint256 _value) internal {
        if (softCap > 0 && !hasReachedSoftCap()) {
            starToken.transferFrom(_beneficiary, address(this), _value);
        } else {
            // forward funds
            starToken.transferFrom(_beneficiary, wallet, _value);
            // transfer STAR from previous purchases to wallet once soft cap is reached
            uint256 starBalance = starToken.balanceOf(address(this));
            if (starBalance > 0) starToken.transfer(wallet, starBalance);

            wallet.splitStarFunds();
        }
    }

    /**
     * @dev withdraw funds for failed sales
     */
    function withdrawUserFunds() public {
        require(hasEnded(), "Can only withdraw funds for ended sales!");
        require(
            !hasReachedSoftCap(),
            "Can only withdraw funds for sales that didn't reach soft cap!"
        );

        uint256 investedEthRefund = ethInvestments[msg.sender];
        uint256 investedStarRefund = starInvestments[msg.sender];

        require(
            investedEthRefund > 0 || investedStarRefund > 0,
            "You don't have any funds in the contract!"
        );

        // prevent reentrancy attack
        ethInvestments[msg.sender] = 0;
        starInvestments[msg.sender] = 0;

        if (investedEthRefund > 0) msg.sender.transfer(investedEthRefund);
        if (investedStarRefund > 0) starToken.transfer(msg.sender, investedStarRefund);
    }

    /**
     * @dev finalizes crowdsale
     */
    function finalization() internal {
        uint256 remainingTokens = isMinting ? crowdsaleCap.sub(tokensSold) : tokenOnSale.balanceOf(address(this));

        if (remainingTokens > 0) sendPurchasedTokens(wallet, remainingTokens);
        if (isMinting) tokenOnSale.transferOwnership(tokenOwnerAfterSale);

        super.finalization();
    }
}
