import { expect } from "chai";
import { ethers } from "hardhat";
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";

const CRED_DOMAIN = ethers.keccak256(ethers.toUtf8Bytes("GhostPresaleBonusRegistry.v1"));

describe("GhostPresaleBonusRegistry", function () {
    async function fx() {
        const [deployer, admin, buyer1, stranger] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("GhostToken");
        const token = await Token.deploy();
        await token.waitForDeployment();
        const latest = await ethers.provider.getBlock("latest");
        const start = BigInt(latest!.timestamp) + 100n;
        const end = start + 7n * 24n * 3600n;
        const ghostPerEth = ethers.parseUnits("1000", 18);
        const MockGp = await ethers.getContractFactory("MockGhostProtocolV2ForPresale");
        const mockGp = await MockGp.deploy();
        await mockGp.waitForDeployment();
        const gpAddr = await mockGp.getAddress();
        const Presale = await ethers.getContractFactory("GhostPresale");
        const presale = await Presale.deploy(
            await token.getAddress(),
            admin.address,
            admin.address,
            gpAddr,
            ghostPerEth,
            0n,
            ethers.parseEther("100"),
            ethers.parseEther("50"),
            start,
            end
        );
        await presale.waitForDeployment();
        const pAddr = await presale.getAddress();
        await token.transfer(pAddr, await token.PRIVATE_SALE_ALLOC());

        const Reg = await ethers.getContractFactory("GhostPresaleBonusRegistry");
        const registry = await Reg.deploy(pAddr, 500, CRED_DOMAIN);
        await registry.waitForDeployment();

        return { token, presale, registry, admin, buyer1, stranger, start, end, ghostPerEth };
    }

    it("rejette recordEligibility si pas claim", async function () {
        const { presale, registry, buyer1, start } = await loadFixture(fx);
        await time.setNextBlockTimestamp(Number(start + 1n));
        await presale.connect(buyer1).buy({ value: ethers.parseEther("1") });
        await expect(registry.recordEligibility(buyer1.address)).to.be.revertedWithCustomError(
            registry,
            "GhostPresaleBonusRegistry__NotEligible"
        );
    });

    it("après claim : enregistre, credentialId cohérent, bonus = 5 %", async function () {
        const { token, presale, registry, admin, buyer1, start, end, ghostPerEth } = await loadFixture(fx);
        await time.setNextBlockTimestamp(Number(start + 1n));
        await presale.connect(buyer1).buy({ value: ethers.parseEther("2") });
        const ghostAmt = (ethers.parseEther("2") * ghostPerEth) / ethers.parseEther("1");

        await time.setNextBlockTimestamp(Number(end + 1n));
        await presale.connect(admin).finalize();
        await presale.connect(buyer1).claim();

        const presaleAddr = await presale.getAddress();
        const chainId = (await ethers.provider.getNetwork()).chainId;
        const expectedCid = ethers.keccak256(
            ethers.solidityPacked(
                ["address", "uint256", "address", "uint256", "bytes32"],
                [buyer1.address, ghostAmt, presaleAddr, chainId, CRED_DOMAIN]
            )
        );

        await expect(registry.recordEligibility(buyer1.address))
            .to.emit(registry, "EligibilityRecorded")
            .withArgs(buyer1.address, ghostAmt, expectedCid);

        expect(await registry.registered(buyer1.address)).to.equal(true);
        expect(await registry.ghostPurchased(buyer1.address)).to.equal(ghostAmt);
        const bonus = (ghostAmt * 500n) / 10_000n;
        expect(await registry.bonusGhostAmount(buyer1.address)).to.equal(bonus);

        await expect(registry.recordEligibility(buyer1.address)).to.be.revertedWithCustomError(
            registry,
            "GhostPresaleBonusRegistry__AlreadyRegistered"
        );
    });

    it("consumeCredentialBinding une seule fois", async function () {
        const { presale, registry, admin, buyer1, start, end } = await loadFixture(fx);
        await time.setNextBlockTimestamp(Number(start + 1n));
        await presale.connect(buyer1).buy({ value: ethers.parseEther("1") });
        await time.setNextBlockTimestamp(Number(end + 1n));
        await presale.connect(admin).finalize();
        await presale.connect(buyer1).claim();
        await registry.recordEligibility(buyer1.address);

        const cid = await registry.credentialIdOf(buyer1.address);
        await expect(registry.connect(buyer1).consumeCredentialBinding())
            .to.emit(registry, "CredentialBindingConsumed")
            .withArgs(buyer1.address, cid);

        await expect(registry.connect(buyer1).consumeCredentialBinding()).to.be.revertedWithCustomError(
            registry,
            "GhostPresaleBonusRegistry__BindingAlreadyConsumed"
        );
    });

    it("stranger ne peut pas consume sans être enregistré", async function () {
        const { registry, stranger } = await loadFixture(fx);
        await expect(registry.connect(stranger).consumeCredentialBinding()).to.be.revertedWithCustomError(
            registry,
            "GhostPresaleBonusRegistry__NotRegistered"
        );
    });

    it("recordEligibilityWithPseudo : achat wallet — pseudo1 doit être vide", async function () {
        const { presale, registry, admin, buyer1, start, end } = await loadFixture(fx);
        await time.setNextBlockTimestamp(Number(start + 1n));
        await presale.connect(buyer1).buy({ value: ethers.parseEther("1") });
        await time.setNextBlockTimestamp(Number(end + 1n));
        await presale.connect(admin).finalize();
        await presale.connect(buyer1).claim();

        await expect(
            registry.recordEligibilityWithPseudo(buyer1.address, "nimporte")
        ).to.be.revertedWithCustomError(registry, "GhostPresaleBonusRegistry__PseudoMustBeEmpty");

        await registry.recordEligibilityWithPseudo(buyer1.address, "");
        expect(await registry.registered(buyer1.address)).to.equal(true);
    });
});
