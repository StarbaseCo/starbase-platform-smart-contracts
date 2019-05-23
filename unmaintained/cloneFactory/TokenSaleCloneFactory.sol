pragma solidity 0.5.8;

import "../TokenSaleInterface.sol";
import "./CloneFactory.sol";

contract TokenSaleCloneFactory is CloneFactory {
    // TokenSale contract address for cloning purposes
    address public libraryAddress;
    address public starToken;

    mapping(address => bool) public isInstantiation;
    mapping(address => address[]) public instantiations;

    event ContractInstantiation(address msgSender, address instantiation);

    //
    /**
    * @dev set TokenSale contract clone as well as starToken upon deployment
    * @param _libraryAddress TokenSale contract address for cloning purposes
    * @param _starToken Star contract address in the _libraryAddress deployment
    */
    constructor(address _libraryAddress, address _starToken) public {
        require(
            _libraryAddress != address(0) && _starToken != address(0),
            "_libraryAddress and _starToken should not be empty!"
        );
        libraryAddress = _libraryAddress;
        starToken = _starToken;
    }

    /**
     * @dev Returns number of instantiations by creator.
     * @param creator Contract creator.
     * @return Returns number of instantiations by creator.
     */
    function getInstantiationCount(address creator)
        public
        view
        returns (uint256)
    {
        return instantiations[creator].length;
    }

    /**
     * @dev Allows verified creation of pools.
     * @param _startTime The timestamp of the beginning of the crowdsale
     * @param _endTime Timestamp when the crowdsale will finish
     * @param _externalAddresses contract containing the whitelisted addresses
     * #param _whitelist contract containing the whitelisted addresses
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
    function create
    (
        uint256 _startTime,
        uint256 _endTime,
        address[5] memory _externalAddresses, // array avoids stack too deep error
        uint256 _softCap,
        uint256 _crowdsaleCap,
        bool    _isWeiAccepted,
        bool    _isMinting,
        uint256[] memory _targetRates,
        uint256[] memory _targetRatesTimestamps
    )
        public
    {
        address tokenSale = createClone(libraryAddress);
        TokenSaleInterface(tokenSale).init(
            _startTime,
            _endTime,
            [
                _externalAddresses[0],
                starToken,
                _externalAddresses[1],
                _externalAddresses[2],
                _externalAddresses[3],
                _externalAddresses[4]
            ],
            _softCap,
            _crowdsaleCap,
            _isWeiAccepted,
            _isMinting,
            _targetRates,
            _targetRatesTimestamps
        );

        register(tokenSale);
    }

    /**
     * @dev Registers contract in factory registry.
     * @param instantiation Address of contract instantiation.
     */
    function register(address instantiation)
        internal
    {
        isInstantiation[instantiation] = true;
        instantiations[msg.sender].push(instantiation);

        emit ContractInstantiation(msg.sender, instantiation);
    }
}
