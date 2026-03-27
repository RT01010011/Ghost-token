/**
 * Fragments ABI pour `contracts/GhostProtocolV2.sol` — pas le JSON Hardhat complet.
 */
export const GHOST_PROTOCOL_V2_ABI = [
    "function createAccount(string pseudo1, bytes32 pseudo2Commit, bytes32 key1Commit, bytes32 key2Commit) external",
    "function pseudo1ToCommit(string pseudo1) external view returns (bytes32)",
    "function getAccountInfo(string pseudo1) external view returns (string name, uint256 createdAt, bool active)",
    "function accountExistsFor(string pseudo1) external view returns (bool)",
    "function VERSION() external view returns (uint256)",
    "function PROTOCOL_NAME() external view returns (string)",
    "function PROTOCOL_VERSION() external view returns (string)",
    "event AccountCreated(string indexed pseudo1, uint256 timestamp)",
    "event AccountDeactivated(string indexed pseudo1, uint256 timestamp)",
] as const;
