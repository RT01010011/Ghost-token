/**
 * Compile, exécute la suite Hardhat avec reporter Mocha JSON, écrit test-results-hardhat.json.
 * Utilise HARDHAT_MOCHA_REPORTER=json (voir hardhat-ghost-token.config.ts) et --no-compile pour une sortie JSON seule.
 * Usage : node scripts/export-hardhat-test-json.cjs
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const outFile = path.join(root, "test-results-hardhat.json");

const env = {
    ...process.env,
    HARDHAT_MOCHA_REPORTER: "json",
    NODE_OPTIONS: process.env.NODE_OPTIONS || "--max-old-space-size=8192",
};

const compile = spawnSync(
    "npx",
    ["hardhat", "compile", "--config", "hardhat-ghost-token.config.ts"],
    { cwd: root, shell: true, encoding: "utf-8", env }
);
if (compile.stderr) {
    process.stderr.write(compile.stderr);
}
if (compile.status !== 0) {
    process.exit(compile.status ?? 1);
}

const r = spawnSync(
    "npx",
    ["hardhat", "test", "--config", "hardhat-ghost-token.config.ts", "--no-compile"],
    {
        cwd: root,
        shell: true,
        encoding: "utf-8",
        maxBuffer: 64 * 1024 * 1024,
        env,
    }
);

if (r.stderr) {
    process.stderr.write(r.stderr);
}

const body = (r.stdout || "").trim();
if (!body) {
    fs.writeFileSync(
        outFile,
        JSON.stringify({ error: "empty stdout from hardhat test", exitCode: r.status }, null, 2),
        "utf8"
    );
    process.exit(r.status ?? 1);
}

fs.writeFileSync(outFile, body.endsWith("\n") ? body : `${body}\n`, "utf8");
process.exit(r.status === null ? 1 : r.status);
