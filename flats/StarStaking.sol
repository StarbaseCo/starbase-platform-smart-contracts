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
 * @dev Unsigned math operations with safety checks that revert on error.
 */
library SafeMath {
    /**
     * @dev Multiplies two unsigned integers, reverts on overflow.
     */
    function mul(uint256 a, uint256 b) internal pure returns (uint256) {
        // Gas optimization: this is cheaper than requiring 'a' not being zero, but the
        // benefit is lost if 'b' is also tested.
        // See: https://github.com/OpenZeppelin/openzeppelin-solidity/pull/522
        if (a == 0) {
            return 0;
        }

        uint256 c = a * b;
        require(c / a == b, 'SafeMul overflow!');

        return c;
    }

    /**
     * @dev Integer division of two unsigned integers truncating the quotient, reverts on division by zero.
     */
    function div(uint256 a, uint256 b) internal pure returns (uint256) {
        // Solidity only automatically asserts when dividing by 0
        require(b > 0, 'SafeDiv cannot divide by 0!');
        uint256 c = a / b;
        // assert(a == b * c + a % b); // There is no case in which this doesn't hold

        return c;
    }

    /**
     * @dev Subtracts two unsigned integers, reverts on overflow (i.e. if subtrahend is greater than minuend).
     */
    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b <= a, 'SafeSub underflow!');
        uint256 c = a - b;

        return c;
    }

    /**
     * @dev Adds two unsigned integers, reverts on overflow.
     */
    function add(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a + b;
        require(c >= a, 'SafeAdd overflow!');

        return c;
    }

    /**
     * @dev Divides two unsigned integers and returns the remainder (unsigned integer modulo),
     * reverts when dividing by zero.
     */
    function mod(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b != 0, 'SafeMod cannot compute modulo of 0!');
        return a % b;
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

// File: contracts/StarEthRateInterface.sol

contract StarEthRateInterface {
    function decimalCorrectionFactor() public returns (uint256);
    function starEthRate() public returns (uint256);
}

// File: contracts/StarStakingInterface.sol

contract StarStakingInterface {
    event Staked(address indexed user, uint256 amount);
}

// File: contracts\StarStaking.sol

