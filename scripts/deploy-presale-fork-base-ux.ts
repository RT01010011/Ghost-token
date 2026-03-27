/**
 * Prévente de test sur nœud Hardhat **fork Base** — pour utiliser un **vrai compte Ghost**
 * déjà créé sur GhostProtocolV2 (même `pseudo1ToCommit` qu’en prod).
 *
 * L’UX / le Schnorr (`ghost-schnorr-libz.js`, comme `PresaleSdkCoherence.test.ts`) restent alignés ;
 * seul l’état du protocole est celui de Base au moment du fork.
 *
 * Terminal 1 (fork — remplace l’URL si besoin, ex. clé Alchemy) :
 *   npm run node:token:fork
 *   ou : npx hardhat node --config hardhat-ghost-token.config.ts --fork https://mainnet.base.org
 *
 * Terminal 2 :
 *   npm run deploy:presale:fork
 *
 * Variables optionnelles :
 *   GHOST_PROTOCOL_V2       — défaut : adresse V2 Base (voir index.html)
 *   LOCAL_PRESALE_START_OFFSET_SEC, GHOST_PER_ETH_GHOST, etc. (idem deploy-presale-local-ux)
 *
 * Sortie : deployed-addresses-fork-presale.json (gitignored)
 */
import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/** GhostProtocolV2 sur Base mainnet (config UX par défaut). */
const DEFAULT_GP_V2_BASE = "0x4ae6Aa27aB7c822970D2cb7575bF8e6F5cea00aB";

async function main() {
    const cid = (await ethers.provider.getNetwork()).chainId;
    const gpV2Raw = process.env.GHOST_PROTOCOL_V2?.trim() || DEFAULT_GP_V2_BASE;
    let gpV2: string;
    try {
        gpV2 = ethers.getAddress(gpV2Raw);
    } catch {
        throw new Error("GHOST_PROTOCOL_V2 invalide (attendu 0x + 40 hex).");
    }

    const [deployer] = await ethers.getSigners();
    const latest = await ethers.provider.getBlock("latest");
    const now = latest ? Number(latest.timestamp) : Math.floor(Date.now() / 1000);
    const startOffset = Number(process.env.LOCAL_PRESALE_START_OFFSET_SEC ?? "90");
    if (!Number.isFinite(startOffset) || startOffset < 5) {
        throw new Error("LOCAL_PRESALE_START_OFFSET_SEC doit être un nombre ≥ 5");
    }
    const start = now + startOffset;
    const end = start + 7 * 24 * 3600;

    const ghostPerEthStr = process.env.GHOST_PER_ETH_GHOST?.trim() || "212000";
    const GHOST_PER_ETH = ethers.parseUnits(ghostPerEthStr, 18);
    const SOFT_CAP = 0n;
    const HARD_CAP = ethers.parseEther(process.env.GHOST_PRESALE_HARD_CAP_ETH ?? "10000");
    const MAX_WALLET = ethers.parseEther(process.env.GHOST_PRESALE_MAX_ETH_PER_WALLET ?? "1");

    console.log("═══════════════════════════════════════════════════");
    console.log("  Prévente — fork Base + GhostProtocolV2 réel");
    console.log("═══════════════════════════════════════════════════");
    console.log("  Réseau      :", network.name, `(chainId ${cid})`);
    console.log("  Déployeur   :", deployer.address);
    console.log("  GhostV2     :", gpV2, "(pseudo1ToCommit = état Base forké)");
    console.log("  Ouverture   :", new Date(start * 1000).toISOString(), `(+${startOffset}s)`);
    console.log("  Fin         :", new Date(end * 1000).toISOString());
    console.log("═══════════════════════════════════════════════════\n");

    const code = await ethers.provider.getCode(gpV2);
    if (!code || code === "0x") {
        throw new Error(
            "Pas de bytecode à l’adresse GhostProtocolV2 — démarre le nœud avec fork Base : npm run node:token:fork"
        );
    }
    console.log("✓ Bytecode GhostProtocolV2 présent (fork actif)\n");

    const Token = await ethers.getContractFactory("GhostToken");
    const token = await Token.deploy();
    await token.waitForDeployment();
    const tokenAddr = await token.getAddress();
    console.log("✓ GhostToken     ", tokenAddr);

    const Presale = await ethers.getContractFactory("GhostPresale");
    const presale = await Presale.deploy(
        tokenAddr,
        deployer.address,
        deployer.address,
        gpV2,
        GHOST_PER_ETH,
        SOFT_CAP,
        HARD_CAP,
        MAX_WALLET,
        start,
        end
    );
    await presale.waitForDeployment();
    const presaleAddr = await presale.getAddress();
    console.log("✓ GhostPresale   ", presaleAddr);

    const saleAmount = await token.PRIVATE_SALE_ALLOC();
    await (await token.transfer(presaleAddr, saleAmount)).wait();
    console.log("✓ Transfert prévente :", ethers.formatEther(saleAmount), "GHOST\n");

    const outPath = path.join(__dirname, "..", "deployed-addresses-fork-presale.json");
    const doc = {
        mode: "fork-base",
        network: network.name,
        chainId: String(cid),
        rpcUrl: "http://127.0.0.1:8545",
        forkNote:
            "Les comptes Ghost sur Base existent ici : configure l’UX avec la même adresse GhostProtocolV2 que en prod.",
        ghostProtocolV2: gpV2,
        deployer: deployer.address,
        presaleStartUnix: start,
        presaleEndUnix: end,
        contracts: {
            GhostToken: tokenAddr,
            GhostPresale: presaleAddr,
        },
        ux: {
            ghostContractSameAsProduction: gpV2,
            localStorageRpc: "http://127.0.0.1:8545",
            ghost_allow_localhost: "1",
            ghost_presale_contract: presaleAddr,
        },
    };
    fs.writeFileSync(outPath, JSON.stringify(doc, null, 2));
    console.log("Adresses →", outPath);
    console.log("\n─── UX : compte Ghost **existant** (Base) ───");
    console.log("1) Nœud avec fork Base (sinon GhostV2 est vide).");
    console.log("2) localStorage.setItem('ghost_allow_localhost','1') puis recharger.");
    console.log("3) RPC http://127.0.0.1:8545 — Contrat Ghost (Connexion) :", gpV2);
    console.log("4) Prévente → GhostPresale :", presaleAddr);
    console.log("5) Connecte-toi avec ton pseudo / clés comme sur Base ; buyTokensGhost utilise les mêmes preuves Schnorr (lib JS = tests PresaleSdkCoherence).");
    console.log("6) ETH pour le gas : compte Hardhat #0 ou alimente l’adresse utilisée pour buy().\n");
}

main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
});
