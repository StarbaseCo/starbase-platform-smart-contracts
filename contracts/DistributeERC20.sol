pragma solidity 0.4.25;

import "./lib/ERC20.sol";
import "./lib/Ownable.sol";

contract DistributeERC20 is Ownable {
    address public tokenHolder;
    ERC20 public token;

    event DistributeToken(address indexed investor, uint256 amountOfTokens);

    constructor(address _tokenHolder, ERC20 _token) public {
        tokenHolder = _tokenHolder;
        token = ERC20(_token);
    }

    /**
     * @dev distribute tokens to addresses
     * @param investorsAddress List of Purchasers addresses
     * @param amountOfTokens List of token amounts for investor
     */
    function distributeTokens(address[] investorsAddress, uint256[] amountOfTokens)
        external
        onlyOwner
    {
        require(investorsAddress.length == amountOfTokens.length, "arrays as params must be the same length");

        for (uint256 i = 0; i < investorsAddress.length; i++) {
            require(token.transferFrom(tokenHolder, investorsAddress[i], amountOfTokens[i]), "transfer of tokens must succeed");

            emit DistributeToken(investorsAddress[i], amountOfTokens[i]);
        }
    }

    /**
     * @dev allow for selfdestruct possibility and sending funds to owner
     */
    function kill() public onlyOwner {
        uint256 balance = token.balanceOf(this);

        if (balance > 0) {
            token.transfer(_owner, balance);
        }

        selfdestruct(_owner);
    }
}
