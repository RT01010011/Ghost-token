// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract GhostVesting {

    using SafeERC20 for IERC20;

    IERC20  public immutable token;
    address public immutable beneficiary;
    uint256 public immutable start;
    uint256 public immutable cliff;
    uint256 public immutable duration;
    uint256 public immutable totalAmount;

    uint256 public released;

    event Released(address indexed to, uint256 amount);

    constructor(
        address _token,
        address _beneficiary,
        uint256 _start,
        uint256 _cliffDuration,
        uint256 _vestingDuration,
        uint256 _totalAmount
    ) {
        require(_token       != address(0), "GhostVesting: token zero");
        require(_beneficiary != address(0), "GhostVesting: beneficiary zero");
        require(_vestingDuration > 0,       "GhostVesting: duree zero");
        require(_cliffDuration <= _vestingDuration, "GhostVesting: cliff > duree");
        require(_totalAmount > 0,           "GhostVesting: montant zero");

        token       = IERC20(_token);
        beneficiary = _beneficiary;
        start       = _start;
        cliff       = _start + _cliffDuration;
        duration    = _vestingDuration;
        totalAmount = _totalAmount;
    }

    function release() external {
        uint256 amount = releasable();
        require(amount > 0, "GhostVesting: rien a liberer");

        released += amount;

        emit Released(beneficiary, amount);
        token.safeTransfer(beneficiary, amount);
    }

    function releasable() public view returns (uint256) {
        return vestedAmount(block.timestamp) - released;
    }

    function vestedAmount(uint256 timestamp) public view returns (uint256) {
        if (timestamp < cliff) {
            return 0;
        }
        if (timestamp >= start + duration) {
            return totalAmount;
        }
        return (totalAmount * (timestamp - start)) / duration;
    }

    function status() external view returns (
        uint256 _released,
        uint256 _releasable,
        uint256 _locked,
        bool    _cliffPassed
    ) {
        _released    = released;
        _releasable  = releasable();
        _locked      = totalAmount - released - _releasable;
        _cliffPassed = block.timestamp >= cliff;
    }
}
