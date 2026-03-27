import { Contract, Interface, keccak256, Provider, toUtf8Bytes, ZeroAddress, ZeroHash } from "ethers";
import { GHOST_PRESALE_WELCOME_REGISTRY_ABI } from "./welcomeRegistryAbi";
import { GHOST_PROTOCOL_V2_ABI } from "./ghostProtocolV2Abi";
import { GhostProtocolV2Client } from "./protocolClient";

const v2Iface = new Interface([...GHOST_PROTOCOL_V2_ABI]);

export function welcomeRegistryPseudo1Hash(pseudo1: string): string {
    return keccak256(toUtf8Bytes(pseudo1));
}

export function extractPseudo1FromCreateAccountCalldata(data: string): string | null {
    const parsed = GhostProtocolV2Client.decodeCreateAccountCalldata(data);
    return parsed?.pseudo1 ?? null;
}

export async function readV2Pseudo1Commit(provider: Provider, ghostV2Address: string, pseudo1: string): Promise<string> {
    const c = new GhostProtocolV2Client(ghostV2Address, provider);
    return c.pseudo1ToCommit(pseudo1);
}

export async function v2AccountExistsForPseudo1(
    provider: Provider,
    ghostV2Address: string,
    pseudo1: string
): Promise<boolean> {
    const commit = await readV2Pseudo1Commit(provider, ghostV2Address, pseudo1);
    return commit !== ZeroHash && commit.length === 66;
}

export async function readV2AccountCreatedAt(
    provider: Provider,
    ghostV2Address: string,
    pseudo1: string
): Promise<bigint | null> {
    try {
        const c = new Contract(ghostV2Address, v2Iface, provider);
        const r = await c.getAccountInfo(pseudo1);
        const createdAt = r.createdAt ?? r[1];
        const active = r.active ?? r[2];
        if (!active && createdAt === 0n) {
            return null;
        }
        return BigInt(createdAt.toString());
    } catch {
        return null;
    }
}

export type WelcomeRegistryEntry = {
    payout: string;
    claimed: boolean;
};

export class GhostPresaleWelcomeRegistryReader {
    readonly address: string;
    private readonly _contract: Contract;

    constructor(registryAddress: string, provider: Provider) {
        this.address = registryAddress;
        this._contract = new Contract(registryAddress, [...GHOST_PRESALE_WELCOME_REGISTRY_ABI], provider);
    }

    async getEntryByPseudo1(pseudo1: string): Promise<WelcomeRegistryEntry | null> {
        const h = welcomeRegistryPseudo1Hash(pseudo1);
        const [payout, claimed]: [string, boolean] = await this._contract.entries(h);
        if (!payout || payout.toLowerCase() === ZeroAddress.toLowerCase()) {
            return null;
        }
        return { payout, claimed };
    }

    async recordedCount(): Promise<bigint> {
        return this._contract.recordedCount();
    }

    async welcomeAmountWei(): Promise<bigint> {
        return this._contract.welcomeAmountWei();
    }

    async claimOpensAt(): Promise<bigint> {
        return this._contract.claimOpensAt();
    }

    async presaleAddress(): Promise<string> {
        return this._contract.presale();
    }

    async ghostV2Address(): Promise<string> {
        return this._contract.ghostV2();
    }
}
