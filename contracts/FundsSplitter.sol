pragma solidity 0.4.24;

import "./lib/SafeMath.sol";
import "./lib/ERC20.sol";

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

    // /**
    //  * @dev fallback function that accepts funds
    //  */
    // function() public payable { }

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
        // require(msg.value > 0, "Value must be included");
        uint256 starbaseShare = msg.value.mul(starbasePercentage).div(100);

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