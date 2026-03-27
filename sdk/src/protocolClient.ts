import { Contract, ContractRunner, Interface, Provider, TransactionReceipt, TransactionResponse } from "ethers";
import { GHOST_PROTOCOL_V2_ABI } from "./ghostProtocolV2Abi";

const iface = new Interface([...GHOST_PROTOCOL_V2_ABI]);

export type CreateAccountParams = {
    pseudo1: string;
    /** bytes32 hex string 0x… */
    pseudo2Commit: string;
    key1Commit: string;
    key2Commit: string;
};

/**
 * Client lecture / encodage autour de GhostProtocolV2.
 */
export class GhostProtocolV2Client {
    readonly address: string;
    readonly contract: Contract;

    constructor(protocolAddress: string, runner: ContractRunner) {
        this.address = protocolAddress;
        this.contract = new Contract(protocolAddress, GHOST_PROTOCOL_V2_ABI, runner);
    }

    async pseudo1ToCommit(pseudo1: string): Promise<string> {
        return this.contract.pseudo1ToCommit(pseudo1);
    }

    async getAccountInfo(pseudo1: string): Promise<{ name: string; createdAt: bigint; active: boolean }> {
        const r = await this.contract.getAccountInfo(pseudo1);
        return {
            name: r.name as string,
            createdAt: r.createdAt as bigint,
            active: r.active as boolean,
        };
    }

    async version(): Promise<bigint> {
        return this.contract.VERSION();
    }

    /** Données calldata pour `createAccount` (soumission depuis un wallet) */
    encodeCreateAccount(p: CreateAccountParams): string {
        return iface.encodeFunctionData("createAccount", [
            p.pseudo1,
            p.pseudo2Commit,
            p.key1Commit,
            p.key2Commit,
        ]);
    }

    /**
     * Décode un `createAccount` depuis les data de transaction (utile pour indexer les pseudo1).
     */
    static decodeCreateAccountCalldata(data: string): CreateAccountParams | null {
        try {
            const tx = iface.parseTransaction({ data });
            if (!tx || tx.name !== "createAccount") return null;
            return {
                pseudo1: tx.args[0] as string,
                pseudo2Commit: tx.args[1] as string,
                key1Commit: tx.args[2] as string,
                key2Commit: tx.args[3] as string,
            };
        } catch {
            return null;
        }
    }

}

/**
 * Décode `createAccount` depuis la transaction complète (meilleur pour récupérer `pseudo1`).
 */
export function decodeCreateAccountFromTx(tx: TransactionResponse): CreateAccountParams | null {
    if (!tx.data) return null;
    return GhostProtocolV2Client.decodeCreateAccountCalldata(tx.data);
}

/**
 * Récupère le `pseudo1` depuis un reçu de création de compte (parse `tx.data` — fiable).
 * L’event `AccountCreated` avec `string indexed` ne permet pas de relire le pseudo depuis les seuls topics.
 */
export async function decodeCreateAccountFromReceipt(
    receipt: TransactionReceipt,
    provider: Provider
): Promise<CreateAccountParams | null> {
    const tx = await provider.getTransaction(receipt.hash);
    if (!tx?.data) return null;
    return GhostProtocolV2Client.decodeCreateAccountCalldata(tx.data);
}
