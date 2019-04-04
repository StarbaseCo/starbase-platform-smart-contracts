pragma solidity 0.4.25;

// File: contracts/lib/SafeMath.sol

/**
 * @title SafeMath
 * @dev Unsigned math operations with safety checks that revert on error.
 */
library SafeMath {
    /**
     * @dev Multiplies two unsigned integers, reverts on overflow.
     */
    function mul(uint256 a, uint256 b) internal pure returns (uint256) {
        // Gas optimization: this is cheaper than requiring 'a' not being zero, but the
        // benefit is lost if 'b' is also tested.
        // See: https://github.com/OpenZeppelin/openzeppelin-solidity/pull/522
        if (a == 0) {
            return 0;
        }

        uint256 c = a * b;
        require(c / a == b, 'SafeMul overflow!');

        return c;
    }

    /**
     * @dev Integer division of two unsigned integers truncating the quotient, reverts on division by zero.
     */
    function div(uint256 a, uint256 b) internal pure returns (uint256) {
        // Solidity only automatically asserts when dividing by 0
        require(b > 0, 'SafeDiv cannot divide by 0!');
        uint256 c = a / b;
        // assert(a == b * c + a % b); // There is no case in which this doesn't hold

        return c;
    }

    /**
     * @dev Subtracts two unsigned integers, reverts on overflow (i.e. if subtrahend is greater than minuend).
     */
    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b <= a, 'SafeSub underflow!');
        uint256 c = a - b;

        return c;
    }

    /**
     * @dev Adds two unsigned integers, reverts on overflow.
     */
    function add(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a + b;
        require(c >= a, 'SafeAdd overflow!');

        return c;
    }

    /**
     * @dev Divides two unsigned integers and returns the remainder (unsigned integer modulo),
     * reverts when dividing by zero.
     */
    function mod(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b != 0, 'SafeMod cannot compute modulo of 0!');
        return a % b;
    }
}

// File: contracts/lib/ERC20.sol

/**
 * @title ERC20 interface
 * @dev see https://github.com/ethereum/EIPs/issues/20
 */
contract ERC20 {
    function allowance(address owner, address spender) public view returns (uint256);
    function transferFrom(address from, address to, uint256 value) public returns (bool);
    function approve(address spender, uint256 value) public returns (bool);
    function totalSupply() public view returns (uint256);
    function balanceOf(address who) public view returns (uint256);
    function transfer(address to, uint256 value) public returns (bool);

    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Transfer(address indexed from, address indexed to, uint256 value);
}

// File: contracts\FundsSplitter.sol

contract FundsSplitter {
    using SafeMath for uint256;

    address public client;
    address public starbase;
    uint256 public starbasePercentage;

    ERC20 public star;
    ERC20 public tokenOnSale;

    /**
     * @dev initialization function
     * @param _client Address where client's share goes
     * @param _starbase Address where starbase's share goes
     * @param _starbasePercentage Number that denotes client percentage share (between 1 and 100)
     * @param _star Star ERC20 token address
     * @param _tokenOnSale Token on sale's ERC20 token address
     */
    constructor(
        address _client,
        address _starbase,
        uint256 _starbasePercentage,
        ERC20 _star,
        ERC20 _tokenOnSale
    )
        public
    {
        client = _client;
        starbase = _starbase;
        starbasePercentage = _starbasePercentage;
        star = _star;
        tokenOnSale = _tokenOnSale;
    }

    /**
     * @dev fallback function that accepts funds
     */
    function() public payable { }

    /**
     * @dev splits star that are allocated to contract
     */
    function splitStarFunds() public {
        uint256 starFunds = star.balanceOf(address(this));
        uint256 starbaseShare = starFunds.mul(starbasePercentage).div(100);

        star.transfer(starbase, starbaseShare);
        star.transfer(client, star.balanceOf(address(this))); // send remaining stars to client
    }

    /**
     * @dev core fund splitting functionality as part of the funds are sent to client and part to starbase
     */
    function splitFunds() public payable {
        uint256 starbaseShare = address(this).balance.mul(starbasePercentage).div(100);

        starbase.transfer(starbaseShare);
        client.transfer(address(this).balance); // remaining ether to client
    }

    /**
     * @dev withdraw any remaining tokens on sale
     */
    function withdrawRemainingTokens() public {
        tokenOnSale.transfer(client, tokenOnSale.balanceOf(address(this)));
    }
}
