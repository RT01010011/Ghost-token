/**
 * Déploie **uniquement** `GhostPresaleWelcomeRegistry` (campagnes type 100 GHOST / compte éligible).
 *
 * Ne touche pas au token, à la prévente, aux vestings, au splitter ni au bonus registry.
 * Les adresses sont lues dans `deployed-addresses-ghost-ecosystem.json` (ou variables ci-dessous).
 *
 * Anti-doublon (fichier de sortie) :
 *   Si `deployed-addresses-ghost-welcome-registry.json` existe déjà avec une adresse
 *   `GhostPresaleWelcomeRegistry`, le script s’arrête — ne pas créer un second contrat par erreur.
 *   Pour enregistrer un contrat déjà déployé à la main : `GHOST_WELCOME_REGISTRY_ALREADY_DEPLOYED=0x…`
 *   (écrit seulement le JSON, aucun `deploy`).
 *   Pour repartir de zéro après une fausse manip : renomme ou supprime le JSON **et** vérifie sur la chaîne
 *   qu’aucun déploiement orphelin ne doit être réutilisé.
 *
 * `claimOpensAt` (ouverture de `claim()` pour les 100 GHOST) :
 *   1) Si `GHOST_WELCOME_CLAIM_OPENS_UNIX` est défini → utilisé tel quel.
 *   2) Sinon : `presale.endUnix` dans `deployed-addresses-ghost-ecosystem.json` + `GHOST_WELCOME_CLAIM_OPENS_AFTER_END_SEC` (défaut 0).
 *      Aligné sur ta prévente déjà déployée (ex. fin des 7 jours après le 28/03/2026).
 *   3) Sinon : lecture `endTime()` sur le contrat `GhostPresale` + même offset.
 *
 * Optionnel :
 *   GHOST_WELCOME_MAX_RECIPIENTS (défaut 3300)
 *   GHOST_WELCOME_AMOUNT_GHOST (défaut 100)
 *   GHOST_WELCOME_ADMIN — sinon `GHOST_PRESALE_ADMIN` ou `walletsUsed.PRESALE_ADMIN` du JSON écosystème
 *   GHOST_ECOSYSTEM_JSON — chemin vers le JSON écosystème (défaut : racine du dépôt)
 *   GHOST_WELCOME_TOKEN, GHOST_WELCOME_PRESALE, GHOST_WELCOME_GHOST_V2 — surcharges d’adresses
 */

import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const WELCOME_OUT = path.join(__dirname, "..", "deployed-addresses-ghost-welcome-registry.json");
const ECOSYSTEM_DEFAULT = path.join(__dirname, "..", "deployed-addresses-ghost-ecosystem.json");

function mustAddr(label: string, v: string | undefined): string {
    const s = (v || "").trim();
    if (!s || !/^0x[a-fA-F0-9]{40}$/.test(s)) {
        throw new Error(`${label} : adresse 0x manquante ou invalide (${v})`);
    }
    return ethers.getAddress(s);
}

function loadLinkedAddresses(): {
    token: string;
    presale: string;
    ghostV2: string;
    admin: string;
    ecosystemChainId: number | null;
    ecosystemPath: string;
} {
    const ecoPath = process.env.GHOST_ECOSYSTEM_JSON?.trim() || ECOSYSTEM_DEFAULT;
    let token = process.env.GHOST_WELCOME_TOKEN?.trim();
    let presale = process.env.GHOST_WELCOME_PRESALE?.trim();
    let ghostV2 = process.env.GHOST_WELCOME_GHOST_V2?.trim();

    let ecosystemChainId: number | null = null;
    let adminFromJson: string | undefined;

    if (fs.existsSync(ecoPath)) {
        const j = JSON.parse(fs.readFileSync(ecoPath, "utf8")) as {
            chainId?: number;
            contracts?: Record<string, string>;
            walletsUsed?: { PRESALE_ADMIN?: string };
        };
        ecosystemChainId = typeof j.chainId === "number" ? j.chainId : null;
        const c = j.contracts || {};
        token = token || c.GhostToken;
        presale = presale || c.GhostPresale;
        ghostV2 = ghostV2 || c.GhostProtocolV2;
        adminFromJson = j.walletsUsed?.PRESALE_ADMIN;
    } else if (!token || !presale || !ghostV2) {
        throw new Error(
            `Fichier écosystème introuvable : ${ecoPath}. ` +
                `Génère-le avec deploy-ghost-ecosystem ou renseigne GHOST_WELCOME_TOKEN, GHOST_WELCOME_PRESALE, GHOST_WELCOME_GHOST_V2.`
        );
    }

    const adminRaw =
        process.env.GHOST_WELCOME_ADMIN?.trim() ||
        process.env.GHOST_PRESALE_ADMIN?.trim() ||
        adminFromJson;

    return {
        token: mustAddr("GhostToken", token),
        presale: mustAddr("GhostPresale", presale),
        ghostV2: mustAddr("GhostProtocolV2", ghostV2),
        admin: mustAddr("Admin welcome registry", adminRaw),
        ecosystemChainId,
        ecosystemPath: ecoPath,
    };
}

