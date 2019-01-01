pragma solidity 0.4.25;

import "./lib/Ownable.sol";
import "./lib/SafeMath.sol";
import "./lib/ERC20.sol";
import "./lib/Lockable.sol";
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

    uint256 public topRanksMaxSize;
    uint256 public startTime;
    uint256 public closingTime;

    uint256 public stakeSaleCap;
    uint256 public maxStakePerUser;
    uint256 public totalRaised;

    modifier whenStakingOpen {
        require(now >= startTime, "Staking period not yet started!");
        require(now < closingTime, "Staking period already closed!");

        _;
    }

    /**
     * @param _token Token that can be staked.
     * @param _topRanksMaxSize Maximal size of the top ranks.
     * @param _startTime Timestamp for the beginning of the staking event.
     * @param _closingTime Timestamp of the end of staking event.
     */
    constructor(
        ERC20 _token,
        uint256 _topRanksMaxSize,
        uint256 _startTime,
        uint256 _closingTime,
        uint256 _stakeSaleCap,
        uint256 _maxStakePerUser
    ) public {
        require(address(_token) != address(0), "Token address may must be defined!");
        require(_startTime < _closingTime, "Start time must be before closing time!");
        require(_startTime >= now, "Start time must be after current time!");
        require(_topRanksMaxSize > 0, "Top ranks size must be more than 0!");
        require(_stakeSaleCap > 0, "StakingSale cap should be higher than 0!");
        require(_maxStakePerUser > 0, "Max stake per user should be higher than 0!");

        token = _token;
        startTime = _startTime;
        closingTime = _closingTime;
        topRanksCount = 0;
        topRanksMaxSize = _topRanksMaxSize;
        stakeSaleCap = _stakeSaleCap;
        maxStakePerUser = _maxStakePerUser;
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
        require(_amount > 0, "Insert amount higher than 0!");
        uint256 amount = _amount;

        if (totalRaised.add(_amount) > stakeSaleCap) {
            require(totalRaised < stakeSaleCap, "StakeSale cap reached, the sale is finished!");
            amount = stakeSaleCap.sub(totalRaised);
        }

        if (totalStakedFor[_user].add(_amount) > maxStakePerUser) {
            require(totalStakedFor[_user] < maxStakePerUser, "Maximal stake for user reached!");
            amount = maxStakePerUser.sub(totalStakedFor[_user]);
        }

        addStakingPoints(_user, amount);

        if (topRanksCount == 0) {
            topRanks.insert(HEAD, _user, NEXT);
            topRanksCount++;
        } else {
            if (topRanksCount < topRanksMaxSize) {
                require(_node != address(0), "Top ranks count below threshold, please provide suggested position!");
            }

            if (_node != address(0)) {
                require(topRanks.nodeExists(_node), "Node for suggested position does not exist!");
                sortedInsert(_user, _node);

                if (topRanksCount < topRanksMaxSize) {
                    topRanksCount++;
                } else {
                    topRanks.pop(PREV);
                }
            }
        }

        require(token.transferFrom(msg.sender, address(this), amount), "Not enough funds for sender!");
        totalRaised = totalRaised.add(amount);
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

    /// @dev Can be used before `stakeFor` to get the correct reference node
    /// @param _value value to seek
    //  @return next first node beyond '_node'
    function getSortedSpot(uint256 _value) external view returns (address) {
        if (topRanks.sizeOf() == 0) {
            return address(0);
        }

        bool exists;
        address next;
        (exists, next) = topRanks.getAdjacent(HEAD, PREV);

        while ((next != 0) && ((totalStakingPointsFor[next] < _value))) {
            next = topRanks.list[next][PREV];
        }

        if (next == 0) {
            return topRanks.list[next][NEXT];
        }

        return next;
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
