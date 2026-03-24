/**
 * Tests Hardhat — GhostToken, GhostPresale, GhostVesting, GhostTimelock
 * Lancer : npm run test:token  (ou npx hardhat test --config hardhat-ghost-token.config.ts)
 * Complété par GhostExtensive.test.ts — cible ≥ 100 tests au total.
 */
import { expect } from "chai";
import { ethers } from "hardhat";
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("GhostToken", function () {
    async function deployToken() {
        const [deployer, alice] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("GhostToken");
        const token = await Token.deploy();
        await token.waitForDeployment();
        const addr = await token.getAddress();
        return { token, deployer, alice, addr };
    }

    it("mint unique : tout le supply sur le déployeur", async function () {
        const { token, deployer } = await loadFixture(deployToken);
        const bal = await token.balanceOf(deployer.address);
        expect(bal).to.equal(await token.TOTAL_SUPPLY());
    });

    it("constantes tokenomics cohérentes avec 33 M", async function () {
        const { token } = await loadFixture(deployToken);
        const sum =
            (await token.AIRDROP_ALLOC()) +
            (await token.TREASURY_ALLOC()) +
            (await token.TEAM_ALLOC()) +
            (await token.REWARDS_ALLOC()) +
            (await token.LIQUIDITY_ALLOC()) +
            (await token.PRIVATE_SALE_ALLOC());
        expect(sum).to.equal(await token.TOTAL_SUPPLY());
    });
});

