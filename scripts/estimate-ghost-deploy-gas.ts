import { ethers } from "hardhat";

async function main() {
    const [, a1, a2, a3, a4, a5] = await ethers.getSigners();
    const latest = await ethers.provider.getBlock("latest");
    const now = latest ? Number(latest.timestamp) : Math.floor(Date.now() / 1000);

    const W = {
        AIRDROP: a1.address,
        TREASURY: a2.address,
        TEAM: a3.address,
        REWARDS: a4.address,
        LIQUIDITY: a5.address,
        PRESALE_ADMIN: a3.address,
    };

    let totalGas = 0n;
    const lines: string[] = [];

    const T = await ethers.getContractFactory("GhostToken");
    const token = await T.deploy();
    const r0 = await token.deploymentTransaction()!.wait();
    totalGas += r0!.gasUsed;
    lines.push(`GhostToken.deploy                    ${r0!.gasUsed}`);

    const VESTING_TEAM_CLIFF = 6 * 30 * 24 * 3600;
    const VESTING_TEAM_DURATION = 3 * 365 * 24 * 3600;
    const VESTING_TREASURY_DURATION = 2 * 365 * 24 * 3600;
    const tokenAddr = await token.getAddress();

    const V = await ethers.getContractFactory("GhostVesting");
    const teamVesting = await V.deploy(
        tokenAddr,
        W.TEAM,
        now,
        VESTING_TEAM_CLIFF,
        VESTING_TEAM_DURATION,
        await token.TEAM_ALLOC()
    );
    const r1 = await teamVesting.deploymentTransaction()!.wait();
    totalGas += r1!.gasUsed;
    lines.push(`GhostVesting équipe.deploy           ${r1!.gasUsed}`);

    const treasuryVesting = await V.deploy(
        tokenAddr,
        W.TREASURY,
        now,
        0,
        VESTING_TREASURY_DURATION,
        await token.TREASURY_ALLOC()
    );
    const r2 = await treasuryVesting.deploymentTransaction()!.wait();
    totalGas += r2!.gasUsed;
    lines.push(`GhostVesting trésorerie.deploy      ${r2!.gasUsed}`);

    const TL = await ethers.getContractFactory("GhostTimelock");
    const timelock = await TL.deploy(tokenAddr, W.REWARDS, now + 365 * 24 * 3600);
    const r3 = await timelock.deploymentTransaction()!.wait();
    totalGas += r3!.gasUsed;
    lines.push(`GhostTimelock.deploy                ${r3!.gasUsed}`);

    const ethSplitBps = [2352, 2117, 2000, 2352, 1179];
    const splitRecipients = [W.AIRDROP, W.TREASURY, W.TEAM, W.REWARDS, W.LIQUIDITY];
    const S = await ethers.getContractFactory("GhostEthProceedsSplitter");
    const splitter = await S.deploy(splitRecipients, ethSplitBps);
    const rs = await splitter.deploymentTransaction()!.wait();
    totalGas += rs!.gasUsed;
    lines.push(`GhostEthProceedsSplitter.deploy     ${rs!.gasUsed}`);

    const start = BigInt(now) + 10_000n;
    const end = start + 7n * 24n * 3600n;
    const splitterAddr = await splitter.getAddress();
    const MockGp = await ethers.getContractFactory("MockGhostProtocolV2ForPresale");
    const mockGp = await MockGp.deploy();
    await mockGp.waitForDeployment();
    const gpAddr = await mockGp.getAddress();
    const P = await ethers.getContractFactory("GhostPresale");
    const presale = await P.deploy(
        tokenAddr,
        W.PRESALE_ADMIN,
        splitterAddr,
        gpAddr,
        ethers.parseUnits("212000", 18),
        0n,
        ethers.parseEther("10000"),
        ethers.parseEther("1"),
        start,
        end
    );
    const r4 = await presale.deploymentTransaction()!.wait();
    totalGas += r4!.gasUsed;
    lines.push(`GhostPresale.deploy                 ${r4!.gasUsed}`);

    const credDom = ethers.keccak256(ethers.toUtf8Bytes("GhostPresaleBonusRegistry.v1"));
    const BR = await ethers.getContractFactory("GhostPresaleBonusRegistry");
    const bonusReg = await BR.deploy(await presale.getAddress(), 500, credDom);
    const rbr = await bonusReg.deploymentTransaction()!.wait();
    totalGas += rbr!.gasUsed;
    lines.push(`GhostPresaleBonusRegistry.deploy    ${rbr!.gasUsed}`);

    const presaleAddr = await presale.getAddress();
    const teamVestingAddr = await teamVesting.getAddress();
    const treasuryVestingAddr = await treasuryVesting.getAddress();
    const timelockAddr = await timelock.getAddress();

    const transfers: [string, bigint, string][] = [
        [W.AIRDROP, await token.AIRDROP_ALLOC(), "transfer AIRDROP"],
        [teamVestingAddr, await token.TEAM_ALLOC(), "transfer TEAM → vesting"],
        [treasuryVestingAddr, await token.TREASURY_ALLOC(), "transfer TREASURY → vesting"],
        [timelockAddr, await token.REWARDS_ALLOC(), "transfer REWARDS → timelock"],
        [W.LIQUIDITY, await token.LIQUIDITY_ALLOC(), "transfer LIQUIDITY"],
        [presaleAddr, await token.PRIVATE_SALE_ALLOC(), "transfer PRIVATE_SALE → presale"],
    ];

    for (const [to, amount, label] of transfers) {
        const tx = await token.transfer(to, amount);
        const rec = await tx.wait();
        const g = rec!.gasUsed;
        totalGas += g;
        lines.push(`${label.padEnd(36)} ${g}`);
    }

    console.log("=== Estimation gas (Hardhat) ===");
    for (const l of lines) console.log(" ", l);
    console.log(" --------------------------------");
    console.log(`  TOTAL (gas)                         ${totalGas}`);
    console.log("");

    const fmtEth = (wei: bigint) => ethers.formatEther(wei);
    const gweiHints = [0.001, 0.005, 0.01, 0.05, 0.1, 1];
    console.log("  Coût indicatif L2 (exécution seule, sans frais L1 data) :");
    for (const g of gweiHints) {
        const gasPriceWei = ethers.parseUnits(g.toString(), "gwei");
        const costWei = totalGas * gasPriceWei;
        console.log(`    @ ${g} gwei  ->  ~${fmtEth(costWei)} ETH`);
    }
    console.log("");
    console.log("  Sur Base, ajouter la composante L1 si applicable (voir explorateur).");
}

main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
});
