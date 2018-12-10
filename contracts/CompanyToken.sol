pragma solidity 0.4.24;

import "./lib/MintableToken.sol";
import "./lib/PausableToken.sol";


/**
 * @title CompanyToken contract - ERC20 compatible token contract with customized token parameters.
 * @author Gustavo Guimaraes - <gustavo@starbase.co>
 */
contract CompanyToken is PausableToken, MintableToken {
    string private _name;
    string private _symbol;
    uint8 constant private _decimals = 18;

    /**
     * @dev Contract constructor function
     * @param name Token name
     * @param symbol Token symbol - up to 4 characters
     */
    constructor(string name, string symbol) public {
        _name = name;
        _symbol = symbol;

        pause();
    }

    /**
     * @return the name of the token.
     */
    function name() public view returns (string) {
        return _name;
    }

    /**
     * @return the symbol of the token.
     */
    function symbol() public view returns (string) {
        return _symbol;
    }

    /**
     * @return the number of decimals of the token.
     */
    function decimals() public pure returns (uint8) {
        return _decimals;
    }
}