describe("GhostPresale", function () {
    async function presaleFixture(softCapEth: bigint = 0n) {
        const [deployer, admin, buyer1, buyer2, buyer3, stranger] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("GhostToken");
        const token = await Token.deploy();
        await token.waitForDeployment();
        const tokenAddr = await token.getAddress();

        const latest = await ethers.provider.getBlock("latest");
        const start = BigInt(latest!.timestamp) + 100n;
        const end = start + 7n * 24n * 3600n;
        /** 1000 GHOST par 1 ETH — calculs simples */
        const ghostPerEth = ethers.parseUnits("1000", 18);
        const hardCapEth = ethers.parseEther("100");
        const maxPerWallet = ethers.parseEther("50");

        const MockGp = await ethers.getContractFactory("MockGhostProtocolV2ForPresale");
        const mockGp = await MockGp.deploy();
        await mockGp.waitForDeployment();
        const gpAddr = await mockGp.getAddress();

        const Presale = await ethers.getContractFactory("GhostPresale");
        const presale = await Presale.deploy(
            tokenAddr,
            admin.address,
            admin.address,
            gpAddr,
            ghostPerEth,
            softCapEth,
            hardCapEth,
            maxPerWallet,
            start,
            end
        );
        await presale.waitForDeployment();
        const presaleAddr = await presale.getAddress();

        const saleAmount = await token.PRIVATE_SALE_ALLOC();
        await token.transfer(presaleAddr, saleAmount);

        return {
            token,
            presale,
            presaleAddr,
            deployer,
            admin,
            buyer1,
            buyer2,
            buyer3,
            stranger,
            start,
            end,
            ghostPerEth,
            hardCapEth,
            maxPerWallet,
            saleAmount,
        };
    }

    /** Fixtures nommées (loadFixture n’accepte pas de lambdas anonymes) */
    async function fixturePresaleNoSoftCap() {
        return presaleFixture(0n);
    }
    async function fixturePresaleRefundPath() {
        return presaleFixture(ethers.parseEther("10"));
    }

    it("rejette un constructeur si start dans le passé", async function () {
        const [deployer, admin] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("GhostToken");
        const token = await Token.deploy();
        await token.waitForDeployment();
        const latest = await ethers.provider.getBlock("latest");
        const past = BigInt(latest!.timestamp) - 10n;
        const MockGp = await ethers.getContractFactory("MockGhostProtocolV2ForPresale");
        const mockGp = await MockGp.deploy();
        await mockGp.waitForDeployment();
        const gpAddr = await mockGp.getAddress();
        const Presale = await ethers.getContractFactory("GhostPresale");
        await expect(
            Presale.deploy(
                await token.getAddress(),
                admin.address,
                admin.address,
                gpAddr,
                ethers.parseUnits("1", 18),
                0,
                ethers.parseEther("1"),
                ethers.parseEther("1"),
                past,
                past + 1000n
            )
        ).to.be.revertedWith("GhostPresale: debut dans le passe");
    });

    it("rejette un achat avant startTime", async function () {
        const { presale, buyer1 } = await loadFixture(fixturePresaleNoSoftCap);
        await expect(presale.connect(buyer1).buy({ value: ethers.parseEther("1") })).to.be.revertedWith(
            "GhostPresale: pas encore commence"
        );
    });

    it("achat → finalize → claim : l’acheteur reçoit les GHOST", async function () {
        const ctx = await loadFixture(fixturePresaleNoSoftCap);
        const { presale, token, buyer1, admin, start, end } = ctx;

        await time.setNextBlockTimestamp(Number(start + 1n));
        await presale.connect(buyer1).buy({ value: ethers.parseEther("2") });

        const expectedGhost = (ethers.parseEther("2") * ctx.ghostPerEth) / ethers.parseEther("1");
        expect(await presale.tokenAllocation(buyer1.address)).to.equal(expectedGhost);

        await time.setNextBlockTimestamp(Number(end + 1n));
        await presale.connect(admin).finalize();

        const balBefore = await token.balanceOf(buyer1.address);
        await presale.connect(buyer1).claim();
        expect(await token.balanceOf(buyer1.address)).to.equal(balBefore + expectedGhost);

        await expect(presale.connect(buyer1).claim()).to.be.revertedWith("GhostPresale: deja reclame");
    });

    it("respecte le hard cap ETH", async function () {
        const ctx = await loadFixture(fixturePresaleNoSoftCap);
        const { presale, buyer1, buyer2, buyer3, start, hardCapEth } = ctx;

        await time.setNextBlockTimestamp(Number(start + 1n));
        const half = hardCapEth / 2n;
        await presale.connect(buyer1).buy({ value: half });
        await presale.connect(buyer2).buy({ value: half });

        await expect(presale.connect(buyer3).buy({ value: 1n })).to.be.revertedWith(
            "GhostPresale: hardcap atteint"
        );
    });

    it("respecte maxPerWallet", async function () {
        const ctx = await loadFixture(fixturePresaleNoSoftCap);
        const { presale, buyer1, start, maxPerWallet } = ctx;

        await time.setNextBlockTimestamp(Number(start + 1n));
        await presale.connect(buyer1).buy({ value: maxPerWallet });
        await expect(presale.connect(buyer1).buy({ value: 1n })).to.be.revertedWith(
            "GhostPresale: limite wallet depassee"
        );
    });

    it("finalize possible avant endTime si hard cap atteint", async function () {
        const ctx = await loadFixture(fixturePresaleNoSoftCap);
        const { presale, buyer1, buyer2, admin, start, hardCapEth } = ctx;

        await time.setNextBlockTimestamp(Number(start + 1n));
        await presale.connect(buyer1).buy({ value: hardCapEth / 2n });
        await presale.connect(buyer2).buy({ value: hardCapEth - hardCapEth / 2n });

        const adminEthBefore = await ethers.provider.getBalance(admin.address);
        const tx = await presale.connect(admin).finalize();
        const receipt = await tx.wait();
        const gas = receipt!.fee;

        expect(await presale.finalized()).to.equal(true);
        expect(await ethers.provider.getBalance(await presale.getAddress())).to.equal(0n);
        /** Admin a reçu les ETH (moins le gas qu’il a payé pour finalize) */
        expect(await ethers.provider.getBalance(admin.address)).to.be.gt(adminEthBefore - gas);
    });

    it("mode remboursement : enableRefundMode puis refund()", async function () {
        const ctx = await loadFixture(fixturePresaleRefundPath);
        const { presale, buyer1, admin, start, end } = ctx;

        await time.setNextBlockTimestamp(Number(start + 1n));
        const paid = ethers.parseEther("1");
        await presale.connect(buyer1).buy({ value: paid });

        await time.setNextBlockTimestamp(Number(end + 1n));
        await presale.connect(admin).enableRefundMode();

        const balBefore = await ethers.provider.getBalance(buyer1.address);
        const tx = await presale.connect(buyer1).refund();
        const receipt = await tx.wait();
        const gas = receipt!.fee;
        expect(await ethers.provider.getBalance(buyer1.address)).to.equal(balBefore + paid - gas);

        await expect(presale.connect(buyer1).refund()).to.be.revertedWith("GhostPresale: deja rembourse");
    });

    it("recoverUnsoldTokens : admin récupère uniquement le GHOST restant après claim", async function () {
        const ctx = await loadFixture(fixturePresaleNoSoftCap);
        const { presale, token, admin, buyer1, start, end, saleAmount } = ctx;

        await time.setNextBlockTimestamp(Number(start + 1n));
        await presale.connect(buyer1).buy({ value: ethers.parseEther("1") });

        await time.setNextBlockTimestamp(Number(end + 1n));
        await presale.connect(admin).finalize();

        const sold = await presale.totalTokensSold();
        await presale.connect(buyer1).claim();

        const expectedLeft = saleAmount - sold;
        const adminBalBefore = await token.balanceOf(admin.address);
        await presale.connect(admin).recoverUnsoldTokens();
        expect(await token.balanceOf(admin.address)).to.equal(adminBalBefore + expectedLeft);
    });

    it("rejette claim si pas finalize", async function () {
        const ctx = await loadFixture(fixturePresaleNoSoftCap);
        const { presale, buyer1, start } = ctx;
        await time.setNextBlockTimestamp(Number(start + 1n));
        await presale.connect(buyer1).buy({ value: ethers.parseEther("1") });
        await expect(presale.connect(buyer1).claim()).to.be.revertedWith("GhostPresale: pas encore finalise");
    });

    it("remboursementVolontaire : pendant la prévente, ETH rendu et allocation GHOST annulée", async function () {
        const ctx = await loadFixture(fixturePresaleNoSoftCap);
        const { presale, buyer1, start } = ctx;
        const paid = ethers.parseEther("3");

        await time.setNextBlockTimestamp(Number(start + 1n));
        await presale.connect(buyer1).buy({ value: paid });

        const expectedGhost = (paid * ctx.ghostPerEth) / ethers.parseEther("1");
        expect(await presale.tokenAllocation(buyer1.address)).to.equal(expectedGhost);
        expect(await presale.totalRaisedEth()).to.equal(paid);
        expect(await presale.totalTokensSold()).to.equal(expectedGhost);

        const balBefore = await ethers.provider.getBalance(buyer1.address);
        const tx = await presale.connect(buyer1).remboursementVolontaire();
        const receipt = await tx.wait();
        const gas = receipt!.fee;

        expect(await ethers.provider.getBalance(buyer1.address)).to.equal(balBefore + paid - gas);
        expect(await presale.contributions(buyer1.address)).to.equal(0n);
        expect(await presale.tokenAllocation(buyer1.address)).to.equal(0n);
        expect(await presale.totalRaisedEth()).to.equal(0n);
        expect(await presale.totalTokensSold()).to.equal(0n);
    });

    it("remboursementVolontaire : refus après endTime (prévente terminée → claim après finalize)", async function () {
        const ctx = await loadFixture(fixturePresaleNoSoftCap);
        const { presale, buyer1, start, end } = ctx;
        const paid = ethers.parseEther("1");

        await time.setNextBlockTimestamp(Number(start + 1n));
        await presale.connect(buyer1).buy({ value: paid });
        await time.setNextBlockTimestamp(Number(end + 1n));

        await expect(presale.connect(buyer1).remboursementVolontaire()).to.be.revertedWith(
            "GhostPresale: prevente terminee"
        );
        expect(await presale.totalRaisedEth()).to.equal(paid);

        /** Fenêtre terminée : plus d'achat */
        await expect(presale.connect(buyer1).buy({ value: paid })).to.be.revertedWith("GhostPresale: termine");
    });

    it("remboursementVolontaire : rejet si finalisé", async function () {
        const ctx = await loadFixture(fixturePresaleNoSoftCap);
        const { presale, buyer1, admin, start, end } = ctx;

        await time.setNextBlockTimestamp(Number(start + 1n));
        await presale.connect(buyer1).buy({ value: ethers.parseEther("1") });
        await time.setNextBlockTimestamp(Number(end + 1n));
        await presale.connect(admin).finalize();

        await expect(presale.connect(buyer1).remboursementVolontaire()).to.be.revertedWith(
            "GhostPresale: deja finalise"
        );
    });

    it("remboursementVolontaire : rejet en refundMode (utiliser refund)", async function () {
        const ctx = await loadFixture(fixturePresaleRefundPath);
        const { presale, buyer1, admin, start, end } = ctx;

        await time.setNextBlockTimestamp(Number(start + 1n));
        await presale.connect(buyer1).buy({ value: ethers.parseEther("1") });
        await time.setNextBlockTimestamp(Number(end + 1n));
        await presale.connect(admin).enableRefundMode();

        await expect(presale.connect(buyer1).remboursementVolontaire()).to.be.revertedWith(
            "GhostPresale: utiliser refund()"
        );
    });
});

