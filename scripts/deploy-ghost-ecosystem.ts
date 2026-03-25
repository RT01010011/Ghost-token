import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

function addr(key: string, fallback: string): string {
    const v = process.env[key]?.trim();
    if (v && /^0x[a-fA-F0-9]{40}$/.test(v)) return v;
    return fallback;
}

function u64(key: string, fallback: number): number {
    const v = process.env[key]?.trim();
    if (!v) return fallback;
    const n = parseInt(v, 10);
    if (Number.isNaN(n)) return fallback;
    return n;
}

function eqAddr(a: string, b: string): boolean {
    return a.toLowerCase() === b.toLowerCase();
}

const ADDR_ZERO = "0x0000000000000000000000000000000000000000";

/** Obligatoire sur Base mainnet / Sepolia : aucune adresse réelle par défaut dans le dépôt public. */
function requireEnvAddr(key: string): string {
    const v = process.env[key]?.trim();
    if (!v || !/^0x[a-fA-F0-9]{40}$/.test(v)) {
        throw new Error(
            `${key} manquant ou invalide dans .env (obligatoire sur Base mainnet / Sepolia). Voir .env.example.`
        );
    }
    if (v.toLowerCase() === ADDR_ZERO) {
        throw new Error(`${key} ne peut pas être l'adresse zéro.`);
    }
    return v;
}

/**
 * Base (8453 / 84532) : toutes les adresses viennent du .env.
 * Hardhat local (31337) : repli de développement uniquement (ne pas utiliser en production).
 */
function buildWallets(chainId: bigint): {
    AIRDROP: string;
    TREASURY: string;
    TEAM: string;
    REWARDS: string;
    LIQUIDITY: string;
    PRESALE_ADMIN: string;
} {
    if (chainId === 8453n || chainId === 84532n) {
        return {
            AIRDROP: requireEnvAddr("GHOST_WALLET_AIRDROP"),
            TREASURY: requireEnvAddr("GHOST_WALLET_TREASURY_VESTING"),
            TEAM: requireEnvAddr("GHOST_WALLET_TEAM_VESTING"),
            REWARDS: requireEnvAddr("GHOST_WALLET_REWARDS_TIMELOCK"),
            LIQUIDITY: requireEnvAddr("GHOST_WALLET_LIQUIDITY"),
            PRESALE_ADMIN: requireEnvAddr("GHOST_PRESALE_ADMIN"),
        };
    }
    return {
        AIRDROP: addr("GHOST_WALLET_AIRDROP", "0x9D5DB811b409E6EcCE8B097093e719bfc5430f9a"),
        TREASURY: addr("GHOST_WALLET_TREASURY_VESTING", "0xaB37b96A7653bE7Cb8Fb5DaCDcDda0EfC42EbcA4"),
        TEAM: addr("GHOST_WALLET_TEAM_VESTING", "0xed7c344bAF2950Ba217CAb2279c400a830e6dD50"),
        REWARDS: addr("GHOST_WALLET_REWARDS_TIMELOCK", "0x425F84c4adC84ce62A459610BD87A051A96c3c56"),
        LIQUIDITY: addr("GHOST_WALLET_LIQUIDITY", "0x7926a4d86A77642Ecd0bc3fD651282187333E4a6"),
        PRESALE_ADMIN: addr("GHOST_PRESALE_ADMIN", "0xed7c344bAF2950Ba217CAb2279c400a830e6dD50"),
    };
}

function parseEthSplitBps(): number[] {
    const raw = process.env.GHOST_ETH_SPLIT_BPS?.trim();
    const defaultBps = [2352, 2117, 2000, 2352, 1179];
    if (!raw) return defaultBps;
    const parts = raw.split(",").map((s) => s.trim());
    if (parts.length !== 5) {
        throw new Error("GHOST_ETH_SPLIT_BPS doit contenir exactement 5 entiers séparés par des virgules.");
    }
    let sum = 0;
    const out: number[] = [];
    for (const p of parts) {
        const n = parseInt(p, 10);
        if (Number.isNaN(n) || n <= 0) {
            throw new Error("GHOST_ETH_SPLIT_BPS : chaque valeur doit être un entier > 0.");
        }
        out.push(n);
        sum += n;
    }
    if (sum !== 10_000) {
        throw new Error(`GHOST_ETH_SPLIT_BPS : la somme doit être 10_000 (actuellement ${sum}).`);
    }
    return out;
}

