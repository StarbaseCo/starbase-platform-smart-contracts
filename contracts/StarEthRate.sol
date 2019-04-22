pragma solidity 0.4.25;

import "./lib/Ownable.sol";

contract StarEthRate is Ownable {
    uint256 public decimalCorrectionFactor;
    uint256 public starEthRate;

    event decimalCorrectionFactorSet(uint256 decimalCorrectionFactor);
    event StarEthRateSet(uint256 starEthRate);

    constructor(
        uint256 _decimalCorrectionFactor,
        uint256 _initialStarEthRate
    ) public {
        require(
            _decimalCorrectionFactor > 0,
            'Please pass a decimalCorrectionFactor above 0!'
        );
        require(_initialStarEthRate > 0, 'Please pass a starEthRate above 0!');

        decimalCorrectionFactor = _decimalCorrectionFactor;
        starEthRate = _initialStarEthRate;
    }

    function setDecimalCorrectionFactor(
        uint256 _newDecimalCorrectionFactor
    ) public onlyOwner {
        require(
            _newDecimalCorrectionFactor > 0,
            'Please pass a decimalCorrectionFactor above 0!'
        );

        decimalCorrectionFactor = _newDecimalCorrectionFactor;
        emit decimalCorrectionFactorSet(_newDecimalCorrectionFactor);
    }

    function setStarEthRate(uint256 _newStarEthRate) public onlyOwner {
        require(_newStarEthRate > 0, 'Please pass a starEthRate above 0!');

        starEthRate = _newStarEthRate;
        emit StarEthRateSet(_newStarEthRate);
    }

    function setStarEthRateAndDecimalCorrectionFactor(
        uint256 _newDecimalCorrectionFactor,
        uint256 _newStarEthRate
    ) public onlyOwner {
        setDecimalCorrectionFactor(_newDecimalCorrectionFactor);
        setStarEthRate(_newStarEthRate);
    }
}
