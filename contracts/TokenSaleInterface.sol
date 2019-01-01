pragma solidity 0.4.25;

/**
 * @title TokenSale contract interface
 */
interface TokenSaleInterface {
    function init
    (
        uint256 _startTime,
        uint256 _endTime,
        address _whitelist,
        address _starToken,
        address _companyToken,
        address _tokenOwnerAfterSale,
        uint256 _rate,
        uint256 _starRate,
        address _wallet,
        uint256 _softCap,
        uint256 _crowdsaleCap,
        bool    _isWeiAccepted,
        bool    _isMinting
    )
    external;
}
