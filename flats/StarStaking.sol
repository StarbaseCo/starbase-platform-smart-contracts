pragma solidity 0.4.25;

// File: contracts/lib/Ownable.sol

/**
 * @title Ownable
 * @dev The Ownable contract has an owner address, and provides basic authorization control
 * functions, this simplifies the implementation of "user permissions".
 */
contract Ownable {
    address public _owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev The Ownable constructor sets the original `owner` of the contract to the sender
     * account.
     */
    constructor () internal {
        _owner = msg.sender;
        emit OwnershipTransferred(address(0), _owner);
    }

    /**
     * @return the address of the owner.
     */
    function owner() public view returns (address) {
        return _owner;
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        require(isOwner(), "only owner is able call this function");
        _;
    }

    /**
     * @return true if `msg.sender` is the owner of the contract.
     */
    function isOwner() public view returns (bool) {
        return msg.sender == _owner;
    }

    /**
     * @dev Allows the current owner to relinquish control of the contract.
     * @notice Renouncing to ownership will leave the contract without an owner.
     * It will not be possible to call the functions with the `onlyOwner`
     * modifier anymore.
     */
    function renounceOwnership() public onlyOwner {
        emit OwnershipTransferred(_owner, address(0));
        _owner = address(0);
    }

    /**
     * @dev Allows the current owner to transfer control of the contract to a newOwner.
     * @param newOwner The address to transfer ownership to.
     */
    function transferOwnership(address newOwner) public onlyOwner {
        _transferOwnership(newOwner);
    }

    /**
     * @dev Transfers control of the contract to a newOwner.
     * @param newOwner The address to transfer ownership to.
     */
    function _transferOwnership(address newOwner) internal {
        require(newOwner != address(0));
        emit OwnershipTransferred(_owner, newOwner);
        _owner = newOwner;
    }
}

// File: contracts/lib/SafeMath.sol

/**
 * @title SafeMath
 * @dev Math operations with safety checks that throw on error
 */
