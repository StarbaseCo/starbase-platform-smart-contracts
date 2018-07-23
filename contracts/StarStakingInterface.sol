pragma solidity 0.4.23;


contract StarStakingInterface {
    event Staked(address indexed user, uint256 amount, uint256 total);
    event Unstaked(address indexed user, uint256 amount, uint256 total);

    function stake(uint256 amount) public;
    function stakeFor(address user, uint256 amount) public;
    function totalStakedFor(address addr) public view returns (uint256);
    function totalStaked() public view returns (uint256);
    function token() public view returns (address);
    function supportsHistory() public pure returns (bool);

    // optional
    function lastStakedFor(address addr) public view returns (uint256);
    function totalStakedForAt(address addr, uint256 blockNumber) public view returns (uint256);
    function totalStakedAt(uint256 blockNumber) public view returns (uint256);
}
