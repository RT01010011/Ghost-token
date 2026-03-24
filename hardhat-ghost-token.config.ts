/**
 * Jeton GHOST + prévente. Tests Hardhat dans `./tests` (voir `tests/README.md`).
 */
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

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
};

export default config;
