// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "../IGhostProtocolV2ForPresale.sol";

contract MockGhostProtocolV2ForPresale is IGhostProtocolV2ForPresale {
    mapping(bytes32 => bytes32) private _commitByPseudoHash;

    function register(
        string calldata pseudo1,
        bytes32 pseudo2Commit,
        bytes32 key1Commit,
        bytes32 key2Commit
    ) external {
        bytes32 h = keccak256(bytes(pseudo1));
        _commitByPseudoHash[h] = keccak256(abi.encodePacked(pseudo2Commit, key1Commit, key2Commit));
    }

    function pseudo1ToCommit(string calldata pseudo1) external view returns (bytes32) {
        return _commitByPseudoHash[keccak256(bytes(pseudo1))];
    }
}
