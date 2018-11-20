pragma solidity 0.4.24;

import "./lib/SafeMath.sol";
import "./lib/ERC20.sol";

contract FundsSplitter {
    using SafeMath for uint256;

    address public client;
    address public starbase;
    uint256 public clientPercentage;
    uint256 public starbasePercentage;

    ERC20 public star;

    /**
     * @dev initialization function
     * @param _client Address where client's share goes
     * @param _starbase Address where starbase's share goes
     * @param _clientPercentage Number that denotes client percentage share.It should be btw 1 and 100
     * @param _starbasePercentage Number that denotes client percentage share. It should be btw 1 and 100
     * @param _star Star ERC20 token address
     */
    constructor(
        address _client,
        address _starbase,
        uint256 _clientPercentage,
        uint256 _starbasePercentage,
        ERC20 _star
    )
        public
    {
        client = _client;
        starbase = _starbase;
        clientPercentage = _clientPercentage;
        starbasePercentage = _starbasePercentage;

        star = _star;
    }

    /**
     * @dev fallback functions that diverts funds sent to the contract to both client and starbase
     */
    function() public payable {
        splitFunds(msg.value);
    }

    /**
     * @dev splits star that are allocated to contract
     */
    function splitStarFunds() public {
        uint256 starFunds = star.balanceOf(address(this));

        uint256 starbaseShare = starFunds.mul(starbasePercentage).div(100);
        uint256 clientShare = starFunds.mul(clientPercentage).div(100);

        star.transfer(starbase, starbaseShare);
        star.transfer(client, clientShare);
    }

    /**
     * @dev core fund splitting functionality as part of the funds are sent to client and part to starbase
     * @param value Eth amount to be split
     */
    function splitFunds(uint256 value) internal {
        uint256 starbaseShare = value.mul(starbasePercentage).div(100);
        uint256 clientShare = value.mul(clientPercentage).div(100);

        starbase.transfer(starbaseShare);
        client.transfer(clientShare);
    }
}