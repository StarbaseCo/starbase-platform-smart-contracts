pragma solidity 0.4.25;

/**
 * @title TokenSale contract interface
 */
interface TokenSaleInterface {
    function init
    (
        uint256 _startTime,
        uint256 _endTime,
        address[6] _externalAddresses,
        uint256 _softCap,
        uint256 _crowdsaleCap,
        bool    _isWeiAccepted,
        bool    _isMinting,
        uint256[] _targetRates,
        uint256[] _targetRatesTimestamps
    )
    external;
}