function assertDeployerSeparatedFromTokenomicsWallets(
    deployer: string,
    wallets: {
        AIRDROP: string;
        TREASURY: string;
        TEAM: string;
        REWARDS: string;
        LIQUIDITY: string;
        PRESALE_ADMIN: string;
    }
): void {
    if (process.env.GHOST_SKIP_DEPLOYER_SEPARATION_CHECKS === "1" || process.env.GHOST_SKIP_DEPLOYER_SEPARATION_CHECKS === "true") {
        console.warn("[WARN] GHOST_SKIP_DEPLOYER_SEPARATION_CHECKS actif — vérifications déployeur / wallets désactivées.\n");
        return;
    }

    const checks: [string, string][] = [
        ["GHOST_WALLET_AIRDROP", wallets.AIRDROP],
        ["GHOST_WALLET_TREASURY_VESTING (beneficiary vesting GHOST 18 %)", wallets.TREASURY],
        ["GHOST_WALLET_TEAM_VESTING", wallets.TEAM],
        ["GHOST_WALLET_REWARDS_TIMELOCK", wallets.REWARDS],
        ["GHOST_WALLET_LIQUIDITY", wallets.LIQUIDITY],
        ["GHOST_PRESALE_ADMIN (droits admin prévente ; ETH → splitter → wallets)", wallets.PRESALE_ADMIN],
    ];

    for (const [label, w] of checks) {
        if (eqAddr(deployer, w)) {
            throw new Error(
                `Sécurité tokenomics : le déployeur (${deployer}) ne doit pas être identique à ${label} (${w}). ` +
                    `Utilise un wallet éphémère / dédié au gas pour PRIVATE_KEY et des adresses distinctes dans le .env. ` +
                    `(Désactivation non recommandée : GHOST_SKIP_DEPLOYER_SEPARATION_CHECKS=1.)`
            );
        }
    }
}

