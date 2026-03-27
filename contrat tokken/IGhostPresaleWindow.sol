// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IGhostPresaleWindow {
    function startTime() external view returns (uint256);
    function endTime() external view returns (uint256);
}
