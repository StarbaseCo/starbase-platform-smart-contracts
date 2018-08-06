pragma solidity 0.4.24;

import "../node_modules/zeppelin-solidity/contracts/ownership/Ownable.sol";
import "../node_modules/zeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "../node_modules/zeppelin-solidity/contracts/math/SafeMath.sol";
import "./Lockable.sol";
import "./LinkedListLib.sol";
import "./StarStakingInterface.sol";

contract StarStaking is StarStakingInterface, Lockable {
    using SafeMath for uint256;
    using LinkedListLib for LinkedListLib.LinkedList;

    address constant HEAD = 0;
    bool constant PREV = false;
    bool constant NEXT = true;

    ERC20 public token;

    mapping (address => uint256) public totalStakingPointsFor;
    mapping (address => uint256) public totalStakedFor;

    LinkedListLib.LinkedList topRanks;
    uint256 topRanksCount;

    uint256 public startTime;
    uint256 public closingTime;

    modifier whenStakingOpen {
        require(now >= startTime);
        require(now < closingTime);

        _;
    }

    /**
     * @param _token Token that can be staked.
     */
    constructor(ERC20 _token, uint256 _startTime, uint256 _closingTime) public {
        require(address(_token) != 0x0);
        require(_startTime < _closingTime);
        require(_startTime > now);

        token = _token;
        startTime = _startTime;
        closingTime = _closingTime;
        topRanksCount = 0;
    }

    /**
     * @dev Stakes a certain amount of tokens.
     * @param amount Amount of tokens to stake.
     */
    function stake(uint256 amount) public {
        stakeFor(msg.sender, amount);
    }

    /**
     * @dev Stakes a certain amount of tokens for another user.
     * @param user Address of the user to stake for.
     * @param amount Amount of tokens to stake.
     */
    function stakeFor(address user, uint256 amount) public onlyWhenUnlocked whenStakingOpen {
        addStakingPoints(user, amount);

        require(token.transferFrom(msg.sender, address(this), amount));
    }

    function addStakingPoints(address user, uint256 amount) internal {
        uint256 timeUntilEnd = closingTime.sub(now);
        uint256 addedStakingPoints = timeUntilEnd.mul(amount);

        totalStakingPointsFor[user] = totalStakingPointsFor[user].add(addedStakingPoints);
        totalStakedFor[user] = totalStakedFor[user].add(amount);

        emit Staked(user, amount, addedStakingPoints);
    }

    // TODO: Remove for production
    function fakeInsert(address user, uint256 amount, address referenceNode) public {
        addStakingPoints(user, amount);
        topRanks.insert(referenceNode, user, NEXT);
    }
}
