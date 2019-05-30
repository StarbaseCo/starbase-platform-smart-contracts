pragma solidity 0.5.9;

interface StarEthRateInterface {
    function decimalCorrectionFactor() external returns (uint256);
    function starEthRate() external returns (uint256);
}
