/**
 * Cohérence : déploiement token / presale / registre bonus ↔ SDK (@ghost-protocol/sdk).
 *
 * Modes d'achat on-chain (même _buy interne) :
 *   1) receive() / buy() — wallet EVM
 *   2) buyTokensGhost — Schnorr + recipient
 * Après finalize : claim() ; claimGhost() + prepareClaimPresaleGhost (cohérence SDK)
 * Remboursement volontaire : réservé aux autres fichiers de test (GhostEcosystem) ; ici rejet claimGhost si achat non-Ghost
 *
 * npx hardhat test --config hardhat-ghost-token.config.ts tests/PresaleSdkCoherence.test.ts
 */
import { expect } from "chai";
import { ethers } from "hardhat";
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import {
    computePresaleBonusCredentialId,
    DEFAULT_BONUS_CREDENTIAL_DOMAIN,
} from "../sdk/src/presaleBonus";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).ethers = ethers;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const GhostSchnorr = require("../ghost-schnorr-libz.js");

const CRED_STRING = "GhostPresaleBonusRegistry.v1";

describe("Presale — cohérence SDK ↔ contrats (achat wallet / Ghost + claim)", function () {
    async function deployFx() {
        const [deployer, admin, buyer] = await ethers.getSigners();
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
        const registry = await Reg.deploy(pAddr, 500, DEFAULT_BONUS_CREDENTIAL_DOMAIN);
        await registry.waitForDeployment();

        return { token, presale, registry, admin, buyer, start, end, ghostPerEth, pAddr, mockGp };
    }

    it("DEFAULT_BONUS_CREDENTIAL_DOMAIN du SDK = domaine attendu du contrat", function () {
        const manual = ethers.keccak256(ethers.toUtf8Bytes(CRED_STRING));
        expect(DEFAULT_BONUS_CREDENTIAL_DOMAIN).to.equal(manual);
    });

    it("achat via receive() puis via buy() : même _buy — cumul contributions / allocation", async function () {
        const { presale, buyer, start, ghostPerEth, pAddr } = await loadFixture(deployFx);
        await time.setNextBlockTimestamp(Number(start + 1n));

        const v1 = ethers.parseEther("1");
        const v2 = ethers.parseEther("0.5");

        await buyer.sendTransaction({ to: pAddr, value: v1 });
        await presale.connect(buyer).buy({ value: v2 });

        const ethTotal = v1 + v2;
        const ghostExpected = (ethTotal * ghostPerEth) / ethers.parseEther("1");

        expect(await presale.contributions(buyer.address)).to.equal(ethTotal);
        expect(await presale.tokenAllocation(buyer.address)).to.equal(ghostExpected);
    });

    it("après finalize + claim : credentialId SDK === credentialIdOnChain (registry)", async function () {
        const { presale, registry, admin, buyer, start, end, ghostPerEth, pAddr } =
            await loadFixture(deployFx);
        await time.setNextBlockTimestamp(Number(start + 1n));

        await buyer.sendTransaction({ to: pAddr, value: ethers.parseEther("2") });
        const ghostAmt = (ethers.parseEther("2") * ghostPerEth) / ethers.parseEther("1");

        await time.setNextBlockTimestamp(Number(end + 1n));
        await presale.connect(admin).finalize();
        await presale.connect(buyer).claim();

        const network = await ethers.provider.getNetwork();
        const chainId = network.chainId;

        const sdkCid = computePresaleBonusCredentialId({
            buyer: buyer.address,
            ghostPurchasedWei: ghostAmt,
            presaleAddress: pAddr,
            chainId,
            credentialDomainSeparator: DEFAULT_BONUS_CREDENTIAL_DOMAIN,
        });

        await registry.recordEligibility(buyer.address);
        const onChainCid = await registry.credentialIdOf(buyer.address);

        expect(sdkCid).to.equal(onChainCid);

        const ev = await registry.filters.EligibilityRecorded(buyer.address);
        const logs = await registry.queryFilter(ev);
        expect(logs.length).to.equal(1);
        expect(logs[0]!.args!.credentialId).to.equal(sdkCid);
    });

    it("sécurité : recordEligibility impossible sans claim (même si achat via receive)", async function () {
        const { presale, registry, buyer, start, pAddr } = await loadFixture(deployFx);
        await time.setNextBlockTimestamp(Number(start + 1n));
        await buyer.sendTransaction({ to: pAddr, value: ethers.parseEther("1") });
        await expect(registry.recordEligibility(buyer.address)).to.be.revertedWithCustomError(
            registry,
            "GhostPresaleBonusRegistry__NotEligible"
        );
    });

    it("sécurité : recordEligibility refusé après remboursement volontaire (ethContrib = 0)", async function () {
        const { presale, registry, buyer, start } = await loadFixture(deployFx);
        await time.setNextBlockTimestamp(Number(start + 1n));
        await presale.connect(buyer).buy({ value: ethers.parseEther("1") });
        await presale.connect(buyer).remboursementVolontaire();
        await expect(registry.recordEligibility(buyer.address)).to.be.revertedWithCustomError(
            registry,
            "GhostPresaleBonusRegistry__NotEligible"
        );
    });

    it("buy() seul (sans receive) : même formule credentialId SDK", async function () {
        const { presale, registry, admin, buyer, start, end, ghostPerEth, pAddr } =
            await loadFixture(deployFx);
        await time.setNextBlockTimestamp(Number(start + 1n));

        await presale.connect(buyer).buy({ value: ethers.parseEther("1.25") });
        const ghostAmt = (ethers.parseEther("1.25") * ghostPerEth) / ethers.parseEther("1");

        await time.setNextBlockTimestamp(Number(end + 1n));
        await presale.connect(admin).finalize();
        await presale.connect(buyer).claim();

        const network = await ethers.provider.getNetwork();
        const sdkCid = computePresaleBonusCredentialId({
            buyer: buyer.address,
            ghostPurchasedWei: ghostAmt,
            presaleAddress: pAddr,
            chainId: network.chainId,
            credentialDomainSeparator: DEFAULT_BONUS_CREDENTIAL_DOMAIN,
        });

        await registry.recordEligibility(buyer.address);
        expect(await registry.credentialIdOf(buyer.address)).to.equal(sdkCid);
    });

    it("buyTokensGhost : crédit sur recipient, nonce pseudo1, événement PurchaseViaGhostProtocol", async function () {
        const { presale, mockGp, buyer, start, end, ghostPerEth, pAddr } = await loadFixture(deployFx);
        const pseudo1 = "sdk_presale_ghost_1";
        const acc = GhostSchnorr.prepareCreateAccount(pseudo1, "p2secret_x", "k1secret_y", "k2secret_z");
        await mockGp.register(pseudo1, acc.pseudo2Commit, acc.key1Commit, acc.key2Commit);

        const signers = await ethers.getSigners();
        const recipient = signers[5]!.address;
        const ethAmt = ethers.parseEther("0.25");
        const deadline = BigInt(end) + 10_000n;
        const net = await ethers.provider.getNetwork();
        const proofs = GhostSchnorr.prepareBuyPresaleGhost(
            acc._keys,
            pseudo1,
            recipient,
            ethAmt,
            0n,
            deadline,
            pAddr,
            net.chainId
        );
        const pseudoHash = ethers.keccak256(ethers.toUtf8Bytes(pseudo1));
        const ghostExpected = (ethAmt * ghostPerEth) / ethers.parseEther("1");

        await time.setNextBlockTimestamp(Number(start + 1n));
        await expect(
            presale.connect(buyer).buyTokensGhost(
                pseudo1,
                recipient,
                deadline,
                acc.pseudo2Commit,
                acc.key1Commit,
                acc.key2Commit,
                proofs.proofPseudo2,
                proofs.proofKey1,
                { value: ethAmt }
            )
        )
            .to.emit(presale, "PurchaseViaGhostProtocol")
            .withArgs(pseudoHash, recipient, ethAmt, ghostExpected);

        expect(await presale.contributions(recipient)).to.equal(ethAmt);
        expect(await presale.contributions(buyer.address)).to.equal(0n);
        expect(await presale.tokenAllocation(recipient)).to.equal(ghostExpected);
        expect(await presale.ghostPresaleNonceByPseudoHash(pseudoHash)).to.equal(1n);
        expect(await presale.ghostPurchasePseudo1Hash(recipient)).to.equal(pseudoHash);
    });

    it("buyTokensGhost : second achat même recipient exige le même pseudo1", async function () {
        const { presale, mockGp, buyer, start, end, ghostPerEth, pAddr } = await loadFixture(deployFx);
        const pseudo1a = "ghost_same_rec_a";
        const pseudo1b = "ghost_same_rec_b";
        const accA = GhostSchnorr.prepareCreateAccount(pseudo1a, "p2a", "k1a", "k2a");
        const accB = GhostSchnorr.prepareCreateAccount(pseudo1b, "p2b", "k1b", "k2b");
        await mockGp.register(pseudo1a, accA.pseudo2Commit, accA.key1Commit, accA.key2Commit);
        await mockGp.register(pseudo1b, accB.pseudo2Commit, accB.key1Commit, accB.key2Commit);

        const signers = await ethers.getSigners();
        const recipient = signers[5]!.address;
        const eth1 = ethers.parseEther("0.1");
        const eth2 = ethers.parseEther("0.05");
        const deadline = BigInt(end) + 12_000n;
        const net = await ethers.provider.getNetwork();

        const p1 = GhostSchnorr.prepareBuyPresaleGhost(
            accA._keys,
            pseudo1a,
            recipient,
            eth1,
            0n,
            deadline,
            pAddr,
            net.chainId
        );
        await time.setNextBlockTimestamp(Number(start + 1n));
        await presale.connect(buyer).buyTokensGhost(
            pseudo1a,
            recipient,
            deadline,
            accA.pseudo2Commit,
            accA.key1Commit,
            accA.key2Commit,
            p1.proofPseudo2,
            p1.proofKey1,
            { value: eth1 }
        );

        const p2 = GhostSchnorr.prepareBuyPresaleGhost(
            accB._keys,
            pseudo1b,
            recipient,
            eth2,
            0n,
            deadline,
            pAddr,
            net.chainId
        );
        await expect(
            presale.connect(buyer).buyTokensGhost(
                pseudo1b,
                recipient,
                deadline,
                accB.pseudo2Commit,
                accB.key1Commit,
                accB.key2Commit,
                p2.proofPseudo2,
                p2.proofKey1,
                { value: eth2 }
            )
        ).to.be.revertedWith("GhostPresale: pseudo1 mismatch recipient");
    });

    it("claimGhost après buyTokensGhost : Schnorr + jetons vers payout (gas = wallet séparé)", async function () {
        const { token, presale, mockGp, buyer, admin, start, end, ghostPerEth, pAddr } =
            await loadFixture(deployFx);
        const pseudo1 = "sdk_presale_ghost_claim";
        const acc = GhostSchnorr.prepareCreateAccount(pseudo1, "p2c_x", "k1c_y", "k2c_z");
        await mockGp.register(pseudo1, acc.pseudo2Commit, acc.key1Commit, acc.key2Commit);

        const signers = await ethers.getSigners();
        const recipient = signers[5]!.address;
        const payout = signers[6]!.address;
        const ethAmt = ethers.parseEther("0.4");
        const buyDeadline = BigInt(end) + 20_000n;
        const net = await ethers.provider.getNetwork();
        const buyProofs = GhostSchnorr.prepareBuyPresaleGhost(
            acc._keys,
            pseudo1,
            recipient,
            ethAmt,
            0n,
            buyDeadline,
            pAddr,
            net.chainId
        );

        await time.setNextBlockTimestamp(Number(start + 1n));
        await presale.connect(buyer).buyTokensGhost(
            pseudo1,
            recipient,
            buyDeadline,
            acc.pseudo2Commit,
            acc.key1Commit,
            acc.key2Commit,
            buyProofs.proofPseudo2,
            buyProofs.proofKey1,
            { value: ethAmt }
        );

        const ghostExpected = (ethAmt * ghostPerEth) / ethers.parseEther("1");
        expect(await presale.allocationFromGhostPurchase(recipient)).to.equal(true);

        await time.setNextBlockTimestamp(Number(end + 1n));
        await presale.connect(admin).finalize();

        const claimDeadline = BigInt(end) + 50_000n;
        const claimNonce = 0n;
        const claimProofs = GhostSchnorr.prepareClaimPresaleGhost(
            acc._keys,
            pseudo1,
            recipient,
            payout,
            claimNonce,
            claimDeadline,
            pAddr,
            net.chainId
        );

        const balBefore = await token.balanceOf(payout);
        await presale.connect(buyer).claimGhost(
            pseudo1,
            recipient,
            payout,
            claimDeadline,
            acc.pseudo2Commit,
            acc.key1Commit,
            acc.key2Commit,
            claimProofs.proofPseudo2,
            claimProofs.proofKey1
        );
        expect(await token.balanceOf(payout)).to.equal(balBefore + ghostExpected);
        expect(await presale.claimed(recipient)).to.equal(true);
    });

    it("claimGhost refusé pour achat wallet classique (buy)", async function () {
        const fx = await loadFixture(deployFx);
        const { presale, mockGp, buyer, admin, start, end, pAddr } = fx;
        const pseudo1 = "classic_buyer_pseudo";
        const acc = GhostSchnorr.prepareCreateAccount(pseudo1, "p2x", "k1y", "k2z");
        await mockGp.register(pseudo1, acc.pseudo2Commit, acc.key1Commit, acc.key2Commit);

        await time.setNextBlockTimestamp(Number(start + 1n));
        await presale.connect(buyer).buy({ value: ethers.parseEther("1") });

        await time.setNextBlockTimestamp(Number(end + 1n));
        await presale.connect(admin).finalize();

        const net = await ethers.provider.getNetwork();
        const claimDeadline = BigInt(end) + 99_000n;
        const claimProofs = GhostSchnorr.prepareClaimPresaleGhost(
            acc._keys,
            pseudo1,
            buyer.address,
            buyer.address,
            0n,
            claimDeadline,
            pAddr,
            net.chainId
        );

        await expect(
            presale.connect(buyer).claimGhost(
                pseudo1,
                buyer.address,
                buyer.address,
                claimDeadline,
                acc.pseudo2Commit,
                acc.key1Commit,
                acc.key2Commit,
                claimProofs.proofPseudo2,
                claimProofs.proofKey1
            )
        ).to.be.revertedWith("GhostPresale: claimGhost reserve achat Ghost");
    });

    it("après buyTokensGhost : claim() classique depuis recipient reste valide", async function () {
        const { token, presale, mockGp, buyer, admin, start, end, ghostPerEth, pAddr } =
            await loadFixture(deployFx);
        const pseudo1 = "sdk_ghost_then_claim_evm";
        const acc = GhostSchnorr.prepareCreateAccount(pseudo1, "p2e", "k1e", "k2e");
        await mockGp.register(pseudo1, acc.pseudo2Commit, acc.key1Commit, acc.key2Commit);
        const signers = await ethers.getSigners();
        const recipient = signers[7]!;
        const ethAmt = ethers.parseEther("0.1");
        const buyDeadline = BigInt(end) + 15_000n;
        const net = await ethers.provider.getNetwork();
        const buyProofs = GhostSchnorr.prepareBuyPresaleGhost(
            acc._keys,
            pseudo1,
            recipient.address,
            ethAmt,
            0n,
            buyDeadline,
            pAddr,
            net.chainId
        );
        await time.setNextBlockTimestamp(Number(start + 1n));
        await presale.connect(buyer).buyTokensGhost(
            pseudo1,
            recipient.address,
            buyDeadline,
            acc.pseudo2Commit,
            acc.key1Commit,
            acc.key2Commit,
            buyProofs.proofPseudo2,
            buyProofs.proofKey1,
            { value: ethAmt }
        );
        const ghostExpected = (ethAmt * ghostPerEth) / ethers.parseEther("1");
        await time.setNextBlockTimestamp(Number(end + 1n));
        await presale.connect(admin).finalize();
        const balBefore = await token.balanceOf(recipient.address);
        await presale.connect(recipient).claim();
        expect(await token.balanceOf(recipient.address)).to.equal(balBefore + ghostExpected);
    });

    it("recordEligibilityWithPseudo : vérifie pseudo1 vs presale et remplit la liste bonus", async function () {
        const { token, presale, registry, mockGp, buyer, admin, start, end, ghostPerEth, pAddr } =
            await loadFixture(deployFx);
        const pseudo1 = "bonus_list_pseudo_x";
        const acc = GhostSchnorr.prepareCreateAccount(pseudo1, "p2bl", "k1bl", "k2bl");
        await mockGp.register(pseudo1, acc.pseudo2Commit, acc.key1Commit, acc.key2Commit);

        const signers = await ethers.getSigners();
        const recipient = signers[8]!;
        const ethAmt = ethers.parseEther("0.15");
        const buyDeadline = BigInt(end) + 18_000n;
        const net = await ethers.provider.getNetwork();
        const buyProofs = GhostSchnorr.prepareBuyPresaleGhost(
            acc._keys,
            pseudo1,
            recipient.address,
            ethAmt,
            0n,
            buyDeadline,
            pAddr,
            net.chainId
        );

        await time.setNextBlockTimestamp(Number(start + 1n));
        await presale.connect(buyer).buyTokensGhost(
            pseudo1,
            recipient.address,
            buyDeadline,
            acc.pseudo2Commit,
            acc.key1Commit,
            acc.key2Commit,
            buyProofs.proofPseudo2,
            buyProofs.proofKey1,
            { value: ethAmt }
        );

        await time.setNextBlockTimestamp(Number(end + 1n));
        await presale.connect(admin).finalize();
        await presale.connect(recipient).claim();

        await expect(registry.recordEligibilityWithPseudo(recipient.address, "wrong_pseudo")).to.be.revertedWithCustomError(
            registry,
            "GhostPresaleBonusRegistry__PseudoMismatch"
        );

        await registry.recordEligibilityWithPseudo(recipient.address, pseudo1);
        expect(await registry.pseudo1BonusListLength()).to.equal(1n);
        expect(await registry.pseudo1BonusListAt(0)).to.equal(pseudo1);
        expect(await registry.pseudo1HashBonusListed(ethers.keccak256(ethers.toUtf8Bytes(pseudo1)))).to.equal(true);

        const ghostAmt = (ethAmt * ghostPerEth) / ethers.parseEther("1");
        expect(await registry.bonusGhostAmount(recipient.address)).to.equal((ghostAmt * 500n) / 10_000n);
    });
});
