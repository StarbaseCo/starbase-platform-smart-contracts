pragma solidity 0.5.9;

import "./lib/MintableToken.sol";
import "./lib/PausableToken.sol";


/**
 * @title CompanyToken contract - ERC20 compatible token contract with customized token parameters.
 * @author Gustavo Guimaraes - <gustavo@starbase.co>
 */
contract CompanyToken is PausableToken, MintableToken {
    string private _name;
    string private _symbol;
    uint8 private _decimals;

    /**
     * @dev Contract constructor function
     * @param name Token name
     * @param symbol Token symbol - up to 4 characters
     */
    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals
    ) public {
        _name = name;
        _symbol = symbol;
        _decimals = decimals;

        pause();
    }

    /**
     * @return the name of the token.
     */
    function name() public view returns (string memory) {
        return _name;
    }

    /**
     * @return the symbol of the token.
     */
    function symbol() public view returns (string memory) {
        return _symbol;
    }

    /**
     * @return the number of decimals of the token.
     */
    function decimals() public view returns (uint8) {
        return _decimals;
    }
}
