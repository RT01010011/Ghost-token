// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "../IGhostProtocolV2ForPresale.sol";

contract MockGhostProtocolV2ForPresale is IGhostProtocolV2ForPresale {
    mapping(bytes32 => bytes32) private _commitByPseudoHash;
    mapping(bytes32 => uint256) private _accountCreatedAt;

    function register(
        string calldata pseudo1,
        bytes32 pseudo2Commit,
        bytes32 key1Commit,
        bytes32 key2Commit
    ) external {
        bytes32 h = keccak256(bytes(pseudo1));
        _commitByPseudoHash[h] = keccak256(abi.encodePacked(pseudo2Commit, key1Commit, key2Commit));
        if (_accountCreatedAt[h] == 0) {
            _accountCreatedAt[h] = block.timestamp;
        }
    }

    function pseudo1ToCommit(string calldata pseudo1) external view returns (bytes32) {
        return _commitByPseudoHash[keccak256(bytes(pseudo1))];
    }

    function getAccountInfo(string calldata pseudo1)
        external
        view
        returns (string memory name, uint256 createdAt, bool active)
    {
        bytes32 h = keccak256(bytes(pseudo1));
        if (_commitByPseudoHash[h] == bytes32(0)) {
            return ("", 0, false);
        }
        return (pseudo1, _accountCreatedAt[h], true);
    }
}
