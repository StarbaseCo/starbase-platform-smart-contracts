pragma solidity 0.4.25;

import "./lib/Pausable.sol";
import "./lib/FinalizableCrowdsale.sol";
import "./lib/ERC20Plus.sol";
import "./Whitelist.sol";
import "./TokenSaleInterface.sol";
import "./FundsSplitterInterface.sol";

/**
 * @title Token Sale contract - crowdsale of company tokens.
 * @author Gustavo Guimaraes - <gustavo@starbase.co>
 */
contract TokenSale is FinalizableCrowdsale, Pausable {
    uint256 public softCap;
    uint256 public crowdsaleCap;
    uint256 public tokensSold;
    // amount of raised money in STAR
    uint256 public starRaised;
    uint256 public starRatePer1000;
    address public tokenOwnerAfterSale;
    bool public isWeiAccepted;
    bool public isMinting;
    bool private isInitialized;

    // external contracts
    Whitelist public whitelist;
    ERC20Plus public starToken;
    FundsSplitterInterface public wallet;

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
     * @param _starRatePer1000 The token rate per 1/1000 STAR
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
        uint256 _starRatePer1000,
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
            _starRatePer1000 != 0 &&
            (_isWeiAccepted && _rate != 0 || !_isWeiAccepted) &&
            _companyToken != address(0) &&
            _crowdsaleCap != 0 &&
            _wallet != 0,
            "Parameter variables cannot be empty!"
        );

        require(_softCap < _crowdsaleCap, "SoftCap should be smaller than crowdsaleCap!");

        if (_isWeiAccepted) {
            require(_rate > 0, "Set a rate for Wei, when it is accepted for purchases!");
        } else {
            require(_rate == 0, "Only set a rate for Wei, when it is accepted for purchases!");
        }

        initCrowdsale(_startTime, _endTime, _rate);
        tokenOnSale = ERC20Plus(_companyToken);
        whitelist = Whitelist(_whitelist);
        starToken = ERC20Plus(_starToken);
        wallet = FundsSplitterInterface(_wallet);
        tokenOwnerAfterSale = _tokenOwnerAfterSale;
        starRatePer1000 = _starRatePer1000;
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
        require(isWeiAccepted, "Sale must allow Wei for purchases to set a rate for Wei!");
        require(newRate != 0, "ETH rate must be more than 0!");

        emit TokenRateChanged(rate, newRate);
        rate = newRate;
    }

    /**
     * @dev change crowdsale STAR rate
     * @param newStarRate Figure that corresponds to the new STAR rate per token
     */
    function setStarRate(uint256 newStarRate) external onlyOwner {
        require(newStarRate != 0, "Star rate must be more than 0!");

        emit TokenStarRateChanged(starRatePer1000, newStarRate);
        starRatePer1000 = newStarRate;
    }

    /**
     * @dev allows sale to receive wei or not
     */
    function setIsWeiAccepted(bool _isWeiAccepted, uint256 _rate) external onlyOwner {
        if (_isWeiAccepted) {
            require(_rate > 0, "When accepting Wei, you need to set a conversion rate!");
        } else {
            require(_rate == 0, "When not accepting Wei, you need to set a conversion rate of 0!");
        }

        isWeiAccepted = _isWeiAccepted;
        rate = _rate;
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
        require(validPurchase(), "TokenSale over!");
        require(tokensSold < crowdsaleCap, "All tokens sold!");
        if (isMinting) {
            require(tokenOnSale.owner() == address(this), "The token owner must be contract address!");
        }

        if (!isWeiAccepted) {
            require(msg.value == 0, "Only purchases with STAR are allowed!");
        } else if (msg.value > 0) {
            buyTokensWithWei(beneficiary);
        }

        // beneficiary must allow TokenSale address to transfer star tokens on its behalf
        uint256 starAllocationToTokenSale = starToken.allowance(beneficiary, this);
        if (starAllocationToTokenSale > 0) {
            // calculate token amount to be created
            uint256 tokens = starAllocationToTokenSale.mul(starRatePer1000).div(1000);

            // remainder logic
            if (tokensSold.add(tokens) > crowdsaleCap) {
                tokens = crowdsaleCap.sub(tokensSold);

                starAllocationToTokenSale = tokens.div(starRatePer1000).div(1000);
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