function readExistingWelcomeOut(): string | null {
    if (!fs.existsSync(WELCOME_OUT)) return null;
    try {
        const j = JSON.parse(fs.readFileSync(WELCOME_OUT, "utf8")) as {
            contracts?: { GhostPresaleWelcomeRegistry?: string };
        };
        const a = j.contracts?.GhostPresaleWelcomeRegistry?.trim();
        if (a && /^0x[a-fA-F0-9]{40}$/i.test(a)) return ethers.getAddress(a);
    } catch {
        return null;
    }
    return null;
}

const PRESALE_END_TIME_ABI = ["function endTime() view returns (uint256)"];

async function resolveClaimOpensAt(linked: {
    presale: string;
    ecosystemPath: string;
}): Promise<{ unix: bigint; source: string }> {
    const raw = process.env.GHOST_WELCOME_CLAIM_OPENS_UNIX?.trim();
    if (raw) {
        const v = BigInt(parseInt(raw, 10));
        if (v <= 0n) throw new Error("GHOST_WELCOME_CLAIM_OPENS_UNIX invalide.");
        return { unix: v, source: "GHOST_WELCOME_CLAIM_OPENS_UNIX" };
    }

    const offsetSec = parseInt(process.env.GHOST_WELCOME_CLAIM_OPENS_AFTER_END_SEC || "0", 10);
    const offset = Number.isFinite(offsetSec) ? offsetSec : 0;

    if (fs.existsSync(linked.ecosystemPath)) {
        const j = JSON.parse(fs.readFileSync(linked.ecosystemPath, "utf8")) as {
            presale?: { endUnix?: number };
        };
        const end = j.presale?.endUnix;
        if (typeof end === "number" && end > 0) {
            const opens = BigInt(end + offset);
            console.log(
                `  claimOpensAt : dérivé du JSON écosystème (presale.endUnix=${end} + offset ${offset}s) → ${opens} (${new Date(Number(opens) * 1000).toISOString()})`
            );
            return { unix: opens, source: "ecosystem.json presale.endUnix + offset" };
        }
    }

    const c = new ethers.Contract(linked.presale, PRESALE_END_TIME_ABI, ethers.provider);
    const endOnChain = await c.endTime();
    const endN = BigInt(endOnChain.toString());
    const opens = endN + BigInt(offset);
    console.log(
        `  claimOpensAt : dérivé de GhostPresale.endTime() on-chain (${endN} + offset ${offset}s) → ${opens} (${new Date(Number(opens) * 1000).toISOString()})`
    );
    return { unix: opens, source: "presale.endTime() on-chain + offset" };
}

async function rpcRetry<T>(label: string, fn: () => Promise<T>, attempts = 25, delayMs = 2000): Promise<T> {
    let last: unknown;
    for (let a = 1; a <= attempts; a++) {
        try {
            return await fn();
        } catch (e) {
            last = e;
            console.warn(`  (RPC « ${label} » — essai ${a}/${attempts}, attente ${delayMs / 1000}s…)`);
            await new Promise((r) => setTimeout(r, delayMs));
        }
    }
    throw last;
}

