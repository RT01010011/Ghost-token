import { ethers } from "hardhat";

export type PresaleBonusCredentialParams = {
    buyer: string;
    ghostPurchasedWei: bigint;
    presaleAddress: string;
    chainId: bigint;
    credentialDomainSeparator: string;
};

/** Aligné sur `GhostPresaleBonusRegistry` et l’ancien import `@ghost-protocol/sdk` (dépôt Ghost Protocol V2). */
export function computePresaleBonusCredentialId(p: PresaleBonusCredentialParams): string {
    const packed = ethers.solidityPacked(
        ["address", "uint256", "address", "uint256", "bytes32"],
        [p.buyer, p.ghostPurchasedWei, p.presaleAddress, p.chainId, p.credentialDomainSeparator]
    );
    return ethers.keccak256(packed);
}

export const DEFAULT_BONUS_CREDENTIAL_DOMAIN = ethers.keccak256(
    ethers.toUtf8Bytes("GhostPresaleBonusRegistry.v1")
);
