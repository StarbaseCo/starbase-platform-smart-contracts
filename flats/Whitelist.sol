pragma solidity 0.4.25;

// File: contracts/lib/Ownable.sol

/**
 * @title Ownable
 * @dev The Ownable contract has an owner address, and provides basic authorization control
 * functions, this simplifies the implementation of "user permissions".
 */
contract Ownable {
    address public _owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev The Ownable constructor sets the original `owner` of the contract to the sender
     * account.
     */
    constructor () internal {
        _owner = msg.sender;
        emit OwnershipTransferred(address(0), _owner);
    }

    /**
     * @return the address of the owner.
     */
    function owner() public view returns (address) {
        return _owner;
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        require(isOwner(), "only owner is able call this function");
        _;
    }

    /**
     * @return true if `msg.sender` is the owner of the contract.
     */
    function isOwner() public view returns (bool) {
        return msg.sender == _owner;
    }

    /**
     * @dev Allows the current owner to relinquish control of the contract.
     * @notice Renouncing to ownership will leave the contract without an owner.
     * It will not be possible to call the functions with the `onlyOwner`
     * modifier anymore.
     */
    function renounceOwnership() public onlyOwner {
        emit OwnershipTransferred(_owner, address(0));
        _owner = address(0);
    }

    /**
     * @dev Allows the current owner to transfer control of the contract to a newOwner.
     * @param newOwner The address to transfer ownership to.
     */
    function transferOwnership(address newOwner) public onlyOwner {
        _transferOwnership(newOwner);
    }

    /**
     * @dev Transfers control of the contract to a newOwner.
     * @param newOwner The address to transfer ownership to.
     */
    function _transferOwnership(address newOwner) internal {
        require(newOwner != address(0));
        emit OwnershipTransferred(_owner, newOwner);
        _owner = newOwner;
    }
}

// File: contracts/Whitelist.sol

/**
 * @title Whitelist - crowdsale whitelist contract
 * @author Gustavo Guimaraes - <gustavo@starbase.co>
 */
contract Whitelist is Ownable {
    mapping(address => bool) public allowedAddresses;

    event WhitelistUpdated(uint256 timestamp, string operation, address indexed member);

    /**
    * @dev Adds single address to whitelist.
    * @param _address Address to be added to the whitelist
    */
    function addToWhitelist(address _address) external onlyOwner {
        allowedAddresses[_address] = true;
        emit WhitelistUpdated(now, "Added", _address);
    }

    /**
     * @dev add various whitelist addresses
     * @param _addresses Array of ethereum addresses
     */
    function addManyToWhitelist(address[] _addresses) external onlyOwner {
        for (uint256 i = 0; i < _addresses.length; i++) {
            allowedAddresses[_addresses[i]] = true;
            emit WhitelistUpdated(now, "Added", _addresses[i]);
        }
    }

    /**
     * @dev remove whitelist addresses
     * @param _addresses Array of ethereum addresses
     */
    function removeManyFromWhitelist(address[] _addresses) public onlyOwner {
        for (uint256 i = 0; i < _addresses.length; i++) {
            allowedAddresses[_addresses[i]] = false;
            emit WhitelistUpdated(now, "Removed", _addresses[i]);
        }
    }
}
