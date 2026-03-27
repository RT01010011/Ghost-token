import { ethers } from "ethers";

export type PresaleBonusCredentialParams = {
    buyer: string;
    ghostPurchasedWei: bigint;
    presaleAddress: string;
    chainId: bigint;
    credentialDomainSeparator: string;
};

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
