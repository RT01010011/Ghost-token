/**
 * Enregistre un pseudo sur MockGhostProtocolV2ForPresale (Base Sepolia) pour pouvoir appeler buyTokensGhost.
 * Utilise la même dérivation que les tests / ghost-schnorr-libz.js.
 *
 * .env : PRIVATE_KEY, BASE_SEPOLIA_RPC_URL
 * Variables obligatoires :
 *   E2E_MOCK_GP_ADDRESS — adresse du mock (fichier deployed-addresses-presale-e2e-testnet.json)
 *   E2E_REGISTER_PSEUDO1
 *   E2E_REGISTER_P2_SECRET, E2E_REGISTER_K1_SECRET, E2E_REGISTER_K2_SECRET — chaînes (même rôle que prepareCreateAccount)
 *
 *   npm run register:mock-presale:sepolia
 */
import { ethers, network } from "hardhat";
import * as path from "path";

async function main() {
    if (network.name !== "baseSepolia") {
        throw new Error("Utilise --network baseSepolia.");
    }

    const mockAddr = process.env.E2E_MOCK_GP_ADDRESS?.trim();
    if (!mockAddr || !ethers.isAddress(mockAddr)) {
        throw new Error("Définis E2E_MOCK_GP_ADDRESS=0x… (Mock du JSON deploy presale e2e).");
    }

    const pseudo1 = process.env.E2E_REGISTER_PSEUDO1?.trim();
    const p2 = process.env.E2E_REGISTER_P2_SECRET?.trim();
    const k1 = process.env.E2E_REGISTER_K1_SECRET?.trim();
    const k2 = process.env.E2E_REGISTER_K2_SECRET?.trim();
    if (!pseudo1 || !p2 || !k1 || !k2) {
        throw new Error(
            "Définis E2E_REGISTER_PSEUDO1, E2E_REGISTER_P2_SECRET, E2E_REGISTER_K1_SECRET, E2E_REGISTER_K2_SECRET"
        );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).ethers = ethers;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const GhostSchnorr = require(path.join(__dirname, "..", "ghost-schnorr-libz.js"));

    const acc = GhostSchnorr.prepareCreateAccount(pseudo1, p2, k1, k2);
    const [signer] = await ethers.getSigners();

    const mock = await ethers.getContractAt(
        "MockGhostProtocolV2ForPresale",
        ethers.getAddress(mockAddr),
        signer
    );

    const tx = await mock.register(pseudo1, acc.pseudo2Commit, acc.key1Commit, acc.key2Commit);
    await tx.wait();

    const onChain = await mock.pseudo1ToCommit(pseudo1);
    const expected = ethers.solidityPackedKeccak256(
        ["bytes32", "bytes32", "bytes32"],
        [acc.pseudo2Commit, acc.key1Commit, acc.key2Commit]
    );
    if (onChain.toLowerCase() !== expected.toLowerCase()) {
        throw new Error("Incohérence commitment après register.");
    }

    console.log("✓ register OK pour pseudo1 =", JSON.stringify(pseudo1));
    console.log("  Mock :", ethers.getAddress(mockAddr));
    console.log("  Utilise les mêmes secrets dans l’UX (Connexion) pour buyTokensGhost.");
}

main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
});