library SafeMath {

  /**
  * @dev Multiplies two numbers, throws on overflow.
  */
  function mul(uint256 a, uint256 b) internal pure returns (uint256 c) {
    if (a == 0) {
      return 0;
    }
    c = a * b;
    assert(c / a == b);
    return c;
  }

  /**
  * @dev Integer division of two numbers, truncating the quotient.
  */
  function div(uint256 a, uint256 b) internal pure returns (uint256) {
    // assert(b > 0); // Solidity automatically throws when dividing by 0
    // uint256 c = a / b;
    // assert(a == b * c + a % b); // There is no case in which this doesn't hold
    return a / b;
  }

  /**
  * @dev Subtracts two numbers, throws on overflow (i.e. if subtrahend is greater than minuend).
  */
  function sub(uint256 a, uint256 b) internal pure returns (uint256) {
    assert(b <= a);
    return a - b;
  }

  /**
  * @dev Adds two numbers, throws on overflow.
  */
  function add(uint256 a, uint256 b) internal pure returns (uint256 c) {
    c = a + b;
    assert(c >= a);
    return c;
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

// File: contracts/lib/Lockable.sol

contract Lockable is Ownable {

    bool public locked;

    modifier onlyWhenUnlocked() {
        require(!locked);
        _;
    }

    function lock() external onlyOwner {
        locked = true;
    }

    function unlock() external onlyOwner {
        locked = false;
    }
}

// File: contracts/LinkedListLib.sol

/**
 * @title LinkedListLib
 * @author Darryl Morris (o0ragman0o) and Modular.network
 *
 * Modified by Markus Waas (gorgos) and Starbase
 *
 * This utility library was forked from https://github.com/o0ragman0o/LibCLL
 * into the Modular-Network ethereum-libraries repo at https://github.com/Modular-Network/ethereum-libraries
 * It has been updated to add additional functionality and be more compatible with solidity 0.4.18
 * coding patterns.
 *
 * version 1.0.0
 * Copyright (c) 2017 Modular Inc.
 * The MIT License (MIT)
 * https://github.com/Modular-Network/ethereum-libraries/blob/master/LICENSE
 *
 * The LinkedListLib provides functionality for implementing data indexing using
 * a circlular linked list
 *
 * Modular provides smart contract services and security reviews for contract
 * deployments in addition to working on open source projects in the Ethereum
 * community. Our purpose is to test, document, and deploy reusable code onto the
 * blockchain and improve both security and usability. We also educate non-profits,
 * schools, and other community members about the application of blockchain
 * technology. For further information: modular.network
 *
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 * OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/


library LinkedListLib {
    address constant NULL = address(0);
    address constant HEAD = address(0);
    bool constant PREV = false;
    bool constant NEXT = true;

    struct LinkedList{
        mapping (address => mapping (bool => address)) list;
    }

    /// @dev returns true if the list exists
    /// @param self stored linked list from contract
    function listExists(LinkedList storage self)
        internal
        view returns (bool)
    {
        // if the head nodes previous or next pointers both point to itself, then there are no items in the list
        if (self.list[HEAD][PREV] != HEAD || self.list[HEAD][NEXT] != HEAD) {
            return true;
        } else {
            return false;
        }
    }

    /// @dev returns true if the node exists
    /// @param self stored linked list from contract
    /// @param _node a node to search for
    function nodeExists(LinkedList storage self, address _node)
        internal
        view returns (bool)
    {
        if (self.list[_node][PREV] == HEAD && self.list[_node][NEXT] == HEAD) {
            if (self.list[HEAD][NEXT] == _node) {
                return true;
            } else {
                return false;
            }
        } else {
            return true;
        }
    }

    /// @dev Returns the number of elements in the list
    /// @param self stored linked list from contract
    function sizeOf(LinkedList storage self) internal view returns (uint256 numElements) {
        bool exists;
        address i;
        (exists,i) = getAdjacent(self, HEAD, NEXT);
        while (i != HEAD) {
            (exists,i) = getAdjacent(self, i, NEXT);
            numElements++;
        }
        return;
    }

    /// @dev Returns the links of a node as a tuple
    /// @param self stored linked list from contract
    /// @param _node id of the node to get
    function getNode(LinkedList storage self, address _node)
        internal view returns (bool,address,address)
    {
        if (!nodeExists(self,_node)) {
            return (false,0,0);
        } else {
            return (true,self.list[_node][PREV], self.list[_node][NEXT]);
        }
    }

    /// @dev Returns the link of a node `_node` in direction `_direction`.
    /// @param self stored linked list from contract
    /// @param _node id of the node to step from
    /// @param _direction direction to step in
    function getAdjacent(LinkedList storage self, address _node, bool _direction)
        internal view returns (bool,address)
    {
        if (!nodeExists(self,_node)) {
            return (false,0);
        } else {
            return (true,self.list[_node][_direction]);
        }
    }

    /// @dev Creates a bidirectional link between two nodes on direction `_direction`
    /// @param self stored linked list from contract
    /// @param _node first node for linking
    /// @param _link  node to link to in the _direction
    function createLink(LinkedList storage self, address _node, address _link, bool _direction) internal  {
        self.list[_link][!_direction] = _node;
        self.list[_node][_direction] = _link;
    }

    /// @dev Insert node `_new` beside existing node `_node` in direction `_direction`.
    /// @param self stored linked list from contract
    /// @param _node existing node
    /// @param _new  new node to insert
    /// @param _direction direction to insert node in
    function insert(LinkedList storage self, address _node, address _new, bool _direction) internal returns (bool) {
        if(!nodeExists(self,_new) && nodeExists(self,_node)) {
            address c = self.list[_node][_direction];
            createLink(self, _node, _new, _direction);
            createLink(self, _new, c, _direction);
            return true;
        } else {
            return false;
        }
    }

    /// @dev removes an entry from the linked list
    /// @param self stored linked list from contract
    /// @param _node node to remove from the list
    function remove(LinkedList storage self, address _node) internal returns (address) {
        if ((_node == NULL) || (!nodeExists(self,_node))) {
            return 0;
        }
        createLink(self, self.list[_node][PREV], self.list[_node][NEXT], NEXT);
        delete self.list[_node][PREV];
        delete self.list[_node][NEXT];
        return _node;
    }

    /// @dev pushes an entry to the head of the linked list
    /// @param self stored linked list from contract
    /// @param _node new entry to push to the head
    /// @param _direction push to the head (NEXT) or tail (PREV)
    function push(LinkedList storage self, address _node, bool _direction) internal  {
        insert(self, HEAD, _node, _direction);
    }

    /// @dev pops the first entry from the linked list
    /// @param self stored linked list from contract
    /// @param _direction pop from the head (NEXT) or the tail (PREV)
    function pop(LinkedList storage self, bool _direction) internal returns (address) {
        bool exists;
        address adj;

        (exists,adj) = getAdjacent(self, HEAD, _direction);

        return remove(self, adj);
    }
}

// File: contracts/StarStakingInterface.sol

contract StarStakingInterface {
    event Staked(address indexed user, uint256 amount, uint256 addedStakingPoints);
}

// File: contracts\StarStaking.sol

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

        if (topRanksCount != 0) {
            require(_node != HEAD, "Please provide suggested node position (from getSortedSpot())!");
            require(topRanks.nodeExists(_node), "Node for suggested position does not exist!");
        }

        addStakingPoints(_user, amount);
        sortedInsert(_user, _node);

        require(token.transferFrom(msg.sender, address(this), amount), "Not enough funds for sender!");
        totalRaised = totalRaised.add(amount);
    }

    function doesCorrectlyInsertAtFirstRank(
        uint256 newRankPoints,
        uint256 replacedRankPoints,
        address oneRankAbove
    ) private pure returns (bool) {
        return oneRankAbove == HEAD && newRankPoints > replacedRankPoints;
    }

    function ensureCorrectInsertPosition(
        uint256 newRankPoints,
        uint256 replacedRankPoints,
        uint256 oneRankBelowPoints
    ) private pure {
        require(newRankPoints < replacedRankPoints, "Suggested position into top ranks too low!");
        require(newRankPoints > oneRankBelowPoints, "Suggested position into top ranks too high!");
    }

    function sortedInsert(address _user, address _node) private {
        address oneRankAbove = topRanks.list[_node][PREV];
        address oneRankBelow = topRanks.list[_node][NEXT];

        uint256 newRankPoints = totalStakingPointsFor[_user];
        uint256 replacedRankPoints = totalStakingPointsFor[_node];
        uint256 oneRankBelowPoints = totalStakingPointsFor[oneRankBelow];

        if (topRanksCount == 0) {
            topRanks.insert(HEAD, _user, NEXT);
        } else if (doesCorrectlyInsertAtFirstRank(newRankPoints, replacedRankPoints, oneRankAbove)) {
            topRanks.insert(_node, _user, PREV);
        } else {
            ensureCorrectInsertPosition(
                newRankPoints,
                replacedRankPoints,
                oneRankBelowPoints
            );

            topRanks.insert(_node, _user, NEXT);
        }
        
        topRanksCount < topRanksMaxSize ? incrementTopRanksCount(): topRanks.pop(PREV);
    }

    function incrementTopRanksCount() private returns (address) {
        topRanksCount = topRanksCount.add(1);
        return HEAD;
    }

    function addStakingPoints(address _user, uint256 _amount) private {
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
