pragma solidity 0.5.8;

import "./Ownable.sol";

contract Lockable is Ownable {

    bool public locked;

    modifier onlyWhenUnlocked() {
        require(!locked);
        _;
    }

    function lock() external onlyOwner {
        locked = true;
    }

    function unlock() external onlyOwner {
        locked = false;
    }
}
