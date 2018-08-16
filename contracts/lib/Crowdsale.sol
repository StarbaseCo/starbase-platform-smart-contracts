pragma solidity 0.4.24;

import "./SafeMath.sol";
import "./MintableToken.sol";


/**
 * @title Crowdsale - modified from zeppelin-solidity library
 * @dev Crowdsale is a base contract for managing a token crowdsale.
 * Crowdsales have a start and end timestamps, where investors can make
 * token purchases and the crowdsale will assign them tokens based
 * on a token per ETH rate. Funds collected are forwarded to a wallet
 * as they arrive.
 */
contract Crowdsale {
  using SafeMath for uint256;

  // The token being sold
  MintableToken public tokenOnSale;

  // start and end timestamps where investments are allowed (both inclusive)
  uint256 public startTime;
  uint256 public endTime;

  // address where funds are collected
  address public wallet;

  // how many token units a buyer gets per wei
  uint256 public rate;

  // amount of raised money in wei
  uint256 public weiRaised;


   // event for token purchase logging
   // purchaser who paid for the tokens
   // beneficiary who got the tokens
   // value weis paid for purchase
   // amount amount of tokens purchased
  event TokenPurchase(address indexed purchaser, address indexed beneficiary, uint256 value, uint256 amount);

  function initCrowdsale(uint256 _startTime, uint256 _endTime, uint256 _rate, address _wallet) public {
    require(startTime == 0 && endTime == 0 && rate == 0 && wallet == address(0), "Ensure global variables are empty when initializing crowdsale");
    require(_startTime >= now, "_starTime is more than current time");
    require(_endTime >= _startTime, "_endTime must be more than _startTime");
    require(_rate > 0, "rate is greater than zero");
    require(_wallet != address(0), "_wallet params must not be empty");

    startTime = _startTime;
    endTime = _endTime;
    rate = _rate;
    wallet = _wallet;
  }

  // @return true if crowdsale event has ended
  function hasEnded() public view returns (bool) {
    return now > endTime;
  }

  // send ether to the fund collection wallet
  // override to create custom fund forwarding mechanisms
  function forwardFunds() internal {
    wallet.transfer(msg.value);
  }
}
