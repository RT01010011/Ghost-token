// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IGhostProtocolV2ForWelcome {
    function pseudo1ToCommit(string calldata pseudo1) external view returns (bytes32);

    function getAccountInfo(string calldata pseudo1)
        external
        view
        returns (string memory name, uint256 createdAt, bool active);
}
