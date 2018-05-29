pragma solidity 0.4.23;

import 'zeppelin-solidity/contracts/ownership/Ownable.sol';


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
        WhitelistUpdated(now, "Added", _address);
    }

    /**
     * @dev add various whitelist addresses
     * @param _addresses Array of ethereum addresses
     */
    function addManyToWhitelist(address[] _addresses) external onlyOwner {
        for (uint256 i = 0; i < _addresses.length; i++) {
            allowedAddresses[_addresses[i]] = true;
            WhitelistUpdated(now, "Added", _addresses[i]);
        }
    }

    /**
     * @dev remove whitelist addresses
     * @param _addresses Array of ethereum addresses
     */
    function removeFromWhitelist(address[] _addresses) public onlyOwner {
        for (uint256 i = 0; i < _addresses.length; i++) {
            allowedAddresses[_addresses[i]] = false;
            WhitelistUpdated(now, "Removed", _addresses[i]);
        }
    }
}
