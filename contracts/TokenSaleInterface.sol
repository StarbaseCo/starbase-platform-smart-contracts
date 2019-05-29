pragma solidity 0.5.9;

/**
 * @title TokenSale contract interface
 */
interface TokenSaleInterface {
    function init
    (
        uint256 _startTime,
        uint256 _endTime,
        address[6] calldata _externalAddresses,
        uint256 _softCap,
        uint256 _crowdsaleCap,
        bool    _isWeiAccepted,
        bool    _isMinting,
        uint256[] calldata _targetRates,
        uint256[] calldata _targetRatesTimestamps
    )
    external;
}
