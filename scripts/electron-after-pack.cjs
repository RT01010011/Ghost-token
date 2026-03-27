'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Applique l'icône .exe sous Windows sans passer par winCodeSign (évite les symlinks 7z).
 * Nécessite le package devDependency `rcedit`.
 */
module.exports = async function afterPack(context) {
    if (context.electronPlatformName !== 'win32') return;

    const projectDir = context.packager.projectDir;
    const iconPath = path.join(projectDir, 'assets', 'ghost_logo.ico');
    const exeName = `${context.packager.appInfo.productFilename}.exe`;
    const exePath = path.join(context.appOutDir, exeName);

    if (!fs.existsSync(iconPath)) {
        console.warn('[afterPack] Icône absente :', iconPath);
        return;
    }
    if (!fs.existsSync(exePath)) {
        console.warn('[afterPack] Exe introuvable :', exePath);
        return;
    }

    const { rcedit } = await import('rcedit');
    await rcedit(exePath, { icon: iconPath });
    console.log('[afterPack] Icône appliquée sur', exeName);
};
