pragma solidity 0.4.25;

import "./lib/Ownable.sol";
import "./lib/SafeMath.sol";
import "./lib/ERC20.sol";
import "./lib/Lockable.sol";
import "./LinkedListLib.sol";
import "./StarEthRateInterface.sol";
import "./StarStakingInterface.sol";

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
        uint256 newStakingPoints = _computeStakingPoints(user, _addedStake);

        return getSortedSpot(newStakingPoints);
    }

    /**
     * @dev Can be used before `stakeFor` to get the correct reference node
     * @param _stakingPoints new points for user to insert
     * @return reference node for insertion in top ranks
     */
    function getSortedSpot(uint256 _stakingPoints)
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
        ) {
            node = getTopRank(node, PREV);
        }

        if (node == HEAD) {
            return getTopRank(HEAD, NEXT);
        }

        return node;
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
     * @dev Withdraw all received tokens after staking is finished.
     * @return The current top ranks size.
     */
    function topRanksCount() external view returns (uint256) {
        return topRanks.sizeOf();
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
        address referenceNode = HEAD;

        for (uint256 i = 0; i < topRanks.sizeOf(); i++) {
            referenceNode = getTopRank(referenceNode, NEXT);
            
            if (referenceNode == msg.sender) {
                uint256 discount = maxDiscountPer1000.sub(
                    i.mul(declinePerRankPer1000)
                );
                return _baseTokens.mul(discount).div(1000);
            }
        }

        return 0;
    }

    function _computeStakingPoints(address _user, uint256 _amount)
        private
        view
        returns (uint256)
    {
        uint256 timeUntilEnd = endTime.sub(now);
        uint256 addedStakingPoints = timeUntilEnd.mul(_amount);

        return totalStakingPointsFor[_user].add(addedStakingPoints);
    }

    function _addStakingPoints(address _user, uint256 _amount) private {
        totalStakingPointsFor[_user] = _computeStakingPoints(_user, _amount);
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