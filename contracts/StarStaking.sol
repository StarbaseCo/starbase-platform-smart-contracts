pragma solidity 0.4.24;

import "./lib/Ownable.sol";
import "./lib/SafeMath.sol";
import "./lib/ERC20.sol";
import "./Lockable.sol";
import "./LinkedListLib.sol";
import "./StarStakingInterface.sol";

contract StarStaking is StarStakingInterface, Lockable {
    using SafeMath for uint256;
    using LinkedListLib for LinkedListLib.LinkedList;

    address constant HEAD = address(0);
    bool constant PREV = false;
    bool constant NEXT = true;

    ERC20 public token;

    mapping (address => uint256) public totalStakingPointsFor;
    mapping (address => uint256) public totalStakedFor;

    LinkedListLib.LinkedList topRanks;
    uint256 public topRanksCount;

    uint256 public startTime;
    uint256 public closingTime;

    modifier whenStakingOpen {
        require(now >= startTime, "Staking period not yet started!");
        require(now < closingTime, "Staking period already closed!");

        _;
    }

    /**
     * @param _token Token that can be staked.
     * @param _startTime Timestamp for the beginning of the staking event.
     * @param _closingTime Timestamp of the end of staking event.
     */
    constructor(ERC20 _token, uint256 _startTime, uint256 _closingTime) public {
        require(address(_token) != address(0), "Token address may must be defined!");
        require(_startTime < _closingTime, "Start time must be before closing time!");
        require(_startTime > now, "Start time must be after current time!");

        token = _token;
        startTime = _startTime;
        closingTime = _closingTime;
        topRanksCount = 0;
    }

    /**
     * @dev Stakes a certain amount of tokens.
     * @param _amount Amount of tokens to stake.
     * @param _node Node as reference for insert position into top ranks.
     */
    function stake(uint256 _amount, address _node) public {
        stakeFor(msg.sender, _amount, _node);
    }

    /**
     * @dev Stakes a certain amount of tokens for another user.
     * @param _user Address of the user to stake for.
     * @param _amount Amount of tokens to stake.
     * @param _node Node as reference for insert position into top ranks.
     */
    function stakeFor(address _user, uint256 _amount, address _node) public onlyWhenUnlocked whenStakingOpen {
        addStakingPoints(_user, _amount);

        if (topRanksCount == 0) {
            topRanks.insert(HEAD, _user, NEXT);
            topRanksCount++;
        } else {
            if (topRanksCount < 100) {
                require(_node != address(0), "Top ranks count below threshold, please provide suggested position!");
            }

            if (_node != address(0)) {
                require(topRanks.nodeExists(_node), "Node for suggested position does not exist!");
                sortedInsert(_user, _node);

                if (topRanksCount < 100) {
                    topRanksCount++;
                } else {
                    topRanks.pop(PREV);
                }
            }
        }

        require(token.transferFrom(msg.sender, address(this), _amount), "Not enough funds for sender!");
    }

    function sortedInsert(address _user, address _node) internal {
        uint256 newRankPoints = totalStakingPointsFor[_user];
        uint256 replacedRankPoints = totalStakingPointsFor[_node];
        address oneRankAbove = topRanks.list[_node][PREV];

        if (oneRankAbove == HEAD && newRankPoints > replacedRankPoints) {
            // first place
            topRanks.insert(_node, _user, PREV);
            return;
        }

        require(newRankPoints < replacedRankPoints, "Suggested position into top ranks too low!");

        address oneRankBelow = topRanks.list[_node][NEXT];
        if (oneRankBelow != HEAD) {
            uint256 oneRankBelowPoints = totalStakingPointsFor[oneRankBelow];
            require(newRankPoints > oneRankBelowPoints, "Suggested position into top ranks too high!");
        }

        topRanks.insert(_node, _user, NEXT);
    }

    function addStakingPoints(address _user, uint256 _amount) internal {
        uint256 timeUntilEnd = closingTime.sub(now);
        uint256 addedStakingPoints = timeUntilEnd.mul(_amount);

        totalStakingPointsFor[_user] = totalStakingPointsFor[_user].add(addedStakingPoints);
        totalStakedFor[_user] = totalStakedFor[_user].add(_amount);

        emit Staked(_user, _amount, addedStakingPoints);
    }

    /**
     * @dev Returns the previous or next top rank node.
     * @param _referenceNode Address of the reference.
     * @param _direction Bool for direction.
     */
    function getTopRank(address _referenceNode, bool _direction) public view returns (address) {
        return topRanks.list[_referenceNode][_direction];
    }

    /**
     * @dev Returns a flat list of 3-tuples (address, stakingPoints, totalStaked).
     */
    function getTopRanksTuples() public view returns (uint256[]) {
        uint256 tripleRanksCount = topRanksCount * 3;
        uint256[] memory topRanksList = new uint256[](tripleRanksCount);

        address referenceNode = HEAD;
        uint256 x = 0;

        while(x < tripleRanksCount) {
            referenceNode = getTopRank(referenceNode, NEXT);

            topRanksList[x] = uint256(referenceNode);
            x++;

            topRanksList[x] = totalStakingPointsFor[referenceNode];
            x++;

            topRanksList[x] = totalStakedFor[referenceNode];
            x++;
        }

        return topRanksList;
    }
}
