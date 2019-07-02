pragma solidity 0.5.9;

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

    // rate definitions
    uint256 public currentTargetRateIndex;
    uint256[] public targetRates;
    uint256[] public targetRatesTimestamps;

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
     * @param _externalAddresses Containing all external addresses, see below
     * #param _whitelist contract containing the whitelisted addresses
     * #param _starToken STAR token contract address
     * #param _companyToken ERC20 contract address that has minting capabilities
     * #param _tokenOwnerAfterSale Address that this TokenSale will pass the token ownership to after it's finished. Only works when TokenSale mints tokens, otherwise must be `0x0`.
     * #param _starEthRateInterface The StarEthRate contract address .
     * #param _wallet FundsSplitter wallet that redirects funds to client and Starbase.
     * @param _softCap Soft cap of the token sale
     * @param _crowdsaleCap Cap for the token sale
     * @param _isWeiAccepted Bool for acceptance of ether in token sale
     * @param _isMinting Bool that indicates whether token sale mints ERC20 tokens on sale or simply transfers them
     * @param _targetRates Array of target rates.
     * @param _targetRatesTimestamps Array of target rates timestamps.
     */
    function init(
        uint256 _startTime,
        uint256 _endTime,
        address[6] calldata _externalAddresses, // array avoids stack too deep error
        uint256 _softCap,
        uint256 _crowdsaleCap,
        bool    _isWeiAccepted,
        bool    _isMinting,
        uint256[] calldata _targetRates,
        uint256[] calldata _targetRatesTimestamps
    )
        external
    {
        require(!isInitialized, "Contract instance was initialized already!");
        isInitialized = true;

        require(
            _externalAddresses[0] != address(0) &&
            _externalAddresses[1] != address(0) &&
            _externalAddresses[2] != address(0) &&
            _externalAddresses[4] != address(0) &&
            _externalAddresses[5] != address(0) &&
            _crowdsaleCap != 0,
            "Parameter variables cannot be empty!"
        );

        require(
            _softCap < _crowdsaleCap,
            "SoftCap should be smaller than crowdsaleCap!"
        );

        currentTargetRateIndex = 0;
        initCrowdsale(_startTime, _endTime);
        tokenOnSale = ERC20Plus(_externalAddresses[2]);
        whitelist = Whitelist(_externalAddresses[0]);
        starToken = ERC20Plus(_externalAddresses[1]);
        wallet = FundsSplitterInterface(uint160(_externalAddresses[5]));
        tokenOwnerAfterSale = _externalAddresses[3];
        starEthRateInterface = StarEthRateInterface(_externalAddresses[4]);
        isWeiAccepted = _isWeiAccepted;
        isMinting = _isMinting;
        _owner = tx.origin;

        uint8 decimals = tokenOnSale.decimals();
        softCap = _softCap.mul(10 ** uint256(decimals));
        crowdsaleCap = _crowdsaleCap.mul(10 ** uint256(decimals));

        targetRates = _targetRates;
        targetRatesTimestamps = _targetRatesTimestamps;

        if (isMinting) {
            require(tokenOwnerAfterSale != address(0), "tokenOwnerAfterSale cannot be empty when minting tokens!");
            require(tokenOnSale.paused(), "Company token must be paused upon initialization!");
        } else {
            require(tokenOwnerAfterSale == address(0), "tokenOwnerAfterSale must be empty when minting tokens!");
        }

        verifyTargetRates();
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

        checkForNewRateAndUpdate();

        if (!isWeiAccepted) {
            require(msg.value == 0, "Only purchases with STAR are allowed!");
        } else if (msg.value > 0) {
            buyTokensWithWei(beneficiary);
        }

        // beneficiary must allow TokenSale address to transfer star tokens on its behalf
        uint256 starAllocationToTokenSale = starToken.allowance(beneficiary, address(this));

        if (starAllocationToTokenSale > 0) {
            uint256 decimalCorrectionFactor =
                starEthRateInterface.decimalCorrectionFactor();
            uint256 starEthRate = starEthRateInterface.starEthRate();
            uint256 ethRate = targetRates[currentTargetRateIndex];

            // calculate token amount to be created
            uint256 tokens = (starAllocationToTokenSale
                .mul(ethRate)
                .mul(starEthRate))
                .div(decimalCorrectionFactor);

            // remainder logic
            if (tokensSold.add(tokens) > crowdsaleCap) {
                tokens = crowdsaleCap.sub(tokensSold);

                starAllocationToTokenSale = (starEthRate
                    .mul(tokens))
                    .div(ethRate.mul(decimalCorrectionFactor));
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

        uint256 ethRate = targetRates[currentTargetRateIndex];

        // calculate token amount to be created
        uint256 tokens = weiAmount.mul(ethRate);

        // remainder logic
        if (tokensSold.add(tokens) > crowdsaleCap) {
            tokens = crowdsaleCap.sub(tokensSold);
            weiAmount = tokens.div(ethRate);

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
            starToken.transferFrom(_beneficiary, address(wallet), _value);
            // transfer STAR from previous purchases to wallet once soft cap is reached
            uint256 starBalance = starToken.balanceOf(address(this));
            if (starBalance > 0) starToken.transfer(address(wallet), starBalance);

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

    function verifyTargetRates() internal view {
        require(
            targetRates.length == targetRatesTimestamps.length,
            'Target rates and target rates timestamps lengths should match!'
        );

        require(targetRates.length > 0, 'Target rates cannot be empty!');
        require(
            targetRatesTimestamps[0] == startTime,
            'First target rate timestamp should match startTime!'
        );

        for (uint256 i = 0; i < targetRates.length; i++) {
            if (i > 0) {
                require(
                    targetRatesTimestamps[i-1] < targetRatesTimestamps[i],
                    'Target rates timestamps should be sorted from low to high!'
                );
            }

            if (i == targetRates.length - 1) {
               require(
                    targetRatesTimestamps[i] < endTime,
                    'All target rate timestamps should be before endTime!'
                );
            }

            require(targetRates[i] > 0, 'All target rates must be above 0!');
        }
    }

    /**
     * @dev Returns current rate and index for rate in targetRates array.
     * Does not update target rate index, use checkForNewRateAndUpdate() to
     * update,
     */
    function getCurrentRate() public view returns (uint256, uint256) {
        for (
            uint256 i = currentTargetRateIndex + 1;
            i < targetRatesTimestamps.length;
            i++
        ) {
            if (now < targetRatesTimestamps[i]) {
                return (targetRates[i - 1], i - 1);
            }
        }

        return (
            targetRates[targetRatesTimestamps.length - 1],
            targetRatesTimestamps.length - 1
        );
    }

    /**
     * @dev Check for new valid rate and update. Automatically called when
     * purchasing tokens.
     */
    function checkForNewRateAndUpdate() public {
        (, uint256 targetRateIndex) = getCurrentRate(); // ignore first value

        if (targetRateIndex > currentTargetRateIndex) {
            currentTargetRateIndex = targetRateIndex;
        }
    }

    /**
     * @dev finalizes crowdsale
     */
    function finalization() internal {
        uint256 remainingTokens = isMinting ? crowdsaleCap.sub(tokensSold) : tokenOnSale.balanceOf(address(this));

        if (remainingTokens > 0) sendPurchasedTokens(address(wallet), remainingTokens);
        if (isMinting) tokenOnSale.transferOwnership(tokenOwnerAfterSale);

        super.finalization();
    }

    /**
     * @dev Get whitelist address.
     * @return The whitelist address.
     */
    function getWhitelistAddress() external view returns (address) {
        return address(whitelist);
    }

    /**
     * @dev Get starToken address.
     * @return The starToken address.
     */
    function getStarTokenAddress() external view returns (address) {
        return address(starToken);
    }

    /**
     * @dev Get wallet address.
     * @return The wallet address.
     */
    function getWalletAddress() external view returns (address) {
        return address(wallet);
    }

    /**
     * @dev Get starEthRateInterface address.
     * @return The starEthRateInterface address.
     */
    function getStarEthRateInterfaceAddress() external view returns (address) {
        return address(starEthRateInterface);
    }

    /**
     * @dev Get tokenOnSale address.
     * @return The tokenOnSale address.
     */
    function getTokenOnSaleAddress() external view returns (address) {
        return address(tokenOnSale);
    }
}