async function main() {
    const existingFileAddr = readExistingWelcomeOut();
    const onlyRecord = process.env.GHOST_WELCOME_REGISTRY_ALREADY_DEPLOYED?.trim();
    const onlyRecordAddr =
        onlyRecord && /^0x[a-fA-F0-9]{40}$/i.test(onlyRecord) ? ethers.getAddress(onlyRecord) : null;

    if (existingFileAddr) {
        if (onlyRecordAddr && onlyRecordAddr === existingFileAddr) {
            console.log(
                `${path.basename(WELCOME_OUT)} référence déjà ${existingFileAddr}. ` +
                    `Aucun déploiement (évite un doublon sur la chaîne).`
            );
            return;
        }
        if (onlyRecordAddr && onlyRecordAddr !== existingFileAddr) {
            throw new Error(
                `Conflit : le fichier contient ${existingFileAddr} mais GHOST_WELCOME_REGISTRY_ALREADY_DEPLOYED=${onlyRecordAddr}. ` +
                    `Renomme ou corrige le fichier avant de continuer.`
            );
        }
        throw new Error(
            `Registre welcome déjà référencé dans ${path.basename(WELCOME_OUT)} : ${existingFileAddr}.\n` +
                `Aucun nouveau déploiement (évite un doublon on-chain). ` +
                `Pour pointer vers un contrat déjà déployé à la main sans refaire le JSON : ` +
                `renomme l’ancien fichier puis GHOST_WELCOME_REGISTRY_ALREADY_DEPLOYED=0x…`
        );
    }

    const maxRecipients = BigInt(process.env.GHOST_WELCOME_MAX_RECIPIENTS || "3300");
    if (maxRecipients <= 0n) throw new Error("GHOST_WELCOME_MAX_RECIPIENTS doit être > 0.");

    const amountGhostStr = process.env.GHOST_WELCOME_AMOUNT_GHOST?.trim() || "100";
    const welcomeAmountWei = ethers.parseEther(amountGhostStr);

    const linked = loadLinkedAddresses();
    const { unix: claimOpensAt, source: claimOpensSource } = await resolveClaimOpensAt(linked);

    const { name: networkName, chainId } = await ethers.provider.getNetwork();
    const chainIdNum = Number(chainId);

    if (linked.ecosystemChainId != null && linked.ecosystemChainId !== chainIdNum) {
        console.warn(
            `⚠️  ChainId réseau actuel (${chainIdNum}) ≠ chainId du JSON écosystème (${linked.ecosystemChainId}). Vérifie --network.`
        );
    }

    const [deployer] = await ethers.getSigners();

    let welcomeAddr: string;

    if (onlyRecordAddr) {
        welcomeAddr = onlyRecordAddr;
        console.log("Mode GHOST_WELCOME_REGISTRY_ALREADY_DEPLOYED — aucun deploy, enregistrement JSON uniquement.");
        console.log("  GhostPresaleWelcomeRegistry :", welcomeAddr);
    } else {
        console.log("═══════════════════════════════════════════════════════════════");
        console.log("  GhostPresaleWelcomeRegistry — déploiement seul (pas d’écosystème complet)");
        console.log("═══════════════════════════════════════════════════════════════");
        console.log("  Réseau        :", networkName, "(chainId", chainIdNum + ")");
        console.log("  Déployeur     :", deployer.address);
        console.log("  GhostToken    :", linked.token);
        console.log("  GhostPresale  :", linked.presale);
        console.log("  Ghost V2      :", linked.ghostV2);
        console.log("  Admin         :", linked.admin);
        console.log("  Montant / user:", amountGhostStr, "GHOST");
        console.log("  Max recipients:", maxRecipients.toString());
        console.log("  claimOpensAt  :", claimOpensAt.toString(), "→", new Date(Number(claimOpensAt) * 1000).toISOString());
        console.log("  (source       :", claimOpensSource + ")");
        console.log("═══════════════════════════════════════════════════════════════\n");

        const factory = await ethers.getContractFactory("GhostPresaleWelcomeRegistry");
        const welcome = await factory.deploy(
            linked.token,
            linked.presale,
            linked.ghostV2,
            linked.admin,
            welcomeAmountWei,
            maxRecipients,
            claimOpensAt
        );
        await welcome.waitForDeployment();
        welcomeAddr = await welcome.getAddress();

        if (process.env.GHOST_WELCOME_SKIP_POST_DEPLOY_ETH_CALL === "1") {
            console.warn(
                "  ⚠️  GHOST_WELCOME_SKIP_POST_DEPLOY_ETH_CALL=1 — pas de lecture on-chain après deploy (args constructeur = vérité)."
            );
        } else {
            const tokOnChain = await rpcRetry("GhostPresaleWelcomeRegistry.token", () => welcome.token());
            const preOnChain = await rpcRetry("GhostPresaleWelcomeRegistry.presale", () => welcome.presale());
            const v2OnChain = await rpcRetry("GhostPresaleWelcomeRegistry.ghostV2", () => welcome.ghostV2());
            if (ethers.getAddress(tokOnChain) !== linked.token) throw new Error("Vérif on-chain : token ≠ attendu");
            if (ethers.getAddress(preOnChain) !== linked.presale) throw new Error("Vérif on-chain : presale ≠ attendu");
            if (ethers.getAddress(v2OnChain) !== linked.ghostV2) throw new Error("Vérif on-chain : ghostV2 ≠ attendu");
        }

        console.log("  OK déployé :", welcomeAddr);
        console.log(
            "\n  Étapes suivantes (hors script) : transférer des GHOST sur ce contrat depuis le wallet airdrop " +
                `(budget ≥ ${amountGhostStr} × N inscrits ; plafond on-chain ${maxRecipients} comptes). ` +
                "Puis `recordWelcomeAccount` côté admin, et `claim` côté utilisateurs après claimOpensAt.\n"
        );
    }

    const out = {
        network: networkName,
        chainId: chainIdNum,
        deployer: deployer.address,
        deployedAt: new Date().toISOString(),
        ecosystemReference: fs.existsSync(linked.ecosystemPath) ? path.basename(linked.ecosystemPath) : null,
        parameters: {
            welcomeAmountGhost: amountGhostStr,
            welcomeAmountWei: welcomeAmountWei.toString(),
            maxRecipients: maxRecipients.toString(),
            claimOpensUnix: claimOpensAt.toString(),
            claimOpensIso: new Date(Number(claimOpensAt) * 1000).toISOString(),
            claimOpensSource,
            admin: linked.admin,
        },
        linkedContracts: {
            GhostToken: linked.token,
            GhostPresale: linked.presale,
            GhostProtocolV2: linked.ghostV2,
        },
        contracts: {
            GhostPresaleWelcomeRegistry: welcomeAddr,
        },
    };

    fs.writeFileSync(WELCOME_OUT, JSON.stringify(out, null, 2));
    console.log("  Fichier sauvegardé :", WELCOME_OUT);
}

main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
});