async function main() {
    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();
    const latest = await ethers.provider.getBlock("latest");
    let now = latest ? Number(latest.timestamp) : Math.floor(Date.now() / 1000);

    const chainId = BigInt(network.chainId);
    const WALLETS = buildWallets(chainId);

    if (chainId === 8453n || chainId === 84532n) {
        if (!process.env.GHOST_PRESALE_START_UNIX?.trim() || !process.env.GHOST_PRESALE_END_UNIX?.trim()) {
            throw new Error(
                "GHOST_PRESALE_START_UNIX et GHOST_PRESALE_END_UNIX doivent être définis explicitement dans .env pour Base mainnet / Sepolia (évite un déploiement avec des dates implicites)."
            );
        }
    }

    const ghostPerEthStr = process.env.GHOST_PER_ETH_GHOST?.trim() || "212000";
    const GHOST_PER_ETH = ethers.parseUnits(ghostPerEthStr, 18);
    const SOFT_CAP_ETH = ethers.parseEther(process.env.GHOST_PRESALE_SOFT_CAP_ETH ?? "0");
    const HARD_CAP_ETH = ethers.parseEther(process.env.GHOST_PRESALE_HARD_CAP_ETH ?? "10000");
    const MAX_PER_WALLET = ethers.parseEther(process.env.GHOST_PRESALE_MAX_ETH_PER_WALLET ?? "1");
    // Défauts dev (31337) : début jeudi 26 mars 2026 02:00 Europe/Paris (CET) ; fin jeudi 2 avril 2026 02:00 Paris (CEST) — 7 j calendaires, pas +604800 s (évite +1 h au passage DST).
    let START_TIME = u64("GHOST_PRESALE_START_UNIX", 1774486800);
    let END_TIME = u64("GHOST_PRESALE_END_UNIX", 1775088000);
    const REWARDS_LOCK_SEC = u64("GHOST_REWARDS_LOCK_SECONDS", 365 * 24 * 3600);

    const VESTING_TEAM_CLIFF = 6 * 30 * 24 * 3600;
    const VESTING_TEAM_DURATION = 3 * 365 * 24 * 3600;
    const VESTING_TREASURY_CLIFF = 0;
    const VESTING_TREASURY_DURATION = 2 * 365 * 24 * 3600;

    console.log("═══════════════════════════════════════════════════════════════");
    console.log("  GHOST — déploiement écosystème (tokenomics complète)");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log(`  Réseau      : ${network.name} (chainId ${network.chainId})`);
    console.log(`  Déployeur   : ${deployer.address}`);
    console.log(`  Balance ETH : ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);
    console.log("═══════════════════════════════════════════════════════════════\n");

    assertDeployerSeparatedFromTokenomicsWallets(deployer.address, WALLETS);

    if (chainId !== 8453n && chainId !== 84532n && chainId !== 31337n) {
        console.warn("[WARN] Réseau inattendu — confirmer si volontaire (Base = 8453, Sepolia = 84532).\n");
    }

    const GHOST_PROTOCOL_V2 = process.env.GHOST_PROTOCOL_V2?.trim();
    if (!GHOST_PROTOCOL_V2 || !/^0x[a-fA-F0-9]{40}$/.test(GHOST_PROTOCOL_V2)) {
        throw new Error(
            "GHOST_PROTOCOL_V2 manquant ou invalide : définis l’adresse GhostProtocolV2 (0x + 40 hex) dans .env pour GhostPresale.buyTokensGhost."
        );
    }

    if (MAX_PER_WALLET === 0n) {
        throw new Error("GHOST_PRESALE_MAX_ETH_PER_WALLET ne peut pas être 0 (anti-whale obligatoire dans GhostPresale).");
    }
    if (MAX_PER_WALLET > HARD_CAP_ETH) {
        console.warn(
            "[WARN] maxPerWallet > hardCapEth : vérifier que la configuration est voulue.\n"
        );
    }

    if (START_TIME <= now) {
        if (chainId === 31337n) {
            START_TIME = now + 3600;
            END_TIME = START_TIME + 7 * 24 * 3600;
            console.warn(
                "[WARN] Réseau Hardhat : dates prévente par défaut dépassées — start = now+1h, end = start+7j.\n"
            );
        } else {
            throw new Error(
                "GHOST_PRESALE_START_UNIX est dans le passé. Mets à jour GHOST_PRESALE_START_UNIX / GHOST_PRESALE_END_UNIX avant de déployer sur ce réseau."
            );
        }
    }

    console.log("Wallets utilisés :");
    console.log(WALLETS);
    const ethSplitBps = parseEthSplitBps();
    console.log("\n  Rappel flux fonds (après déploiement, le déployeur ne doit garder ni GHOST ni pouvoir) :");
    console.log(
        `    • ETH de la prévente (finalize)  → GhostEthProceedsSplitter → 5 wallets (bps ${ethSplitBps.join(",")})`
    );
    console.log(`    • Admin prévente (finalize, refunds…) : ${WALLETS.PRESALE_ADMIN}`);
    console.log(`    • GHOST trésorerie 18 % (vesting) → beneficiary : ${WALLETS.TREASURY}`);
    console.log("    • GhostToken n’a pas d’owner.\n");
    console.log("\nPrévente :");
    console.log(`  GHOST/ETH     : ${ghostPerEthStr}`);
    console.log(`  Soft cap ETH  : ${ethers.formatEther(SOFT_CAP_ETH)}`);
    console.log(`  Hard cap ETH  : ${ethers.formatEther(HARD_CAP_ETH)}`);
    console.log(`  Max/wallet    : ${ethers.formatEther(MAX_PER_WALLET)} ETH`);
    console.log(`  Start (Unix)  : ${START_TIME} → ${new Date(START_TIME * 1000).toISOString()}`);
    console.log(`  End (Unix)    : ${END_TIME} → ${new Date(END_TIME * 1000).toISOString()}`);
    console.log(`  GhostProtocolV2 (presale Schnorr) : ${GHOST_PROTOCOL_V2}`);
    console.log(`  Timelock +1 an depuis deploy (secondes) : ${REWARDS_LOCK_SEC}`);
    {
        const oneGhost = ethers.parseEther("1");
        const ethWeiPerGhost = (oneGhost * ethers.parseEther("1")) / GHOST_PER_ETH;
        console.log(
            `  Prix prévente (fixe) : 1 GHOST = ${ethers.formatEther(ethWeiPerGhost)} ETH (dérivé de ${ghostPerEthStr} GHOST/ETH)`
        );
        console.log(`  Anti-whale    : actif — max ${ethers.formatEther(MAX_PER_WALLET)} ETH cumulés / wallet\n`);
    }

    const BONUS_BPS = (() => {
        const v = process.env.GHOST_PRESALE_BONUS_BPS?.trim();
        if (!v) return 500;
        const n = parseInt(v, 10);
        if (Number.isNaN(n) || n < 0 || n > 10_000) {
            throw new Error("GHOST_PRESALE_BONUS_BPS doit être un entier entre 0 et 10_000 (défaut 500 = 5 %).");
        }
        return n;
    })();
    const rawBonusCredDomain = process.env.GHOST_BONUS_CREDENTIAL_DOMAIN?.trim();
    const BONUS_CRED_DOMAIN =
        rawBonusCredDomain && /^0x[a-fA-F0-9]{64}$/.test(rawBonusCredDomain)
            ? rawBonusCredDomain
            : ethers.keccak256(ethers.toUtf8Bytes("GhostPresaleBonusRegistry.v1"));

    console.log("1/7 — GhostToken…");
    const token = await (await ethers.getContractFactory("GhostToken")).deploy();
    await token.waitForDeployment();
    const tokenAddr = await token.getAddress();
    console.log(`      OK ${tokenAddr}\n`);

    console.log("2/7 — GhostVesting équipe…");
    const teamVesting = await (
        await ethers.getContractFactory("GhostVesting")
    ).deploy(
        tokenAddr,
        WALLETS.TEAM,
        now,
        VESTING_TEAM_CLIFF,
        VESTING_TEAM_DURATION,
        await token.TEAM_ALLOC()
    );
    await teamVesting.waitForDeployment();
    const teamVestingAddr = await teamVesting.getAddress();
    console.log(`      OK ${teamVestingAddr}\n`);

    console.log("3/7 — GhostVesting trésorerie…");
    const treasuryVesting = await (
        await ethers.getContractFactory("GhostVesting")
    ).deploy(
        tokenAddr,
        WALLETS.TREASURY,
        now,
        VESTING_TREASURY_CLIFF,
        VESTING_TREASURY_DURATION,
        await token.TREASURY_ALLOC()
    );
    await treasuryVesting.waitForDeployment();
    const treasuryVestingAddr = await treasuryVesting.getAddress();
    console.log(`      OK ${treasuryVestingAddr}\n`);

    console.log("4/7 — GhostTimelock récompenses…");
    const rewardsUnlock = now + REWARDS_LOCK_SEC;
    const timelock = await (
        await ethers.getContractFactory("GhostTimelock")
    ).deploy(tokenAddr, WALLETS.REWARDS, rewardsUnlock);
    await timelock.waitForDeployment();
    const timelockAddr = await timelock.getAddress();
    console.log(`      OK ${timelockAddr}`);
    console.log(`      Déverrouillage : ${new Date(rewardsUnlock * 1000).toISOString()}\n`);

    console.log("5/7 — GhostEthProceedsSplitter (ETH finalize)…");
    const splitRecipients = [
        WALLETS.AIRDROP,
        WALLETS.TREASURY,
        WALLETS.TEAM,
        WALLETS.REWARDS,
        WALLETS.LIQUIDITY,
    ];
    const ethProceedsSplitter = await (
        await ethers.getContractFactory("GhostEthProceedsSplitter")
    ).deploy(splitRecipients, ethSplitBps);
    await ethProceedsSplitter.waitForDeployment();
    const ethProceedsSplitterAddr = await ethProceedsSplitter.getAddress();
    console.log(`      OK ${ethProceedsSplitterAddr}`);
    console.log(`      Bps (Airdrop, Trésorerie, Équipe, Récompenses, Liquidité) : ${ethSplitBps.join(", ")}\n`);

    console.log("6/7 — GhostPresale…");
    const presale = await (
        await ethers.getContractFactory("GhostPresale")
    ).deploy(
        tokenAddr,
        WALLETS.PRESALE_ADMIN,
        ethProceedsSplitterAddr,
        GHOST_PROTOCOL_V2,
        GHOST_PER_ETH,
        SOFT_CAP_ETH,
        HARD_CAP_ETH,
        MAX_PER_WALLET,
        START_TIME,
        END_TIME
    );
    await presale.waitForDeployment();
    const presaleAddr = await presale.getAddress();
    console.log(`      OK ${presaleAddr}`);

    const presaleToken = await presale.ghostToken();
    if (presaleToken.toLowerCase() !== tokenAddr.toLowerCase()) {
        throw new Error(
            `Incohérence critique : GhostPresale.ghostToken()=${presaleToken} != GhostToken déployé ${tokenAddr}`
        );
    }
    const privateSaleCap = await token.PRIVATE_SALE_ALLOC();
    const maxGhost = await presale.maxGhostAllocatable();
    if (maxGhost !== privateSaleCap) {
        throw new Error(
            `Incohérence : maxGhostAllocatable (${maxGhost}) != PRIVATE_SALE_ALLOC (${privateSaleCap})`
        );
    }
    console.log(`      OK Presale / GhostToken (${tokenAddr})`);
    console.log(`      OK maxGhostAllocatable = PRIVATE_SALE_ALLOC = ${ethers.formatEther(maxGhost)} GHOST`);

    const onChainMaxWallet = await presale.maxPerWallet();
    if (onChainMaxWallet !== MAX_PER_WALLET) {
        throw new Error(`maxPerWallet on-chain (${onChainMaxWallet}) != valeur script (${MAX_PER_WALLET})`);
    }
    const onChainGhostPerEth = await presale.ghostPerEth();
    if (onChainGhostPerEth !== GHOST_PER_ETH) {
        throw new Error(`ghostPerEth on-chain != valeur script`);
    }
    const oneGhost = ethers.parseEther("1");
    const ethFor1Ghost = await presale.ethForGhost(oneGhost);
    console.log(`      OK maxPerWallet = ${ethers.formatEther(onChainMaxWallet)} ETH`);
    console.log(
        `      OK ethForGhost(1 GHOST) = ${ethers.formatEther(ethFor1Ghost)} ETH\n`
    );

    console.log("7/7 — GhostPresaleBonusRegistry…");
    const bonusRegistry = await (
        await ethers.getContractFactory("GhostPresaleBonusRegistry")
    ).deploy(presaleAddr, BONUS_BPS, BONUS_CRED_DOMAIN);
    await bonusRegistry.waitForDeployment();
    const bonusRegistryAddr = await bonusRegistry.getAddress();
    console.log(`      OK ${bonusRegistryAddr}`);
    console.log(`      bonusBps = ${BONUS_BPS} (ex. 500 = 5 % sur GHOST achetés en prévente)`);
    console.log(`      credentialDomainSeparator = ${BONUS_CRED_DOMAIN}\n`);

    console.log("Distribution des GHOST…");
    const transfers: [string, bigint, string][] = [
        [WALLETS.AIRDROP, await token.AIRDROP_ALLOC(), "6 600 000 → airdrop"],
        [teamVestingAddr, await token.TEAM_ALLOC(), "5 610 000 → vesting équipe"],
        [treasuryVestingAddr, await token.TREASURY_ALLOC(), "5 940 000 → vesting trésorerie"],
        [timelockAddr, await token.REWARDS_ALLOC(), "6 600 000 → timelock récompenses"],
        [WALLETS.LIQUIDITY, await token.LIQUIDITY_ALLOC(), "3 300 000 → liquidité"],
        [presaleAddr, await token.PRIVATE_SALE_ALLOC(), "4 950 000 → prévente"],
    ];

    const totalSupply = await token.TOTAL_SUPPLY();
    let sumOut = 0n;
    for (const [to, amount, label] of transfers) {
        if (!to || to === ethers.ZeroAddress) {
            throw new Error(`Distribution : destination vide ou 0x0 pour « ${label} » — risque de fonds perdus.`);
        }
        if (amount === 0n) {
            throw new Error(`Distribution : montant nul pour « ${label} ».`);
        }
        sumOut += amount;
    }
    if (sumOut !== totalSupply) {
        throw new Error(
            `Somme des transferts (${sumOut}) ≠ TOTAL_SUPPLY (${totalSupply}) — ne pas déployer, tokenomics incohérente.`
        );
    }
    const balDeployerBefore = await token.balanceOf(deployer.address);
    if (balDeployerBefore !== totalSupply) {
        throw new Error(
            `Le déployeur devrait détenir 100 % du supply avant distribution ; solde=${balDeployerBefore}, attendu=${totalSupply}.`
        );
    }

    for (const [to, amount, label] of transfers) {
        const tx = await token.transfer(to, amount);
        await tx.wait();
        console.log(`  OK ${label}`);
    }

    const leftover = await token.balanceOf(deployer.address);
    if (leftover > 0n) {
        const msg = `Reste sur déployeur : ${ethers.formatEther(leftover)} GHOST — la tokenomics n’est pas entièrement distribuée.`;
        if (chainId === 31337n || process.env.GHOST_ALLOW_LEFTOVER_ON_DEPLOYER === "1") {
            console.warn(`\n[WARN] ${msg}`);
        } else {
            throw new Error(
                msg +
                    " Corrige les montants / transferts ou utilise le réseau Hardhat pour tests. " +
                    "(Exception : GHOST_ALLOW_LEFTOVER_ON_DEPLOYER=1 — non recommandé en prod.)"
            );
        }
    } else {
        console.log("\n  OK — solde déployeur GHOST = 0 (aucun pouvoir économique résiduel sur le wallet de déploiement)");
    }

    const out = {
        network: network.name,
        chainId: Number(network.chainId),
        deployer: deployer.address,
        deployedAt: new Date().toISOString(),
        walletsUsed: WALLETS,
        presale: {
            ghostPerEthGhost: ghostPerEthStr,
            maxEthPerWallet: ethers.formatEther(MAX_PER_WALLET),
            implicitEthPerOneGhost: ethers.formatEther(ethFor1Ghost),
            startUnix: START_TIME,
            endUnix: END_TIME,
            ethProceedsSplitterBps: ethSplitBps,
            ethProceedsRecipientsOrder: ["AIRDROP", "TREASURY", "TEAM", "REWARDS", "LIQUIDITY"],
            presaleBonusBps: BONUS_BPS,
            presaleBonusCredentialDomain: BONUS_CRED_DOMAIN,
        },
        contracts: {
            GhostToken: tokenAddr,
            GhostVestingTeam: teamVestingAddr,
            GhostVestingTreasury: treasuryVestingAddr,
            GhostTimelockRewards: timelockAddr,
            GhostEthProceedsSplitter: ethProceedsSplitterAddr,
            GhostProtocolV2: GHOST_PROTOCOL_V2,
            GhostPresale: presaleAddr,
            GhostPresaleBonusRegistry: bonusRegistryAddr,
        },
    };

    const outPath = path.join(__dirname, "..", "deployed-addresses-ghost-ecosystem.json");
    fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
    console.log("\n  Fichier sauvegardé :", outPath);
    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("  Vérification Basescan (exemples — ajuster si besoin)");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log(`  npx hardhat verify --config hardhat-ghost-token.config.ts --network ${network.name} ${tokenAddr}`);
    console.log("═══════════════════════════════════════════════════════════════\n");
}

main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
});
