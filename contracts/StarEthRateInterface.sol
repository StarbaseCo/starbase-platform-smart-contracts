pragma solidity 0.5.8;

contract StarEthRateInterface {
    function decimalCorrectionFactor() public returns (uint256);
    function starEthRate() public returns (uint256);
}
