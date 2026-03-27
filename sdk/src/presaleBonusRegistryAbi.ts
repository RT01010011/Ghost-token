/**
 * ABI minimal pour `GhostPresaleBonusRegistry` — même surface que les fragments
 * utilisés dans `ghost-sdk-unified.js` et que le contrat Solidity.
 */
export const GHOST_PRESALE_BONUS_REGISTRY_ABI = [
    "function presale() view returns (address)",
    "function bonusBps() view returns (uint256)",
    "function registered(address) view returns (bool)",
    "function ghostPurchased(address) view returns (uint256)",
    "function credentialBindingConsumed(address) view returns (bool)",
    "function pseudo1HashBonusListed(bytes32) view returns (bool)",
    "function pseudo1BonusListLength() view returns (uint256)",
    "function pseudo1BonusListAt(uint256) view returns (string)",
    "function bonusGhostAmount(address) view returns (uint256)",
    "function credentialIdOf(address) view returns (bytes32)",
    "function recordEligibility(address buyer)",
    "function recordEligibilityWithPseudo(address buyer, string pseudo1)",
    "function consumeCredentialBinding()",
    "event EligibilityRecorded(address indexed buyer, uint256 ghostPurchasedWei, bytes32 indexed credentialId)",
    "event PresaleBonusPseudo1Listed(bytes32 indexed pseudo1Hash, string pseudo1)",
    "event CredentialBindingConsumed(address indexed buyer, bytes32 credentialId)",
] as const;
