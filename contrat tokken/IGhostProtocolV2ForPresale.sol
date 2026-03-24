// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IGhostProtocolV2ForPresale {
    function pseudo1ToCommit(string calldata pseudo1) external view returns (bytes32);
}
