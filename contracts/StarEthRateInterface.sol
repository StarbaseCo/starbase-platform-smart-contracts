pragma solidity 0.4.25;

contract StarEthRateInterface {
    function decimalCorrectionFactor() public returns (uint256);
    function starEthRate() public returns (uint256);
}
