/**
 * Déploiement **Base Sepolia** — prévente + jeton pour test E2E « comme en prod »
 * (achat via UX, finalize admin, claim utilisateur).
 *
 * Commande :
 *   npm run deploy:presale:e2e:sepolia
 *
 * .env :
 *   PRIVATE_KEY, BASE_SEPOLIA_RPC_URL
 *
 * Optionnel :
 *   GHOST_PROTOCOL_V2           — si défini (0x…40), utilisé à la place d’un mock (compte Ghost réel sur Sepolia).
 *   GHOST_PRESALE_ADMIN         — admin prévente (défaut : déployeur)
 *   GHOST_E2E_ETH_RECEIVER      — reçoit les ETH au finalize() (défaut : déployeur) — pratique pour récupérer l’ETH de test
 *   E2E_PRESALE_START_OFFSET_SEC — secondes avant ouverture (défaut 180)
 *   E2E_PRESALE_DURATION_SEC    — durée fenêtre (défaut 604800 = 7 j)
 *   GHOST_PER_ETH_GHOST, GHOST_PRESALE_HARD_CAP_ETH, GHOST_PRESALE_MAX_ETH_PER_WALLET
 *
 * Sortie : deployed-addresses-presale-e2e-testnet.json (gitignored)
 */
import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
    if (network.name !== "baseSepolia") {
        throw new Error(
            'Utilise --network baseSepolia (ex. npm run deploy:presale:e2e:sepolia). Pas de déploiement "réel" de test sur d’autres réseaux via ce script.'
        );
    }

    const [deployer] = await ethers.getSigners();
    const latest = await ethers.provider.getBlock("latest");
    const now = latest ? Number(latest.timestamp) : Math.floor(Date.now() / 1000);

    const startOffset = Number(process.env.E2E_PRESALE_START_OFFSET_SEC ?? "180");
    const durationSec = Number(process.env.E2E_PRESALE_DURATION_SEC ?? String(7 * 24 * 3600));
    if (!Number.isFinite(startOffset) || startOffset < 60) {
        throw new Error("E2E_PRESALE_START_OFFSET_SEC doit être ≥ 60 (temps de configurer l’UX).");
    }
    if (!Number.isFinite(durationSec) || durationSec < 3600) {
        throw new Error("E2E_PRESALE_DURATION_SEC doit être ≥ 3600 (1 h minimum).");
    }

    const start = now + startOffset;
    const end = start + durationSec;

    const ghostPerEthStr = process.env.GHOST_PER_ETH_GHOST?.trim() || "212000";
    const GHOST_PER_ETH = ethers.parseUnits(ghostPerEthStr, 18);
    const SOFT_CAP = 0n;
    const HARD_CAP = ethers.parseEther(process.env.GHOST_PRESALE_HARD_CAP_ETH ?? "100");
    const MAX_WALLET = ethers.parseEther(process.env.GHOST_PRESALE_MAX_ETH_PER_WALLET ?? "1");

    const adminRaw = process.env.GHOST_PRESALE_ADMIN?.trim();
    const admin =
        adminRaw && ethers.isAddress(adminRaw) ? ethers.getAddress(adminRaw) : deployer.address;

    const recvRaw = process.env.GHOST_E2E_ETH_RECEIVER?.trim();
    const ethRecv =
        recvRaw && ethers.isAddress(recvRaw) ? ethers.getAddress(recvRaw) : deployer.address;

    let gpAddr: string;
    let gpKind: "mock" | "env";
    const envGp = process.env.GHOST_PROTOCOL_V2?.trim();
    if (envGp && ethers.isAddress(envGp)) {
        gpAddr = ethers.getAddress(envGp);
        const code = await ethers.provider.getCode(gpAddr);
        if (!code || code === "0x") {
            throw new Error(`GHOST_PROTOCOL_V2=${gpAddr} : pas de bytecode sur Base Sepolia.`);
        }
        gpKind = "env";
        console.log("✓ GhostProtocolV2 (env) ", gpAddr);
    } else {
        const Mock = await ethers.getContractFactory("MockGhostProtocolV2ForPresale");
        const mock = await Mock.deploy();
        await mock.waitForDeployment();
        gpAddr = await mock.getAddress();
        gpKind = "mock";
        console.log("✓ MockGhostProtocolV2ForPresale", gpAddr);
    }

    const Token = await ethers.getContractFactory("GhostToken");
    const token = await Token.deploy();
    await token.waitForDeployment();
    const tokenAddr = await token.getAddress();
    console.log("✓ GhostToken              ", tokenAddr);

    const Presale = await ethers.getContractFactory("GhostPresale");
    const presale = await Presale.deploy(
        tokenAddr,
        admin,
        ethRecv,
        gpAddr,
        GHOST_PER_ETH,
        SOFT_CAP,
        HARD_CAP,
        MAX_WALLET,
        start,
        end
    );
    await presale.waitForDeployment();
    const presaleAddr = await presale.getAddress();
    console.log("✓ GhostPresale            ", presaleAddr);
    console.log("  Admin prévente          ", admin);
    console.log("  ETH après finalize() →  ", ethRecv);

    const saleAmount = await token.PRIVATE_SALE_ALLOC();
    await (await token.transfer(presaleAddr, saleAmount)).wait();
    console.log("✓ Transfert stock prévente", ethers.formatEther(saleAmount), "GHOST\n");

    const outPath = path.join(__dirname, "..", "deployed-addresses-presale-e2e-testnet.json");
    const doc = {
        network: "baseSepolia",
        chainId: "84532",
        rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
        blockExplorer: "https://sepolia.basescan.org",
        deployer: deployer.address,
        presaleStartUnix: start,
        presaleEndUnix: end,
        presaleStartIso: new Date(start * 1000).toISOString(),
        presaleEndIso: new Date(end * 1000).toISOString(),
        ghostProtocolKind: gpKind,
        contracts: {
            GhostToken: tokenAddr,
            GhostPresale: presaleAddr,
            ...(gpKind === "mock" ? { MockGhostProtocolV2ForPresale: gpAddr } : { GhostProtocolV2: gpAddr }),
        },
        ux: {
            rpcForIndexHtml: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
            ghostPresaleAddress: presaleAddr,
            ghostTokenAddress: tokenAddr,
            ghostProtocolV2ImmutableOnPresale: gpAddr,
            metaMaskChainId: 84532,
            noteGhostConnexion:
                gpKind === "mock"
                    ? "Le mock sert uniquement à GhostPresale (pseudo1ToCommit). L’UX « Connexion » exige le contrat GhostProtocolV2 complet : pour tester buyTokensGhost comme en prod, déploie V2 sur Sepolia (scripts/deploy.ts + hardhat.config) puis redéploie la prévente avec GHOST_PROTOCOL_V2=... — voir docs/PRESALE-E2E-TESTNET.md"
                    : "Connexion + Prévente : utilise cette même adresse GHOST_PROTOCOL_V2 dans l’UX (Base Sepolia).",
        },
    };
    fs.writeFileSync(outPath, JSON.stringify(doc, null, 2));
    console.log("Fichier adresses →", outPath);
    console.log("\n═══ Prochaines étapes (E2E) ═══");
    console.log("1) MetaMask : réseau Base Sepolia (chain 84532), RPC", doc.ux.rpcForIndexHtml);
    console.log("2) index.html — RPC identique ; Prévente :", presaleAddr);
    console.log("3) Après", startOffset, "s : achat test (wallet externe ou Compte connecté).");
    console.log("4) Admin (", admin, ") : finalize() après endTime (ou hard cap si tu le touches).");
    console.log("5) Acheteur : claim() ou claimGhost() selon le flux.");
    console.log("6) Lire la checklist : docs/PRESALE-E2E-TESTNET.md\n");
}

main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
});
