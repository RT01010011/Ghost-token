/**
 * Déploiement minimal pour tester la prévente + l’UX (index.html) sur un nœud Hardhat **sans fork**.
 *
 * Limite : aucun compte Ghost « réel » (Base) n’existe ici — uniquement un **mock** + `register` manuel.
 * Pour tester avec **ton compte déjà créé sur Base**, utilise le fork : `npm run node:token:fork` puis `npm run deploy:presale:fork` (voir deploy-presale-fork-base-ux.ts).
 *
 * Prérequis — terminal 1 :
 *   npm run node:token
 *
 * Terminal 2 :
 *   npm run deploy:presale:local
 *
 * Variables optionnelles :
 *   LOCAL_PRESALE_START_OFFSET_SEC  — secondes avant ouverture (défaut 90)
 *   GHOST_PER_ETH_GHOST             — défaut 212000
 *   GHOST_PRESALE_MAX_ETH_PER_WALLET — défaut 1
 *   GHOST_PRESALE_HARD_CAP_ETH      — défaut 10000
 *
 * Sortie : deployed-addresses-local-presale.json (gitignored)
 */
import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
    const cid = (await ethers.provider.getNetwork()).chainId;
    if (cid !== 31337n) {
        console.warn(
            "⚠️  chainId !== 31337 : ce script est prévu pour `npm run node:token` + --network localhost.\n"
        );
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
    console.log("  Prévente locale — GhostToken + Mock GP + GhostPresale");
    console.log("═══════════════════════════════════════════════════");
    console.log("  Réseau      :", network.name, `(chainId ${cid})`);
    console.log("  Déployeur   :", deployer.address);
    console.log("  Ouverture   :", new Date(start * 1000).toISOString(), `(+${startOffset}s)`);
    console.log("  Fin         :", new Date(end * 1000).toISOString());
    console.log("═══════════════════════════════════════════════════\n");

    const Token = await ethers.getContractFactory("GhostToken");
    const token = await Token.deploy();
    await token.waitForDeployment();
    const tokenAddr = await token.getAddress();
    console.log("✓ GhostToken     ", tokenAddr);

    const Mock = await ethers.getContractFactory("MockGhostProtocolV2ForPresale");
    const mockGp = await Mock.deploy();
    await mockGp.waitForDeployment();
    const mockAddr = await mockGp.getAddress();
    console.log("✓ MockGhostProto ", mockAddr, "(enregistre les comptes avec .register pour buyTokensGhost)");

    const Presale = await ethers.getContractFactory("GhostPresale");
    const presale = await Presale.deploy(
        tokenAddr,
        deployer.address,
        deployer.address,
        mockAddr,
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

    const outPath = path.join(__dirname, "..", "deployed-addresses-local-presale.json");
    const doc = {
        network: network.name,
        chainId: String(cid),
        rpcUrl: "http://127.0.0.1:8545",
        deployer: deployer.address,
        presaleStartUnix: start,
        presaleEndUnix: end,
        contracts: {
            GhostToken: tokenAddr,
            MockGhostProtocolV2ForPresale: mockAddr,
            GhostPresale: presaleAddr,
        },
        ux: {
            localStorageRpc: "http://127.0.0.1:8545",
            localStoragePresaleKey: "ghost_presale_contract",
            allowLocalhostKey: "ghost_allow_localhost",
            allowLocalhostValue: "1",
            note: "Dans la console du navigateur (une fois) : localStorage.setItem('ghost_allow_localhost','1') puis recharger, pour que l’UX n’écrase pas le RPC local.",
        },
    };
    fs.writeFileSync(outPath, JSON.stringify(doc, null, 2));
    console.log("Adresses →", outPath);
    console.log("\n─── Prochaines étapes UX ───");
    console.log("1) MetaMask : réseau personnalisé RPC http://127.0.0.1:8545 chainId 31337.");
    console.log(
        "2) Importer le compte #0 Hardhat dans MetaMask : clé documentée publiquement (réseau local uniquement — voir doc Hardhat / Anvil, ne jamais réutiliser ailleurs)."
    );
    console.log("3) Dans l’onglet du navigateur : localStorage.setItem('ghost_allow_localhost','1')");
    console.log("4) Recharger la page ; Configuration RPC : http://127.0.0.1:8545");
    console.log("5) Envoyer → Prévente : coller l’adresse GhostPresale :", presaleAddr);
    console.log("6) Attendre", startOffset, "s après le déploiement puis acheter (buy / wallet externe).");
    console.log("7) buyTokensGhost : depuis Hardhat console, appeler mock.register(pseudo1,p2,k1,k2) avec les commits de ton compte, puis flux « Compte connecté ».\n");
}

main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
});