contract StarStaking is StarStakingInterface, Lockable {
    using SafeMath for uint256;
    using LinkedListLib for LinkedListLib.LinkedList;

    address constant HEAD = address(0);
    bool constant PREV = false;
    bool constant NEXT = true;

    ERC20 public starToken;
    ERC20 public tokenOnSale;
    StarEthRateInterface public starEthRateInterface;

    mapping (address => bool) public hasWithdrawnTokens;
    mapping (address => uint256) public totalStakingPointsFor;
    mapping (address => uint256) public totalStakedFor;

    LinkedListLib.LinkedList topRanks;

    uint256 public startTime;
    uint256 public endTime;

    uint256 public topRanksMaxSize;
    uint256 public targetRateInEth;
    uint256 public maxDiscountPer1000;
    uint256 public declinePerRankPer1000;
    uint256 public stakeSaleCap;
    uint256 public maxStakePerUser;
    uint256 public totalRaised;
    address public wallet;

    modifier whenStakingOpen {
        require(now >= startTime, "Staking period not yet started!");
        require(now < endTime, "Staking period already closed!");

        _;
    }

    modifier isFinished {
        require(
            now > endTime || totalRaised >= stakeSaleCap,
            "Staking period not yet closed!"
        );

        _;
    }

    /**
     * @param _starEthRateInterface StarEthRate contract for receiving conversion rate of STAR/ETH
     * @param _starToken Token that can be staked
     * @param _tokenOnSale Token that will be sold
     * @param _topRanksMaxSize Maximal size of the top ranks
     * @param _startTime Timestamp for the beginning of the staking event
     * @param _endTime Timestamp of the end of staking event
     * @param _targetRateInEth The baseline target rate in ETH for purchases
     * @param _maxDiscountPer1000 The max discount per 1000 for rank 1.
     * @param _declinePerRankPer1000 The discount decline per rank per 1000.
     * @param _stakeSaleCap The cap amount for total staking
     * @param _maxStakePerUser The maximum amount permitted per user
     * @param _wallet TokenSale wallet where STAR from staking will be transferred
     */
    constructor(
        StarEthRateInterface _starEthRateInterface,
        ERC20 _starToken,
        ERC20 _tokenOnSale,
        uint256 _startTime,
        uint256 _endTime,
        uint256 _topRanksMaxSize,
        uint256 _targetRateInEth,
        uint256 _maxDiscountPer1000,
        uint256 _declinePerRankPer1000,
        uint256 _stakeSaleCap,
        uint256 _maxStakePerUser,
        address _wallet
    ) public {
        require(
            address(_starEthRateInterface) != address(0),
            "StarEthRate address must be defined!"
        );
        require(
            address(_starToken) != address(0),
            "Star token address must be defined!"
        );
        require(
            address(_tokenOnSale) != address(0),
            "Token on sale address must be defined!"
        );
        require(
            _startTime < _endTime,
            "Start time must be before closing time!"
        );
        require(_startTime >= now, "Start time must be after current time!");
        require(_topRanksMaxSize > 0, "Top ranks size must be more than 0!");
        require(_targetRateInEth > 0, "Target rate must be more than 0!");
        require(_maxDiscountPer1000 > 0, "Max discount must be more than 0!");
        require(
            _declinePerRankPer1000 > 0,
            "Decline per rank must be more than 0!"
        );
        require(
            _stakeSaleCap > 0,
            "StakingSale cap should be higher than 0!"
        );
        require(
            _maxStakePerUser > 0,
            "Max stake per user should be higher than 0!"
        );
        require(
            _maxStakePerUser < _stakeSaleCap,
            "Max stake per user should be smaller than StakeSale cap!"
        );
        require(_wallet != address(0), "Wallet address may must be defined!");

        uint256 maxDecline = _topRanksMaxSize
            .sub(1)
            .mul(_declinePerRankPer1000);

        require(
            _maxDiscountPer1000 >= maxDecline,
            'Please increase max discount or decrease decline per rank!'
        );

        starEthRateInterface = _starEthRateInterface;
        starToken = _starToken;
        tokenOnSale = _tokenOnSale;
        startTime = _startTime;
        endTime = _endTime;
        topRanksMaxSize = _topRanksMaxSize;
        targetRateInEth = _targetRateInEth;
        maxDiscountPer1000 = _maxDiscountPer1000;
        declinePerRankPer1000 = _declinePerRankPer1000;
        stakeSaleCap = _stakeSaleCap.mul(10 ** 18);
        maxStakePerUser = _maxStakePerUser.mul(10 ** 18);
        wallet = _wallet;
    }

    /**
     * @dev Stakes a certain amount of tokens.
     * @param _amount Amount of tokens to stake.
     * @param _oneRankAboveNode Node as reference for insert position into top ranks.
     */
    function stake(uint256 _amount, address _oneRankAboveNode) public {
        stakeFor(msg.sender, _amount, _oneRankAboveNode);
    }

    /**
     * @dev Stakes a certain amount of tokens for another user.
     * @param _user Address of the user to stake for.
     * @param _amount Amount of tokens to stake.
     * @param _oneRankAboveNode Node as reference for insert position into top ranks.
     */
    function stakeFor(address _user, uint256 _amount, address _oneRankAboveNode)
        public
        onlyWhenUnlocked
        whenStakingOpen
    {
        require(
            _user != _oneRankAboveNode,
            'One rank above cannot be equal to inserted user!'
        );

        require(_amount > 0, "Insert amount higher than 0!");
        uint256 amount = _amount;

        if (totalRaised.add(_amount) > stakeSaleCap) {
            require(
                totalRaised < stakeSaleCap,
                "StakeSale cap reached, the sale is finished!"
            );
            amount = stakeSaleCap.sub(totalRaised);
        }

        if (totalStakedFor[_user].add(_amount) > maxStakePerUser) {
            require(
                totalStakedFor[_user] < maxStakePerUser,
                "Maximal stake for user reached!"
            );
            amount = maxStakePerUser.sub(totalStakedFor[_user]);
        }

        if (topRanks.sizeOf() > 0) {
            require(
                _oneRankAboveNode == HEAD || topRanks.nodeExists(_oneRankAboveNode),
                "Node for suggested position does not exist!"
            );
        } else {
            require(
                _oneRankAboveNode == HEAD,
                "Reference node must be empty for first inserted node!"
            );
        }

        _addStakingPoints(_user, amount);

        if (topRanks.sizeOf() == 0 || _oneRankAboveNode != HEAD) {
            _sortedInsert(_user, _oneRankAboveNode);
        }

        require(
            starToken.transferFrom(msg.sender, wallet, amount),
            "Not enough funds for sender!"
        );
        totalRaised = totalRaised.add(amount);
    }

    /**
     * @dev Can be used before `stakeFor` to get the correct reference node
     * @param _addedStake new added stake for calling user
     * @return reference node for insertion in top ranks
     */
    function getSortedSpotForNewStake(uint256 _addedStake)
        external
        view
        returns (address)
    {
        address user = msg.sender;
        uint256 newStakingPoints = computeStakingPoints(user, _addedStake);

        return getSortedSpotForPoints(newStakingPoints);
    }

    /**
     * @dev Can be used before `stakeFor` to get the correct reference node
     * @param _stakingPoints new points for user to insert
     * @return reference node for insertion in top ranks
     */
    function getSortedSpotForPoints(uint256 _stakingPoints)
        public
        view
        returns (address)
    {
        if (topRanks.sizeOf() == 0) {
            return HEAD;
        }

        address node = getTopRank(HEAD, PREV);

        while (
            (node != HEAD) && ((totalStakingPointsFor[node] < _stakingPoints))
            || (node == msg.sender)
        ) {
            node = getTopRank(node, PREV);
        }

        if (node == HEAD) {
            node = getTopRank(HEAD, NEXT);

            if (node == msg.sender) node = getTopRank(node, NEXT);
        }

        return node;
    }

    /**
     * @dev Reads the current discount in % for the passed staking points.
     * @param _stakingPoints The staking points to be used.
     * @return The discount.for given staking points.
     */
    function getDiscountEstimateForPoints(uint256 _stakingPoints)
        public
        view
        returns (uint256)
    {
        address oneRankAbove = getSortedSpotForPoints(_stakingPoints);
        address replacedUser = getTopRank(oneRankAbove, NEXT);

        if (replacedUser == HEAD) {
            return 0;
        }

        (uint256 rank,) = _stakingPoints > totalStakingPointsFor[oneRankAbove]
            ? (0, true) : getRankForUser(replacedUser);

        return _computeDiscountForRank(rank);
    }

    /**
     * @dev Returns the previous or next top rank node.
     * @param _referenceNode Address of the reference.
     * @param _direction Bool for direction.
     * @return The previous or next top rank node.
     */
    function getTopRank(address _referenceNode, bool _direction)
        public
        view
        returns (address)
    {
        return topRanks.list[_referenceNode][_direction];
    }

    /**
     * @dev Read the current rank for the given user.
     * @param _user The user to be looked at.
     * @return The current rank in the top ranks and boolean to indicate,
     * if user was found in the top ranks.
     */
    function getRankForUser(address _user)
        public
        view
        returns (uint256, bool)
    {
        address referenceNode = HEAD;

        for (uint256 i = 0; i < topRanks.sizeOf(); i++) {
            referenceNode = getTopRank(referenceNode, NEXT);

            if (referenceNode == _user) {
                return (i, true);
            }
        }

        return (0, false);
    }

    /**
     * @dev Returns a flat list of 3-tuples (address, stakingPoints, totalStaked).
     */
    function getTopRanksTuples() public view returns (uint256[]) {
        uint256 tripleRanksCount = topRanks.sizeOf() * 3;
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

    /**
     * @dev Withdraw all received tokens after staking is finished.
     */
    function withdrawAllReceivedTokens() external isFinished {
        require(
            !hasWithdrawnTokens[msg.sender],
            'User has already withdrawn tokens!'
        );
        hasWithdrawnTokens[msg.sender] = true;

        uint256 baseTokens = _computeBaseTokens();
        uint256 bonusTokens = _computeBonusTokens(baseTokens);

        uint256 totalTokens = baseTokens.add(bonusTokens);
        tokenOnSale.transfer(msg.sender, totalTokens);
    }

    /**
     * @dev Read the current size of the top ranks.
     * @return The current top ranks size.
     */
    function topRanksCount() external view returns (uint256) {
        return topRanks.sizeOf();
    }

    /**
     * @dev Compute the new staking points.
     * @param _user The user to compute staking points for.
     * @param _amount The added stake for the user.
     * @return The new staking points for user.
     */
    function computeStakingPoints(address _user, uint256 _amount)
        public
        view
        whenStakingOpen
        returns (uint256)
    {
        uint256 timeUntilEnd = endTime.sub(now);
        uint256 addedStakingPoints = timeUntilEnd.mul(_amount);

        return totalStakingPointsFor[_user].add(addedStakingPoints);
    }

    function _computeDiscountForRank(uint256 _rank)
        private
        view
        returns (uint256)
    {
        return maxDiscountPer1000.sub(_rank.mul(declinePerRankPer1000));
    }

    function _computeBaseTokens() private returns (uint256) {
        uint256 stakedStar = totalStakedFor[msg.sender];
        uint256 decimalCorrectionFactor =
            starEthRateInterface.decimalCorrectionFactor();
        uint256 starEthRate = starEthRateInterface.starEthRate();

        return stakedStar
            .mul(targetRateInEth)
            .mul(starEthRate)
            .div(decimalCorrectionFactor);
    }

    function _computeBonusTokens(uint256 _baseTokens)
        private
        view
        returns (uint256)
    {
        (uint256 rank, bool isInTopRanks) = getRankForUser(msg.sender);

        if (!isInTopRanks) return 0;

        uint256 discount = _computeDiscountForRank(rank);
        return _baseTokens.mul(discount).div(1000);
    }

    function _addStakingPoints(address _user, uint256 _amount) private {
        totalStakingPointsFor[_user] = computeStakingPoints(_user, _amount);
        totalStakedFor[_user] = totalStakedFor[_user].add(_amount);

        emit Staked(_user, _amount);
    }

    function _doesCorrectlyInsertAtFirstRank(
        uint256 _newRankPoints,
        uint256 _oneRankAbovePoints,
        address _twoRanksAbove
    ) private view returns (bool) {
        if (topRanks.sizeOf() == 0) {
            return true;
        }

        return _twoRanksAbove == HEAD && _newRankPoints > _oneRankAbovePoints;
    }

    function _ensureCorrectInsertPosition(
        uint256 _newRankPoints,
        uint256 _oneRankBelowPoints,
        uint256 _oneRankAbovePoints
    ) private pure {
        require(
            _newRankPoints > _oneRankBelowPoints,
            "Suggested position into top ranks too high!"
        );
        require(
            _newRankPoints <= _oneRankAbovePoints,
            "Suggested position into top ranks too low!"
        );
    }

    function _sortedInsert(address _user, address _oneRankAboveNode) private {
        topRanks.remove(_user);

        address twoRanksAbove = getTopRank(_oneRankAboveNode, PREV);
        address oneRankBelow = getTopRank(_oneRankAboveNode, NEXT);

        uint256 newRankPoints = totalStakingPointsFor[_user];
        uint256 oneRankBelowPoints = totalStakingPointsFor[oneRankBelow];
        uint256 oneRankAbovePoints = totalStakingPointsFor[_oneRankAboveNode];

        if (_doesCorrectlyInsertAtFirstRank(
            newRankPoints,
            oneRankAbovePoints,
            twoRanksAbove
        )) {
            topRanks.insert(HEAD, _user, NEXT);
        } else {
            _ensureCorrectInsertPosition(
                newRankPoints,
                oneRankBelowPoints,
                oneRankAbovePoints
            );

            topRanks.insert(_oneRankAboveNode, _user, NEXT);
        }

        if (topRanks.sizeOf() > topRanksMaxSize) {
            topRanks.pop(PREV);
        }
    }
}
