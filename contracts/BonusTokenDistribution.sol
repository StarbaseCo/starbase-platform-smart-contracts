pragma solidity 0.5.9;

import "./lib/Ownable.sol";
import "./lib/SafeMath.sol";
import "./lib/ERC20Plus.sol";
import "./lib/Lockable.sol";

/**
 * @title BonusTokenDistribution - contract for handling bonus tokens
 * @author Markus Waas - <markus@starbase.co>
 */

contract BonusTokenDistribution is Lockable {
    using SafeMath for uint256;

    ERC20Plus public tokenOnSale;

    uint256 public startTime;
    uint256 public endTime;

    mapping (address => uint256) public bonusTokenBalances;

    modifier isAfterClaimPeriod {
        require(
            (now > endTime.add(60 days)),
            'Claim period is not yet finished!'
        );

        _;
    }

    modifier hasStarted {
        require(
            now >= startTime,
            "Distribution period not yet started!"
        );

        _;
    }

    /**
     * @param _startTime Timestamp for the beginning of the bonus campaign
     * @param _endTime Timestamp of the end of the bonus campaign
     * @param _tokenOnSale Token that will be distributed
     */
    constructor(
        uint256 _startTime,
        uint256 _endTime,
        address _tokenOnSale
    ) public {
        require(_startTime >= now, "startTime must be more than current time!");
        require(_endTime >= _startTime, "endTime must be more than startTime!");
        require(_tokenOnSale != address(0), "tokenOnSale cannot be 0!");

        startTime = _startTime;
        endTime = _endTime;
        tokenOnSale = ERC20Plus(_tokenOnSale);
    }

    /**
     * @dev Adds bonus claim for user
     * @param _user Address of the user
     * @param _amount Amount of tokens he can claim
     */
    function addBonusClaim(address _user, uint256 _amount)
        public
        onlyOwner
        hasStarted {
        require(_user != address(0), "user cannot be 0!");
        require(_amount > 0, "amount cannot be 0!");

        bonusTokenBalances[_user] = bonusTokenBalances[_user].add(_amount);
    }

    /**
     * @dev Withdraw bonus tokens
     */
    function withdrawBonusTokens() public onlyWhenUnlocked hasStarted {
        uint256 bonusTokens = bonusTokenBalances[msg.sender];
        uint256 tokenBalance = tokenOnSale.balanceOf(address(this));

        require(bonusTokens > 0, 'No bonus tokens to withdraw!');
        require(tokenBalance >= bonusTokens, 'Not enough bonus tokens left!');

        bonusTokenBalances[msg.sender] = 0;
        tokenOnSale.transfer(msg.sender, bonusTokens);
    }

    /**
     * @dev Withdraw any left over tokens for owner after 60 days claim period.
     */
    function withdrawLeftoverBonusTokensOwner()
        public
        isAfterClaimPeriod
        onlyOwner {
        uint256 tokenBalance = tokenOnSale.balanceOf(address(this));
        require(tokenBalance > 0, 'No bonus tokens leftover!');

        tokenOnSale.transfer(msg.sender, tokenBalance);
    }
}