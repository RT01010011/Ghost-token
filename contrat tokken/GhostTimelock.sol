// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract GhostTimelock {

    using SafeERC20 for IERC20;

    IERC20  public immutable token;
    address public immutable beneficiary;
    uint256 public immutable releaseTime;

    event Released(address indexed to, uint256 amount);

    constructor(address _token, address _beneficiary, uint256 _releaseTime) {
        require(_token       != address(0), "GhostTimelock: token zero");
        require(_beneficiary != address(0), "GhostTimelock: beneficiary zero");
        require(_releaseTime > block.timestamp, "GhostTimelock: date dans le passe");

        token       = IERC20(_token);
        beneficiary = _beneficiary;
        releaseTime = _releaseTime;
    }

    function release() external {
        require(msg.sender == beneficiary,        "GhostTimelock: pas le beneficiaire");
        require(block.timestamp >= releaseTime,   "GhostTimelock: tokens encore verrouilles");

        uint256 amount = token.balanceOf(address(this));
        require(amount > 0, "GhostTimelock: solde zero");

        emit Released(beneficiary, amount);
        token.safeTransfer(beneficiary, amount);
    }

    function status() external view returns (
        uint256 lockedAmount,
        uint256 unlockTimestamp,
        bool    isUnlocked,
        uint256 secondsRemaining
    ) {
        lockedAmount     = token.balanceOf(address(this));
        unlockTimestamp  = releaseTime;
        isUnlocked       = block.timestamp >= releaseTime;
        secondsRemaining = isUnlocked ? 0 : releaseTime - block.timestamp;
    }
}
