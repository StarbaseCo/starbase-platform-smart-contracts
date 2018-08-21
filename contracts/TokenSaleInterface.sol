pragma solidity 0.4.24;


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
        uint256 _rate,
        uint256 _starRate,
        address _wallet,
        uint256 _crowdsaleCap
    )
    external;
}
