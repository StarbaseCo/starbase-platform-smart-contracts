pragma solidity 0.4.25;


contract StarStakingInterface {
    function totalStaked(address _participant) public view returns (uint256);
    event Staked(address indexed user, uint256 amount, uint256 addedStakingPoints);
}
