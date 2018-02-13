pragma solidity 0.4.19;

import "zeppelin-solidity/contracts/token/ERC20/MintableToken.sol";
import "zeppelin-solidity/contracts/token/ERC20/PausableToken.sol";


/**
 * @title TokenMold contract - ERC20 compatible token contract with customized token parameters.
 * @author Gustavo Guimaraes - <gustavo@starbase.co>
 */
contract TokenMold is PausableToken, MintableToken {
    string public name;
    string public symbol;
    uint8 public decimals;

    /**
     * @dev Contract constructor function
     * @param _name Token name
     * @param _symbol Token symbol - up to 4 characters
     * @param _decimals Decimals for token
     */
    function TokenMold(string _name, string _symbol, uint8 _decimals) public {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;

        pause();
    }
}
