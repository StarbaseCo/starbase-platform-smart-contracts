pragma solidity 0.4.21;

import "./StarStaking.sol";


contract StarStakingWithTokenReturn is StarStaking {
    ERC20 public returnToken;
    uint256 public rate;

    /**
     * @dev contract that returns other token when staking STAR
     * @param _token Token that can be staked.
     * @param _returnToken Token that is given to user once he stakes.
     * @param _rate Rate of return tokens per token.
     */
    function StarStakingWithTokenReturn
        (
            ERC20 _token,
            ERC20 _returnToken,
            uint256 _rate
        )
        public
        StarStaking(_token)
    {
        require(address(_returnToken) != 0x0);
        require(_token != _returnToken);
        require(_rate > 0);

        returnToken = _returnToken;
        rate = _rate;
    }

    /**
     * @dev Stakes a certain amount of tokens for another user.
     * @param user Address of the user to stake for.
     * @param amount Amount of tokens to stake.
     * @param data Data field used for signalling in more complex staking applications.
     */
    function stakeFor(address user, uint256 amount, bytes data) public {
        super.stakeFor(user, amount, data);
        require(returnToken.transfer(user, amount.mul(getRate())));
    }

    /**
     * @dev Unstakes a certain amount of tokens.
     * @param amount Amount of tokens to unstake.
     * @param data Data field used for signalling in more complex staking applications.
     */
    function unstake(uint256 amount, bytes data) public {
        super.unstake(amount, data);

        uint256 returnAmount = amount.div(getRate());
        require(returnAmount.mul(getRate()) == amount);

        require(returnToken.transferFrom(msg.sender, address(this), returnAmount));
    }

    /**
     * @dev Returns conversion rate from token to returnToken. In function so it can be overridden.
     * @return conversion rate.
     */
    function getRate() public view returns (uint256) {
        return rate;
    }
}