describe("GhostVesting", function () {
    async function vestingFixture() {
        const [deployer, beneficiary] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("GhostToken");
        const token = await Token.deploy();
        await token.waitForDeployment();
        const tokenAddr = await token.getAddress();

        const latest = await ethers.provider.getBlock("latest");
        const start = BigInt(latest!.timestamp);
        const cliffSec = 10n;
        const durationSec = 100n;
        const totalAmount = ethers.parseEther("1000");

        const Vesting = await ethers.getContractFactory("GhostVesting");
        const vesting = await Vesting.deploy(
            tokenAddr,
            beneficiary.address,
            start,
            cliffSec,
            durationSec,
            totalAmount
        );
        await vesting.waitForDeployment();
        const vAddr = await vesting.getAddress();
        await token.transfer(vAddr, totalAmount);

        return { token, vesting, vAddr, beneficiary, deployer, start, cliffSec, durationSec, totalAmount };
    }

    it("0 libérable avant la cliff", async function () {
        const { vesting, start } = await loadFixture(vestingFixture);
        await time.setNextBlockTimestamp(Number(start + 5n));
        expect(await vesting.releasable()).to.equal(0n);
    });

    it("libération linéaire après cliff : montant = vestedAmount(timestamp du bloc de release)", async function () {
        const { vesting, beneficiary, token, start, cliffSec, durationSec, totalAmount } =
            await loadFixture(vestingFixture);

        const t = start + cliffSec + durationSec / 3n;
        await time.increaseTo(Number(t));

        const bb = await token.balanceOf(beneficiary.address);
        const tx = await vesting.connect(beneficiary).release();
        const rec = await tx.wait();
        const block = await ethers.provider.getBlock(rec!.blockNumber!);
        const tsBlock = BigInt(block!.timestamp);

        expect(tsBlock >= start + cliffSec).to.equal(true);
        const iface = vesting.interface;
        const releasedTopic = iface.getEvent("Released")!.topicHash;
        const log = rec!.logs.find((l) => l.topics[0] === releasedTopic);
        expect(log).to.not.be.undefined;
        const parsed = iface.parseLog(log!);
        const amount = parsed!.args.amount as bigint;

        const expectedVested = (totalAmount * (tsBlock - start)) / durationSec;
        expect(amount).to.equal(expectedVested);
        expect(await vesting.vestedAmount(tsBlock)).to.equal(expectedVested);
        expect(await token.balanceOf(beneficiary.address)).to.equal(bb + amount);
    });

    it("un tiers peut appeler release() : les tokens vont au bénéficiaire", async function () {
        const { vesting, beneficiary, deployer, token, start, cliffSec, durationSec, totalAmount } =
            await loadFixture(vestingFixture);

        const t = start + cliffSec + durationSec / 2n;
        await time.increaseTo(Number(t));

        const bb = await token.balanceOf(beneficiary.address);
        const tx = await vesting.connect(deployer).release();
        const rec = await tx.wait();
        const block = await ethers.provider.getBlock(rec!.blockNumber!);
        const tsBlock = BigInt(block!.timestamp);

        const iface = vesting.interface;
        const releasedTopic = iface.getEvent("Released")!.topicHash;
        const log = rec!.logs.find((l) => l.topics[0] === releasedTopic);
        expect(log).to.not.be.undefined;
        const parsed = iface.parseLog(log!);
        const amount = parsed!.args.amount as bigint;

        expect(amount > 0n).to.equal(true);
        expect(amount).to.equal((totalAmount * (tsBlock - start)) / durationSec);
        expect(await token.balanceOf(beneficiary.address)).to.equal(bb + amount);
    });
});

