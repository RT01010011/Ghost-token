import { expect } from "chai";
import { ethers } from "hardhat";
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("GhostPresaleWelcomeRegistry", function () {
    const WELCOME = ethers.parseEther("100");

    async function fx() {
        const [deployer, admin, payout, other] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("GhostToken");
        const token = await Token.deploy();
        await token.waitForDeployment();

        const MockGp = await ethers.getContractFactory("MockGhostProtocolV2ForPresale");
        const mockGp = await MockGp.deploy();
        await mockGp.waitForDeployment();
        const gpAddr = await mockGp.getAddress();

        const latest = await ethers.provider.getBlock("latest");
        const start = BigInt(latest!.timestamp) + 100n;
        const end = start + 7n * 24n * 3600n;

        const Presale = await ethers.getContractFactory("GhostPresale");
        const presale = await Presale.deploy(
            await token.getAddress(),
            admin.address,
            admin.address,
            gpAddr,
            ethers.parseUnits("1000", 18),
            0n,
            ethers.parseEther("100"),
            ethers.parseEther("1"),
            start,
            end
        );
        await presale.waitForDeployment();
        const pAddr = await presale.getAddress();

        const tge = end + 10n;
        const Welcome = await ethers.getContractFactory("GhostPresaleWelcomeRegistry");
        const welcome = await Welcome.deploy(
            await token.getAddress(),
            pAddr,
            gpAddr,
            admin.address,
            WELCOME,
            3300n,
            tge
        );
        await welcome.waitForDeployment();
        const wAddr = await welcome.getAddress();

        const fund = WELCOME * 5n;
        await token.transfer(wAddr, fund);

        return { token, presale, mockGp, welcome, deployer, admin, payout, other, start, end, tge, pAddr, wAddr };
    }

    it("recordWelcomeAccount : succès si création dans la fenêtre prévente", async function () {
        const { mockGp, welcome, admin, payout, start } = await loadFixture(fx);
        await time.setNextBlockTimestamp(Number(start + 10n));
        const c1 = ethers.keccak256(ethers.toUtf8Bytes("c1"));
        const c2 = ethers.keccak256(ethers.toUtf8Bytes("c2"));
        const c3 = ethers.keccak256(ethers.toUtf8Bytes("c3"));
        await mockGp.register("alice_presale", c1, c2, c3);

        await expect(welcome.connect(admin).recordWelcomeAccount("alice_presale", payout.address))
            .to.emit(welcome, "WelcomeRecorded")
            .withArgs(ethers.keccak256(ethers.toUtf8Bytes("alice_presale")), "alice_presale", payout.address);

        expect(await welcome.recordedCount()).to.equal(1n);
        const h = ethers.keccak256(ethers.toUtf8Bytes("alice_presale"));
        const e = await welcome.entries(h);
        expect(e.payout).to.equal(payout.address);
        expect(e.claimed).to.equal(false);
    });

    it("recordWelcomeAccount : revert si création hors fenêtre", async function () {
        const { mockGp, welcome, admin, payout, end } = await loadFixture(fx);
        await time.setNextBlockTimestamp(Number(end + 100n));
        const c1 = ethers.keccak256(ethers.toUtf8Bytes("a"));
        const c2 = ethers.keccak256(ethers.toUtf8Bytes("b"));
        const c3 = ethers.keccak256(ethers.toUtf8Bytes("c"));
        await mockGp.register("late_bob", c1, c2, c3);

        await expect(
            welcome.connect(admin).recordWelcomeAccount("late_bob", payout.address)
        ).to.be.revertedWithCustomError(welcome, "GhostWelcome__OutsidePresaleWindow");
    });

    it("claim : payout reçoit les GHOST après TGE", async function () {
        const { token, mockGp, welcome, admin, payout, start, tge } = await loadFixture(fx);
        await time.setNextBlockTimestamp(Number(start + 5n));
        const c1 = ethers.keccak256(ethers.toUtf8Bytes("x"));
        const c2 = ethers.keccak256(ethers.toUtf8Bytes("y"));
        const c3 = ethers.keccak256(ethers.toUtf8Bytes("z"));
        await mockGp.register("carol", c1, c2, c3);
        await welcome.connect(admin).recordWelcomeAccount("carol", payout.address);

        await expect(welcome.connect(payout).claim("carol")).to.be.revertedWithCustomError(welcome, "GhostWelcome__TooEarly");

        await time.setNextBlockTimestamp(Number(tge));
        const balBefore = await token.balanceOf(payout.address);
        await welcome.connect(payout).claim("carol");
        expect(await token.balanceOf(payout.address)).to.equal(balBefore + WELCOME);

        await expect(welcome.connect(payout).claim("carol")).to.be.revertedWithCustomError(
            welcome,
            "GhostWelcome__AlreadyClaimed"
        );
    });

    it("claim : interdit si msg.sender n’est pas payout", async function () {
        const { mockGp, welcome, admin, payout, other, start, tge } = await loadFixture(fx);
        await time.setNextBlockTimestamp(Number(start + 2n));
        const c1 = ethers.keccak256(ethers.toUtf8Bytes("1"));
        const c2 = ethers.keccak256(ethers.toUtf8Bytes("2"));
        const c3 = ethers.keccak256(ethers.toUtf8Bytes("3"));
        await mockGp.register("dave", c1, c2, c3);
        await welcome.connect(admin).recordWelcomeAccount("dave", payout.address);
        await time.setNextBlockTimestamp(Number(tge));

        await expect(welcome.connect(other).claim("dave")).to.be.revertedWithCustomError(welcome, "GhostWelcome__NotPayout");
    });
});
