pragma solidity 0.4.24;


contract StarStakingInterface {
    event Staked(address indexed user, uint256 amount, uint256 addedStakingPoints);

    function token() public view returns (address);
    function supportsHistory() public pure returns (bool);
}
