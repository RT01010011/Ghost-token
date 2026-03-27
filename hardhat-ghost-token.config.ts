/**
 * Configuration Hardhat — jeton GHOST + prévente (`contrat tokken/`).
 * Ne compile pas GhostProtocolV2 (protocole escrow) : autre config si besoin.
 *
 * Usage :
 *   npx hardhat compile --config hardhat-ghost-token.config.ts
 *   npx hardhat test --config hardhat-ghost-token.config.ts
 *   npx hardhat run scripts/deploy-ghost-token.ts --config hardhat-ghost-token.config.ts --network baseSepolia
 *
 * Fork Base (UX / comptes Ghost réels) :
 *   Terminal 1 : npm run node:token:fork
 *   Si `EADDRINUSE 127.0.0.1:8545` : npx hardhat node --config hardhat-ghost-token.config.ts --fork https://mainnet.base.org --port 8546
 *   Terminal 2 : $env:HARDHAT_NODE_URL="http://127.0.0.1:8546" ; npm run deploy:presale:fork
 *
 * Voir `docs/PRESALE-E2E-TESTNET.md` et `docs/TESTS-GHOST-TOKEN-PREVENTE.md`.
 */
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

/** Gwei → wei (bigint), pour overrides gas Base en déploiement. */
function gweiEnvToWei(key: string): bigint | undefined {
    const raw = process.env[key]?.trim();
    if (!raw) return undefined;
    const n = parseFloat(raw);
    if (Number.isNaN(n) || n <= 0) return undefined;
    return BigInt(Math.ceil(n * 1e9));
}

const baseGasOverrides: { maxFeePerGas?: bigint; maxPriorityFeePerGas?: bigint } = {};
const mf = gweiEnvToWei("BASE_DEPLOY_MAX_FEE_GWEI");
const mp = gweiEnvToWei("BASE_DEPLOY_PRIORITY_FEE_GWEI");
if (mf) baseGasOverrides.maxFeePerGas = mf;
if (mp) baseGasOverrides.maxPriorityFeePerGas = mp;

const config: HardhatUserConfig = {
    solidity: {
        version: "0.8.28",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
            viaIR: true,
            evmVersion: "cancun",
        },
    },
    networks: {
        localhost: {
            url: process.env.HARDHAT_NODE_URL || "http://127.0.0.1:8545",
        },
        hardhat: {
            chainId: 31337,
        },
        base: {
            url: process.env.BASE_RPC_URL || "https://mainnet.base.org",
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
            chainId: 8453,
            ...(Object.keys(baseGasOverrides).length > 0 ? baseGasOverrides : {}),
        },
        baseSepolia: {
            url: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
            chainId: 84532,
        },
    },
    etherscan: {
        apiKey: process.env.BASESCAN_API_KEY || "",
        customChains: [
            {
                network: "base",
                chainId: 8453,
                urls: {
                    apiURL: "https://api.basescan.org/api",
                    browserURL: "https://basescan.org",
                },
            },
            {
                network: "baseSepolia",
                chainId: 84532,
                urls: {
                    apiURL: "https://api-sepolia.basescan.org/api",
                    browserURL: "https://sepolia.basescan.org",
                },
            },
        ],
    },
    paths: {
        sources: "./contrat tokken",
        tests: "./tests",
        cache: "./cache-ghost-token",
        artifacts: "./artifacts-ghost-token",
    },
    gasReporter: {
        enabled: false,
    },
    mocha: {
        reporter: process.env.HARDHAT_MOCHA_REPORTER || "spec",
    },
};

export default config;
