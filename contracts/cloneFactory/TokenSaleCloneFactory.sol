pragma solidity 0.4.24;

import "../TokenSaleInterface.sol";
import "./CloneFactory.sol";
import "../lib/Ownable.sol";

contract TokenSaleCloneFactory is Ownable, CloneFactory {
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
    * @dev Have the option of updating the TokenSale contract for cloning.
    * @param _libraryAddress Address for new contract
    */
    function setLibraryAddress(address _libraryAddress) external onlyOwner {
        require(_libraryAddress != address(0), "_libraryAddress should not be empty!");
        libraryAddress = _libraryAddress;
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
     * @param _whitelist contract containing the whitelisted addresses
     * @param _companyToken ERC20 CompanyToken contract address
     * @param _rate The token rate per ETH
     * @param _starRate The token rate per STAR
     * @param _wallet Multisig wallet that will hold the crowdsale funds.
     * @param _crowdsaleCap Cap for the token sale
     * @param _isWeiAccepted Bool for acceptance of ether in token sale
     */
    function create
    (
        uint256 _startTime,
        uint256 _endTime,
        address _whitelist,
        address _companyToken,
        uint256 _rate,
        uint256 _starRate,
        address _wallet,
        uint256 _crowdsaleCap,
        bool    _isWeiAccepted
    )
        public
    {
        address tokenSale = createClone(libraryAddress);
        TokenSaleInterface(tokenSale).init(
            _startTime,
            _endTime,
            _whitelist,
            starToken,
            _companyToken,
            _rate,
            _starRate,
            _wallet,
            _crowdsaleCap,
            _isWeiAccepted
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
