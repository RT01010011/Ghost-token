/**
 * postinstall : electron-builder install-app-deps (HID/USB natifs).
 * Sur GitHub Actions / CI, on saute : inutile pour Hardhat et souvent en échec sur ubuntu-latest.
 */
const { execSync } = require("child_process");

if (process.env.CI === "true" || process.env.SKIP_ELECTRON_POSTINSTALL === "1") {
    console.log(
        "[postinstall] Skip electron-builder install-app-deps (CI ou SKIP_ELECTRON_POSTINSTALL=1)."
    );
    process.exit(0);
}

try {
    execSync("electron-builder install-app-deps", { stdio: "inherit" });
} catch (e) {
    process.exit(typeof e.status === "number" ? e.status : 1);
}
