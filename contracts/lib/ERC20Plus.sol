pragma solidity 0.5.8;

/**
 * @title ERC20 interface with additional functions
 * @dev it has added functions that deals to minting, pausing token and token information
 */
contract ERC20Plus {
    function allowance(address owner, address spender) public view returns (uint256);
    function transferFrom(address from, address to, uint256 value) public returns (bool);
    function approve(address spender, uint256 value) public returns (bool);
    function totalSupply() public view returns (uint256);
    function balanceOf(address who) public view returns (uint256);
    function transfer(address to, uint256 value) public returns (bool);

    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Transfer(address indexed from, address indexed to, uint256 value);

    // additonal functions
    function mint(address _to, uint256 _amount) public returns (bool);
    function owner() public view returns (address);
    function transferOwnership(address newOwner) public;
    function name() public view returns (string memory);
    function symbol() public view returns (string memory);
    function decimals() public view returns (uint8);
    function paused() public view returns (bool);
}