describe("GhostTimelock", function () {
    async function timelockFixture() {
        const [deployer, beneficiary, other] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("GhostToken");
        const token = await Token.deploy();
        await token.waitForDeployment();
        const tokenAddr = await token.getAddress();

        const latest = await ethers.provider.getBlock("latest");
        const releaseTime = BigInt(latest!.timestamp) + 1000n;

        const TL = await ethers.getContractFactory("GhostTimelock");
        const timelock = await TL.deploy(tokenAddr, beneficiary.address, releaseTime);
        await timelock.waitForDeployment();
        const tlAddr = await timelock.getAddress();

        const amount = ethers.parseEther("10000");
        await token.transfer(tlAddr, amount);

        return { token, timelock, tlAddr, beneficiary, other, releaseTime, amount };
    }

    it("rejette release avant releaseTime", async function () {
        const { timelock, beneficiary } = await loadFixture(timelockFixture);
        await expect(timelock.connect(beneficiary).release()).to.be.revertedWith(
            "GhostTimelock: tokens encore verrouilles"
        );
    });

    it("rejette release par un non-bénéficiaire", async function () {
        const { timelock, other, releaseTime } = await loadFixture(timelockFixture);
        await time.setNextBlockTimestamp(Number(releaseTime + 1n));
        await expect(timelock.connect(other).release()).to.be.revertedWith("GhostTimelock: pas le beneficiaire");
    });

    it("bénéficiaire retire tout après releaseTime", async function () {
        const { timelock, token, beneficiary, releaseTime, amount } = await loadFixture(timelockFixture);
        await time.setNextBlockTimestamp(Number(releaseTime + 1n));
        const bb = await token.balanceOf(beneficiary.address);
        await timelock.connect(beneficiary).release();
        expect(await token.balanceOf(beneficiary.address)).to.equal(bb + amount);
    });
});
