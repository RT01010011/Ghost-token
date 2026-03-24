import { ethers, network, run } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("=== GHOST — GhostToken ===");
    console.log("  Réseau     :", network.name, `(chainId: ${network.config.chainId})`);
    console.log("  Déployeur  :", deployer.address);

    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("  Solde      :", ethers.formatEther(balance), "ETH");
    console.log("");

    if (network.name !== "hardhat" && balance === 0n) {
        throw new Error("Solde ETH insuffisant pour payer le gas de déploiement.");
    }

    console.log("[1/2] Déploiement GhostToken");
    const Factory = await ethers.getContractFactory("GhostToken");
    const token = await Factory.deploy();
    const receipt = await token.deploymentTransaction()?.wait();
    const tokenAddress = await token.getAddress();

    const total = await token.TOTAL_SUPPLY();
    console.log("OK GhostToken");
    console.log("  Adresse     :", tokenAddress);
    console.log("  TOTAL_SUPPLY:", ethers.formatUnits(total, 18), "GHOST");
    console.log("  TX          :", receipt?.hash);
    console.log("  Bloc        :", receipt?.blockNumber);

    const outPath = path.join(__dirname, "..", "deployed-addresses-ghost-token.json");
    const output = {
        network: network.name,
        chainId: network.config.chainId,
        deployer: deployer.address,
        deployedAt: new Date().toISOString(),
        deployBlock: receipt?.blockNumber,
        deployTx: receipt?.hash,
        contracts: {
            GhostToken: tokenAddress,
        },
    };
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
    console.log("\n  Fichier :", outPath);

    const skipVerify = process.env.GHOST_SKIP_VERIFY === "1" || process.env.GHOST_SKIP_VERIFY === "true";
    if (!skipVerify && network.name !== "hardhat") {
        console.log("\n[2/2] Vérification explorateur (attente 30 s)");
        await new Promise((r) => setTimeout(r, 30_000));
        try {
            await run("verify:verify", {
                address: tokenAddress,
                constructorArguments: [],
            });
            console.log("OK Contrat vérifié.");
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            if (msg.includes("Already Verified")) {
                console.log("OK Déjà vérifié.");
            } else {
                console.warn("[WARN] Vérification :", msg);
                console.warn("  Réessayer : npx hardhat verify --config hardhat-ghost-token.config.ts --network", network.name, tokenAddress);
            }
        }
    } else if (network.name === "hardhat") {
        console.log("\n[2/2] Réseau local — pas de vérification.");
    } else {
        console.log("\n[2/2] Vérification ignorée (GHOST_SKIP_VERIFY).");
    }

    console.log("\n=== Fin ===");
}

main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
});
