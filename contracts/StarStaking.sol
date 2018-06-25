pragma solidity 0.4.23;

import "zeppelin-solidity/contracts/ownership/Ownable.sol";
import "zeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";
import "./Lockable.sol";
import "./StarStakingInterface.sol";


contract StarStaking is StarStakingInterface, Lockable {
    using SafeMath for uint256;

    struct Checkpoint {
        uint256 at;
        uint256 amount;
    }

    ERC20 public token;

    Checkpoint[] public stakeHistory;

    mapping (address => Checkpoint[]) public stakesFor;

    /**
     * @param _token Token that can be staked.
     */
    function StarStaking(ERC20 _token) public {
        require(address(_token) != 0x0);
        token = _token;
    }

    /**
     * @dev Stakes a certain amount of tokens.
     * @param amount Amount of tokens to stake.
     * @param data Data field used for signalling in more complex staking applications.
     */
    function stake(uint256 amount, bytes data) public {
        stakeFor(msg.sender, amount, data);
    }

    /**
     * @dev Stakes a certain amount of tokens for another user.
     * @param user Address of the user to stake for.
     * @param amount Amount of tokens to stake.
     * @param data Data field used for signalling in more complex staking applications.
     */
    function stakeFor(address user, uint256 amount, bytes data) public onlyWhenUnlocked {
        updateCheckpointAtNow(stakesFor[user], amount, false);
        updateCheckpointAtNow(stakeHistory, amount, false);

        require(token.transferFrom(msg.sender, address(this), amount));

        emit Staked(user, amount, totalStakedFor(user), data);
    }

    /**
     * @dev Unstakes a certain amount of tokens.
     * @param amount Amount of tokens to unstake.
     * @param data Data field used for signalling in more complex staking applications.
     */
    function unstake(uint256 amount, bytes data) public {
        require(totalStakedFor(msg.sender) >= amount);

        updateCheckpointAtNow(stakesFor[msg.sender], amount, true);
        updateCheckpointAtNow(stakeHistory, amount, true);

        require(token.transfer(msg.sender, amount));
        emit Unstaked(msg.sender, amount, totalStakedFor(msg.sender), data);
    }

    /**
     * @dev Returns total tokens staked for address.
     * @param addr Address to check.
     * @return amount of tokens staked.
     */
    function totalStakedFor(address addr) public view returns (uint256) {
        Checkpoint[] storage stakes = stakesFor[addr];

        if (stakes.length == 0) {
            return 0;
        }

        return stakes[stakes.length-1].amount;
    }

    /**
     * @dev Returns total tokens staked.
     * @return amount of tokens staked.
     */
    function totalStaked() public view returns (uint256) {
        return totalStakedAt(block.number);
    }

    /**
     * @dev Returns if history related functions are implemented.
     * @return Bool whether history is implemented.
     */
    function supportsHistory() public pure returns (bool) {
        return true;
    }

    /**
     * @dev Returns the token address.
     * @return Address of token.
     */
    function token() public view returns (address) {
        return token;
    }

    /**
     * @dev Returns last block address staked at.
     * @param addr Address to check.
     * @return block number of last stake.
     */
    function lastStakedFor(address addr) public view returns (uint256) {
        Checkpoint[] storage stakes = stakesFor[addr];

        if (stakes.length == 0) {
            return 0;
        }

        return stakes[stakes.length-1].at;
    }

    /**
     * @dev Returns total amount of tokens staked at block for address.
     * @param addr Address to check.
     * @param blockNumber Block number to check.
     * @return amount of tokens staked.
     */
    function totalStakedForAt(address addr, uint256 blockNumber) public view returns (uint256) {
        return stakedAt(stakesFor[addr], blockNumber);
    }

    /**
     * @dev Returns the total tokens staked at block.
     * @param blockNumber Block number to check.
     * @return amount of tokens staked.
     */
    function totalStakedAt(uint256 blockNumber) public view returns (uint256) {
        return stakedAt(stakeHistory, blockNumber);
    }

    function updateCheckpointAtNow(Checkpoint[] storage history, uint256 amount, bool isUnstake) internal {
        uint256 length = history.length;
        if (length == 0) {
            history.push(Checkpoint({at: block.number, amount: amount}));
            return;
        }

        if (history[length-1].at < block.number) {
            history.push(Checkpoint({at: block.number, amount: history[length-1].amount}));
        }

        Checkpoint storage checkpoint = history[length];

        if (isUnstake) {
            checkpoint.amount = checkpoint.amount.sub(amount);
        } else {
            checkpoint.amount = checkpoint.amount.add(amount);
        }
    }

    function stakedAt(Checkpoint[] storage history, uint256 blockNumber) internal view returns (uint256) {
        uint256 length = history.length;

        if (length == 0 || blockNumber < history[0].at) {
            return 0;
        }

        if (blockNumber >= history[length-1].at) {
            return history[length-1].amount;
        }

        uint min = 0;
        uint max = length-1;
        while (max > min) {
            uint mid = (max + min + 1) / 2;
            if (history[mid].at <= blockNumber) {
                min = mid;
            } else {
                max = mid-1;
            }
        }

        return history[min].amount;
    }
}
