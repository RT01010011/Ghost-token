/**
 * Suite étendue — objectif : couverture fine (getters, reverts, vues, chemins alternatifs).
 * Lancer avec : npx hardhat test --config hardhat-ghost-token.config.ts
 */
import { expect } from "chai";
import { ethers } from "hardhat";
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";

/** Récepteur ETH non nul pour tests où `admin` est address(0) */
const NON_ZERO_ETH_RECEIVER = "0x0000000000000000000000000000000000000001";

describe("GhostToken — étendu", function () {
    async function tokenFx() {
        const [deployer, a, b] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("GhostToken");
        const token = await Token.deploy();
        await token.waitForDeployment();
        return { token, deployer, a, b };
    }

    it("nom et symbole ERC20", async function () {
        const { token } = await loadFixture(tokenFx);
        expect(await token.name()).to.equal("Ghost Protocol");
        expect(await token.symbol()).to.equal("GHOST");
    });

    it("décimales = 18", async function () {
        const { token } = await loadFixture(tokenFx);
        expect(await token.decimals()).to.equal(18n);
    });

    it("TOTAL_SUPPLY vaut 33e6 * 1e18", async function () {
        const { token } = await loadFixture(tokenFx);
        expect(await token.TOTAL_SUPPLY()).to.equal(33_000_000n * 10n ** 18n);
    });

    it("AIRDROP_ALLOC = 20% du supply", async function () {
        const { token } = await loadFixture(tokenFx);
        const t = await token.TOTAL_SUPPLY();
        expect(await token.AIRDROP_ALLOC()).to.equal((t * 20n) / 100n);
    });

    it("TREASURY_ALLOC = 18% du supply", async function () {
        const { token } = await loadFixture(tokenFx);
        const t = await token.TOTAL_SUPPLY();
        expect(await token.TREASURY_ALLOC()).to.equal((t * 18n) / 100n);
    });

    it("TEAM_ALLOC = 17% du supply", async function () {
        const { token } = await loadFixture(tokenFx);
        const t = await token.TOTAL_SUPPLY();
        expect(await token.TEAM_ALLOC()).to.equal((t * 17n) / 100n);
    });

    it("REWARDS_ALLOC = 20% du supply", async function () {
        const { token } = await loadFixture(tokenFx);
        const t = await token.TOTAL_SUPPLY();
        expect(await token.REWARDS_ALLOC()).to.equal((t * 20n) / 100n);
    });

    it("LIQUIDITY_ALLOC = 10% du supply", async function () {
        const { token } = await loadFixture(tokenFx);
        const t = await token.TOTAL_SUPPLY();
        expect(await token.LIQUIDITY_ALLOC()).to.equal((t * 10n) / 100n);
    });

    it("PRIVATE_SALE_ALLOC = 15% du supply", async function () {
        const { token } = await loadFixture(tokenFx);
        const t = await token.TOTAL_SUPPLY();
        expect(await token.PRIVATE_SALE_ALLOC()).to.equal((t * 15n) / 100n);
    });

    it("transfer réduit l’émetteur et crédite le destinataire", async function () {
        const { token, deployer, a } = await loadFixture(tokenFx);
        const amt = ethers.parseEther("1000");
        await token.transfer(a.address, amt);
        expect(await token.balanceOf(a.address)).to.equal(amt);
        expect(await token.balanceOf(deployer.address)).to.equal((await token.TOTAL_SUPPLY()) - amt);
    });

    it("rejette transfer si solde insuffisant", async function () {
        const { token, a, b } = await loadFixture(tokenFx);
        await expect(token.connect(a).transfer(b.address, 1n)).to.be.revertedWithCustomError(
            token,
            "ERC20InsufficientBalance"
        );
    });

    it("approve + transferFrom", async function () {
        const { token, deployer, a, b } = await loadFixture(tokenFx);
        const amt = ethers.parseEther("50");
        await token.connect(deployer).approve(a.address, amt);
        expect(await token.allowance(deployer.address, a.address)).to.equal(amt);
        await token.connect(a).transferFrom(deployer.address, b.address, amt);
        expect(await token.balanceOf(b.address)).to.equal(amt);
    });

    it("totalSupply inchangé après transferts", async function () {
        const { token, deployer, a } = await loadFixture(tokenFx);
        const ts0 = await token.totalSupply();
        await token.transfer(a.address, ethers.parseEther("1"));
        expect(await token.totalSupply()).to.equal(ts0);
    });

    it("nonces(deployer) initial = 0", async function () {
        const { token, deployer } = await loadFixture(tokenFx);
        expect(await token.nonces(deployer.address)).to.equal(0n);
    });

    it("DOMAIN_SEPARATOR défini (permit)", async function () {
        const { token } = await loadFixture(tokenFx);
        const ds = await token.DOMAIN_SEPARATOR();
        expect(ds).to.not.equal(ethers.ZeroHash);
    });
});

describe("GhostPresale — constructeur & getters", function () {
    async function baseDeploy() {
        const [deployer, admin] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("GhostToken");
        const token = await Token.deploy();
        await token.waitForDeployment();
        const latest = await ethers.provider.getBlock("latest");
        const start = BigInt(latest!.timestamp) + 200n;
        const end = start + 86400n;
        const MockGp = await ethers.getContractFactory("MockGhostProtocolV2ForPresale");
        const mockGp = await MockGp.deploy();
        await mockGp.waitForDeployment();
        const gpAddr = await mockGp.getAddress();
        return { deployer, admin, token, start, end, gpAddr };
    }

    it("rejette token adresse zéro", async function () {
        const { admin, start, end, gpAddr } = await loadFixture(baseDeploy);
        const Presale = await ethers.getContractFactory("GhostPresale");
        await expect(
            Presale.deploy(ethers.ZeroAddress, admin.address, admin.address, gpAddr, 1n, 0n, ethers.parseEther("1"), 1n, start, end)
        ).to.be.revertedWith("GhostPresale: token zero");
    });

    it("rejette admin zéro", async function () {
        const { token, start, end, gpAddr } = await loadFixture(baseDeploy);
        const Presale = await ethers.getContractFactory("GhostPresale");
        await expect(
            Presale.deploy(
                await token.getAddress(),
                ethers.ZeroAddress,
                NON_ZERO_ETH_RECEIVER,
                gpAddr,
                1n,
                0n,
                ethers.parseEther("1"),
                1n,
                start,
                end
            )
        ).to.be.revertedWith("GhostPresale: admin zero");
    });

    it("rejette ethProceedsReceiver zéro", async function () {
        const { token, admin, start, end, gpAddr } = await loadFixture(baseDeploy);
        const Presale = await ethers.getContractFactory("GhostPresale");
        await expect(
            Presale.deploy(
                await token.getAddress(),
                admin.address,
                ethers.ZeroAddress,
                gpAddr,
                1n,
                0n,
                ethers.parseEther("1"),
                1n,
                start,
                end
            )
        ).to.be.revertedWith("GhostPresale: eth receiver zero");
    });

    it("rejette ghostPerEth = 0", async function () {
        const { token, admin, start, end, gpAddr } = await loadFixture(baseDeploy);
        const Presale = await ethers.getContractFactory("GhostPresale");
        await expect(
            Presale.deploy(await token.getAddress(), admin.address, admin.address, gpAddr, 0n, 0n, ethers.parseEther("1"), 1n, start, end)
        ).to.be.revertedWith("GhostPresale: taux zero");
    });

    it("rejette hardCap < softCap", async function () {
        const { token, admin, start, end, gpAddr } = await loadFixture(baseDeploy);
        const Presale = await ethers.getContractFactory("GhostPresale");
        await expect(
            Presale.deploy(
                await token.getAddress(),
                admin.address,
                admin.address,
                gpAddr,
                1n,
                ethers.parseEther("10"),
                ethers.parseEther("5"),
                ethers.parseEther("100"),
                start,
                end
            )
        ).to.be.revertedWith("GhostPresale: hardcap < softcap");
    });

    it("rejette maxPerWallet = 0", async function () {
        const { token, admin, start, end, gpAddr } = await loadFixture(baseDeploy);
        const Presale = await ethers.getContractFactory("GhostPresale");
        await expect(
            Presale.deploy(await token.getAddress(), admin.address, admin.address, gpAddr, 1n, 0n, ethers.parseEther("1"), 0n, start, end)
        ).to.be.revertedWith("GhostPresale: maxWallet zero");
    });

    it("rejette endTime <= startTime", async function () {
        const { token, admin, start, gpAddr } = await loadFixture(baseDeploy);
        const Presale = await ethers.getContractFactory("GhostPresale");
        await expect(
            Presale.deploy(await token.getAddress(), admin.address, admin.address, gpAddr, 1n, 0n, ethers.parseEther("1"), 1n, start, start)
        ).to.be.revertedWith("GhostPresale: fin < debut");
    });

    it("immutables exposés correctement après déploiement", async function () {
        const { token, admin, start, end, gpAddr } = await loadFixture(baseDeploy);
        const gpe = ethers.parseUnits("1000", 18);
        const Presale = await ethers.getContractFactory("GhostPresale");
        const presale = await Presale.deploy(
            await token.getAddress(),
            admin.address,
            admin.address,
            gpAddr,
            gpe,
            0n,
            ethers.parseEther("100"),
            ethers.parseEther("50"),
            start,
            end
        );
        await presale.waitForDeployment();
        expect(await presale.ghostToken()).to.equal(await token.getAddress());
        expect(await presale.admin()).to.equal(admin.address);
        expect(await presale.ghostPerEth()).to.equal(gpe);
        expect(await presale.softCapEth()).to.equal(0n);
        expect(await presale.hardCapEth()).to.equal(ethers.parseEther("100"));
        expect(await presale.maxPerWallet()).to.equal(ethers.parseEther("50"));
        expect(await presale.startTime()).to.equal(start);
        expect(await presale.endTime()).to.equal(end);
        expect(await presale.maxGhostAllocatable()).to.equal(await token.PRIVATE_SALE_ALLOC());
        expect((await presale.ghostProtocolV2()).toLowerCase()).to.equal(gpAddr.toLowerCase());
    });

    it("maxGhostAllocatable = PRIVATE_SALE_ALLOC du token (plafond 15 % du supply)", async function () {
        const { token, admin, start, end, gpAddr } = await loadFixture(baseDeploy);
        const Presale = await ethers.getContractFactory("GhostPresale");
        const presale = await Presale.deploy(
            await token.getAddress(),
            admin.address,
            admin.address,
            gpAddr,
            ethers.parseUnits("1", 18),
            0n,
            ethers.parseEther("100000"),
            ethers.parseEther("50000"),
            start,
            end
        );
        await presale.waitForDeployment();
        expect(await presale.maxGhostAllocatable()).to.equal(await token.PRIVATE_SALE_ALLOC());
    });

    it("rejette un achat si les GHOST alloués dépasseraient PRIVATE_SALE_ALLOC", async function () {
        const [deployer, admin, buyer] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("GhostToken");
        const token = await Token.deploy();
        await token.waitForDeployment();
        const cap = await token.PRIVATE_SALE_ALLOC();
        const latest = await ethers.provider.getBlock("latest");
        const start = BigInt(latest!.timestamp) + 300n;
        const end = start + 86400n;
        /** 1 ETH ⇒ cap+1 GHOST (wei) → dépasse le plafond dès le 1er achat */
        const absurdRate = cap + 1n;
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
            absurdRate,
            0n,
            ethers.parseEther("1000"),
            ethers.parseEther("1000"),
            start,
            end
        );
        await presale.waitForDeployment();
        const pAddr = await presale.getAddress();
        await token.transfer(pAddr, cap + 1n);
        await time.increaseTo(Number(start + 1n));
        await expect(presale.connect(buyer).buy({ value: ethers.parseEther("1") })).to.be.revertedWith(
            "GhostPresale: plafond GHOST vente"
        );
    });
});

describe("GhostPresale — flux & reverts", function () {
    async function fx(softCapEth: bigint = 0n) {
        const [deployer, admin, b1, b2, b3, stranger] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("GhostToken");
        const token = await Token.deploy();
        await token.waitForDeployment();
        const latest = await ethers.provider.getBlock("latest");
        const start = BigInt(latest!.timestamp) + 150n;
        const end = start + 7n * 24n * 3600n;
        const ghostPerEth = ethers.parseUnits("1000", 18);
        const hardCapEth = ethers.parseEther("100");
        const maxPerWallet = ethers.parseEther("50");
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
            softCapEth,
            hardCapEth,
            maxPerWallet,
            start,
            end
        );
        await presale.waitForDeployment();
        const pAddr = await presale.getAddress();
        await token.transfer(pAddr, await token.PRIVATE_SALE_ALLOC());
        return { token, presale, admin, b1, b2, b3, stranger, start, end, ghostPerEth, hardCapEth, maxPerWallet };
    }
    async function fxNoSoft() {
        return fx(0n);
    }
    async function fxSoft10() {
        return fx(ethers.parseEther("10"));
    }

    it("rejette buy avec msg.value = 0", async function () {
        const { presale, b1, start } = await loadFixture(fxNoSoft);
        await time.setNextBlockTimestamp(Number(start + 1n));
        await expect(presale.connect(b1).buy({ value: 0 })).to.be.revertedWith("GhostPresale: montant zero");
    });

    it("rejette achat après endTime", async function () {
        const { presale, b1, start, end } = await loadFixture(fxNoSoft);
        await time.setNextBlockTimestamp(Number(end + 1n));
        await expect(presale.connect(b1).buy({ value: ethers.parseEther("1") })).to.be.revertedWith(
            "GhostPresale: termine"
        );
    });

    it("receive() achète comme buy()", async function () {
        const { presale, b1, start, ghostPerEth } = await loadFixture(fxNoSoft);
        await time.setNextBlockTimestamp(Number(start + 1n));
        await b1.sendTransaction({ to: await presale.getAddress(), value: ethers.parseEther("1") });
        const expected = (ethers.parseEther("1") * ghostPerEth) / ethers.parseEther("1");
        expect(await presale.tokenAllocation(b1.address)).to.equal(expected);
    });

    it("rejette finalize par non-admin", async function () {
        const { presale, b1, b2, stranger, start, end, hardCapEth } = await loadFixture(fxNoSoft);
        await time.increaseTo(Number(start + 1n));
        await presale.connect(b1).buy({ value: hardCapEth / 2n });
        await presale.connect(b2).buy({ value: hardCapEth - hardCapEth / 2n });
        await time.increaseTo(Number(end + 1n));
        await expect(presale.connect(stranger).finalize()).to.be.revertedWith("GhostPresale: pas admin");
    });

    it("rejette finalize si prévente en cours (sans hard cap)", async function () {
        const { presale, admin, b1, start, end } = await loadFixture(fxNoSoft);
        await time.increaseTo(Number(start + 1n));
        await presale.connect(b1).buy({ value: ethers.parseEther("1") });
        await time.increaseTo(Number(end - 1000n));
        await expect(presale.connect(admin).finalize()).to.be.revertedWith("GhostPresale: prevente en cours");
    });

    it("rejette finalize si softcap non atteint", async function () {
        const { presale, admin, b1, start, end } = await loadFixture(fxSoft10);
        await time.setNextBlockTimestamp(Number(start + 1n));
        await presale.connect(b1).buy({ value: ethers.parseEther("1") });
        await time.setNextBlockTimestamp(Number(end + 1n));
        await expect(presale.connect(admin).finalize()).to.be.revertedWith("GhostPresale: softcap non atteint");
    });

    it("rejette enableRefundMode avant fin de prévente", async function () {
        const { presale, admin, start, b1 } = await loadFixture(fxSoft10);
        await time.setNextBlockTimestamp(Number(start + 1n));
        await presale.connect(b1).buy({ value: ethers.parseEther("1") });
        await expect(presale.connect(admin).enableRefundMode()).to.be.revertedWith(
            "GhostPresale: prevente encore active"
        );
    });

    it("rejette enableRefundMode si softcap déjà atteint", async function () {
        const { presale, admin, b1, start, end } = await loadFixture(fxSoft10);
        await time.setNextBlockTimestamp(Number(start + 1n));
        await presale.connect(b1).buy({ value: ethers.parseEther("10") });
        await time.setNextBlockTimestamp(Number(end + 1n));
        await expect(presale.connect(admin).enableRefundMode()).to.be.revertedWith(
            "GhostPresale: softcap atteint, utiliser finalize()"
        );
    });

    it("rejette enableRefundMode sans softcap (0)", async function () {
        const { presale, admin, b1, start, end } = await loadFixture(fxNoSoft);
        await time.setNextBlockTimestamp(Number(start + 1n));
        await presale.connect(b1).buy({ value: ethers.parseEther("1") });
        await time.setNextBlockTimestamp(Number(end + 1n));
        await expect(presale.connect(admin).enableRefundMode()).to.be.revertedWith(
            "GhostPresale: pas de softcap, utiliser finalize()"
        );
    });

    it("rejette claim sans allocation", async function () {
        const { presale, stranger, admin, b1, start, end } = await loadFixture(fxNoSoft);
        await time.increaseTo(Number(start + 1n));
        await presale.connect(b1).buy({ value: ethers.parseEther("1") });
        await time.increaseTo(Number(end + 1n));
        await presale.connect(admin).finalize();
        await expect(presale.connect(stranger).claim()).to.be.revertedWith("GhostPresale: aucune allocation");
    });

    it("rejette refund hors mode remboursement", async function () {
        const { presale, b1, start } = await loadFixture(fxNoSoft);
        await time.setNextBlockTimestamp(Number(start + 1n));
        await presale.connect(b1).buy({ value: ethers.parseEther("1") });
        await expect(presale.connect(b1).refund()).to.be.revertedWith("GhostPresale: pas en mode remboursement");
    });

    it("rejette refund sans contribution", async function () {
        const { presale, admin, stranger, b1, start, end } = await loadFixture(fxSoft10);
        await time.setNextBlockTimestamp(Number(start + 1n));
        await presale.connect(b1).buy({ value: ethers.parseEther("1") });
        await time.setNextBlockTimestamp(Number(end + 1n));
        await presale.connect(admin).enableRefundMode();
        await expect(presale.connect(stranger).refund()).to.be.revertedWith("GhostPresale: aucune contribution");
    });

    it("rejette recoverUnsoldTokens avant terminaison", async function () {
        const { presale, admin, start, b1 } = await loadFixture(fxNoSoft);
        await time.setNextBlockTimestamp(Number(start + 1n));
        await presale.connect(b1).buy({ value: ethers.parseEther("1") });
        await expect(presale.connect(admin).recoverUnsoldTokens()).to.be.revertedWith(
            "GhostPresale: prevente non terminee"
        );
    });

    it("rejette recoverUnsoldTokens par non-admin", async function () {
        const { presale, b1, b2, stranger, admin, start, end, hardCapEth } = await loadFixture(fxNoSoft);
        await time.increaseTo(Number(start + 1n));
        await presale.connect(b1).buy({ value: hardCapEth / 2n });
        await presale.connect(b2).buy({ value: hardCapEth - hardCapEth / 2n });
        await time.increaseTo(Number(end + 1n));
        await presale.connect(admin).finalize();
        await expect(presale.connect(stranger).recoverUnsoldTokens()).to.be.revertedWith("GhostPresale: pas admin");
    });

    it("ghostForEth cohérent avec l’achat", async function () {
        const { presale, b1, start, ghostPerEth } = await loadFixture(fxNoSoft);
        const eth = ethers.parseEther("3");
        expect(await presale.ghostForEth(eth)).to.equal((eth * ghostPerEth) / ethers.parseEther("1"));
        await time.setNextBlockTimestamp(Number(start + 1n));
        await presale.connect(b1).buy({ value: eth });
        expect(await presale.tokenAllocation(b1.address)).to.equal(await presale.ghostForEth(eth));
    });

    it("prix prévente : ethForGhost(1 GHOST) = 1e36 / ghostPerEth (wei ETH)", async function () {
        const { presale, ghostPerEth } = await loadFixture(fxNoSoft);
        const oneGhost = ethers.parseEther("1");
        const expectedEthWei = (oneGhost * ethers.parseEther("1")) / ghostPerEth;
        expect(await presale.ethForGhost(oneGhost)).to.equal(expectedEthWei);
    });

    it("anti-whale : maxPerWallet on-chain aligné sur le déploiement et > 0", async function () {
        const { presale, maxPerWallet } = await loadFixture(fxNoSoft);
        expect(await presale.maxPerWallet()).to.equal(maxPerWallet);
        expect(maxPerWallet > 0n).to.equal(true);
    });

    it("ethForGhost inverse raisonnable", async function () {
        const { presale, ghostPerEth } = await loadFixture(fxNoSoft);
        const g = ethers.parseEther("5000");
        const eth = await presale.ethForGhost(g);
        expect(await presale.ghostForEth(eth)).to.be.at.most(g);
    });

    it("presaleInfo _active true pendant la fenêtre", async function () {
        const { presale, start, end } = await loadFixture(fxNoSoft);
        await time.increaseTo(Number(start + 1n));
        const info = await presale.presaleInfo();
        expect(info._active).to.equal(true);
        expect(info._finalized).to.equal(false);
        expect(info._refundMode).to.equal(false);
        await time.increaseTo(Number(end + 1n));
        const info2 = await presale.presaleInfo();
        expect(info2._active).to.equal(false);
    });

    it("buyerInfo reflète contributions et flags", async function () {
        const { presale, b1, start, ghostPerEth } = await loadFixture(fxNoSoft);
        const eth = ethers.parseEther("2");
        await time.setNextBlockTimestamp(Number(start + 1n));
        await presale.connect(b1).buy({ value: eth });
        const inf = await presale.buyerInfo(b1.address);
        expect(inf.ethContributed).to.equal(eth);
        expect(inf.ghostAllocated).to.equal((eth * ghostPerEth) / ethers.parseEther("1"));
        expect(inf.hasClaimed).to.equal(false);
        expect(inf.hasRefunded).to.equal(false);
    });

    it("finalize émet Finalized", async function () {
        const { presale, admin, b1, b2, start, hardCapEth } = await loadFixture(fxNoSoft);
        await time.increaseTo(Number(start + 1n));
        await presale.connect(b1).buy({ value: hardCapEth / 2n });
        await presale.connect(b2).buy({ value: hardCapEth - hardCapEth / 2n });
        const sold = await presale.totalTokensSold();
        await expect(presale.connect(admin).finalize())
            .to.emit(presale, "Finalized")
            .withArgs(hardCapEth, sold);
    });

    it("claim émet Claimed", async function () {
        const { presale, admin, b1, start, end, hardCapEth } = await loadFixture(fxNoSoft);
        await time.setNextBlockTimestamp(Number(start + 1n));
        await presale.connect(b1).buy({ value: ethers.parseEther("1") });
        await time.setNextBlockTimestamp(Number(end + 1n));
        await presale.connect(admin).finalize();
        const alloc = await presale.tokenAllocation(b1.address);
        await expect(presale.connect(b1).claim()).to.emit(presale, "Claimed").withArgs(b1.address, alloc);
    });

    it("Purchase émis à l’achat", async function () {
        const { presale, b1, start, ghostPerEth } = await loadFixture(fxNoSoft);
        const eth = ethers.parseEther("1");
        const g = (eth * ghostPerEth) / ethers.parseEther("1");
        await time.setNextBlockTimestamp(Number(start + 1n));
        await expect(presale.connect(b1).buy({ value: eth })).to.emit(presale, "Purchase").withArgs(b1.address, eth, g);
    });

    it("deux acheteurs claim indépendamment", async function () {
        const { presale, token, admin, b1, b2, start, end } = await loadFixture(fxNoSoft);
        await time.setNextBlockTimestamp(Number(start + 1n));
        await presale.connect(b1).buy({ value: ethers.parseEther("1") });
        await presale.connect(b2).buy({ value: ethers.parseEther("2") });
        await time.setNextBlockTimestamp(Number(end + 1n));
        await presale.connect(admin).finalize();
        const a1 = await presale.tokenAllocation(b1.address);
        const a2 = await presale.tokenAllocation(b2.address);
        await presale.connect(b1).claim();
        await presale.connect(b2).claim();
        expect(await token.balanceOf(b1.address)).to.equal(a1);
        expect(await token.balanceOf(b2.address)).to.equal(a2);
    });

    it("rejette achat si finalized", async function () {
        const { presale, admin, b1, b2, b3, start, hardCapEth } = await loadFixture(fxNoSoft);
        await time.increaseTo(Number(start + 1n));
        await presale.connect(b1).buy({ value: hardCapEth / 2n });
        await presale.connect(b2).buy({ value: hardCapEth - hardCapEth / 2n });
        await presale.connect(admin).finalize();
        await expect(presale.connect(b3).buy({ value: 1n })).to.be.revertedWith("GhostPresale: finalise");
    });

    it("après fin + refundMode, nouvel achat échoue (prévente terminée en premier)", async function () {
        const { presale, admin, b1, b2, start, end } = await loadFixture(fxSoft10);
        await time.increaseTo(Number(start + 1n));
        await presale.connect(b1).buy({ value: ethers.parseEther("1") });
        await time.increaseTo(Number(end + 1n));
        await presale.connect(admin).enableRefundMode();
        /** `termine` est vérifié avant `mode remboursement` dans presaleActive */
        await expect(presale.connect(b2).buy({ value: 1n })).to.be.revertedWith("GhostPresale: termine");
    });

    it("enableRefundMode émet RefundModeEnabled", async function () {
        const { presale, admin, b1, start, end } = await loadFixture(fxSoft10);
        await time.setNextBlockTimestamp(Number(start + 1n));
        await presale.connect(b1).buy({ value: ethers.parseEther("1") });
        await time.setNextBlockTimestamp(Number(end + 1n));
        await expect(presale.connect(admin).enableRefundMode()).to.emit(presale, "RefundModeEnabled");
    });

    it("refund émet Refunded", async function () {
        const { presale, admin, b1, start, end } = await loadFixture(fxSoft10);
        const paid = ethers.parseEther("2");
        await time.setNextBlockTimestamp(Number(start + 1n));
        await presale.connect(b1).buy({ value: paid });
        await time.setNextBlockTimestamp(Number(end + 1n));
        await presale.connect(admin).enableRefundMode();
        await expect(presale.connect(b1).refund()).to.emit(presale, "Refunded").withArgs(b1.address, paid);
    });

    it("recoverUnsoldTokens après refundMode émet événement", async function () {
        const { presale, token, admin, b1, start, end } = await loadFixture(fxSoft10);
        await time.setNextBlockTimestamp(Number(start + 1n));
        await presale.connect(b1).buy({ value: ethers.parseEther("1") });
        await time.setNextBlockTimestamp(Number(end + 1n));
        await presale.connect(admin).enableRefundMode();
        await presale.connect(b1).refund();
        const bal = await token.balanceOf(await presale.getAddress());
        expect(bal > 0n).to.equal(true);
        await expect(presale.connect(admin).recoverUnsoldTokens())
            .to.emit(presale, "UnsoldTokensRecovered")
            .withArgs(bal);
    });

    it("finalize rejette si déjà finalisé", async function () {
        const { presale, admin, b1, b2, start, hardCapEth } = await loadFixture(fxNoSoft);
        await time.increaseTo(Number(start + 1n));
        await presale.connect(b1).buy({ value: hardCapEth / 2n });
        await presale.connect(b2).buy({ value: hardCapEth - hardCapEth / 2n });
        await presale.connect(admin).finalize();
        await expect(presale.connect(admin).finalize()).to.be.revertedWith("GhostPresale: deja finalise");
    });

    it("enableRefundMode rejette si déjà refundMode", async function () {
        const { presale, admin, b1, start, end } = await loadFixture(fxSoft10);
        await time.setNextBlockTimestamp(Number(start + 1n));
        await presale.connect(b1).buy({ value: ethers.parseEther("1") });
        await time.setNextBlockTimestamp(Number(end + 1n));
        await presale.connect(admin).enableRefundMode();
        await expect(presale.connect(admin).enableRefundMode()).to.be.revertedWith(
            "GhostPresale: deja en remboursement"
        );
    });

    it("rejette achat si pas assez de GHOST sur le contrat", async function () {
        const [, admin, b1] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("GhostToken");
        const token = await Token.deploy();
        await token.waitForDeployment();
        const latest = await ethers.provider.getBlock("latest");
        const start = BigInt(latest!.timestamp) + 200n;
        const end = start + 86400n;
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
        /** Solde insuffisant pour 1 ETH d’achat (besoin 1000 GHOST) */
        await token.transfer(pAddr, ethers.parseEther("100"));
        await time.increaseTo(Number(start + 1n));
        await expect(presale.connect(b1).buy({ value: ethers.parseEther("1") })).to.be.revertedWith(
            "GhostPresale: pas assez de tokens"
        );
    });
});

describe("GhostVesting — constructeur & edges", function () {
    async function vBase() {
        const [deployer, beneficiary] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("GhostToken");
        const token = await Token.deploy();
        await token.waitForDeployment();
        return { deployer, beneficiary, token };
    }

    it("rejette token zéro", async function () {
        const { beneficiary, token } = await loadFixture(vBase);
        const latest = await ethers.provider.getBlock("latest");
        const s = BigInt(latest!.timestamp) + 10n;
        const V = await ethers.getContractFactory("GhostVesting");
        await expect(V.deploy(ethers.ZeroAddress, beneficiary.address, s, 1n, 100n, 1n)).to.be.revertedWith(
            "GhostVesting: token zero"
        );
    });

    it("rejette beneficiary zéro", async function () {
        const { token } = await loadFixture(vBase);
        const latest = await ethers.provider.getBlock("latest");
        const s = BigInt(latest!.timestamp) + 10n;
        const V = await ethers.getContractFactory("GhostVesting");
        await expect(
            V.deploy(await token.getAddress(), ethers.ZeroAddress, s, 1n, 100n, 1n)
        ).to.be.revertedWith("GhostVesting: beneficiary zero");
    });

    it("rejette duration = 0", async function () {
        const { token, beneficiary } = await loadFixture(vBase);
        const latest = await ethers.provider.getBlock("latest");
        const s = BigInt(latest!.timestamp) + 10n;
        const V = await ethers.getContractFactory("GhostVesting");
        await expect(V.deploy(await token.getAddress(), beneficiary.address, s, 0n, 0n, 1n)).to.be.revertedWith(
            "GhostVesting: duree zero"
        );
    });

    it("rejette cliff > duration", async function () {
        const { token, beneficiary } = await loadFixture(vBase);
        const latest = await ethers.provider.getBlock("latest");
        const s = BigInt(latest!.timestamp) + 10n;
        const V = await ethers.getContractFactory("GhostVesting");
        await expect(V.deploy(await token.getAddress(), beneficiary.address, s, 200n, 100n, 1n)).to.be.revertedWith(
            "GhostVesting: cliff > duree"
        );
    });

    it("rejette totalAmount = 0", async function () {
        const { token, beneficiary } = await loadFixture(vBase);
        const latest = await ethers.provider.getBlock("latest");
        const s = BigInt(latest!.timestamp) + 10n;
        const V = await ethers.getContractFactory("GhostVesting");
        await expect(V.deploy(await token.getAddress(), beneficiary.address, s, 1n, 100n, 0n)).to.be.revertedWith(
            "GhostVesting: montant zero"
        );
    });

    async function vFx() {
        const [deployer, beneficiary] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("GhostToken");
        const token = await Token.deploy();
        await token.waitForDeployment();
        const latest = await ethers.provider.getBlock("latest");
        const start = BigInt(latest!.timestamp);
        const cliffDur = 20n;
        const duration = 200n;
        const total = ethers.parseEther("1000");
        const V = await ethers.getContractFactory("GhostVesting");
        const vesting = await V.deploy(await token.getAddress(), beneficiary.address, start, cliffDur, duration, total);
        await vesting.waitForDeployment();
        const vAddr = await vesting.getAddress();
        await token.transfer(vAddr, total);
        return { vesting, token, beneficiary, deployer, start, cliffDur, duration, total };
    }

    it("cliff immuable = start + cliffDuration", async function () {
        const { vesting, start, cliffDur } = await loadFixture(vFx);
        expect(await vesting.cliff()).to.equal(start + cliffDur);
    });

    it("vestedAmount à l’instant cliff = 0", async function () {
        const { vesting, start, cliffDur } = await loadFixture(vFx);
        expect(await vesting.vestedAmount(start + cliffDur - 1n)).to.equal(0n);
    });

    it("vestedAmount après toute la duration = totalAmount", async function () {
        const { vesting, start, duration, total } = await loadFixture(vFx);
        expect(await vesting.vestedAmount(start + duration)).to.equal(total);
        expect(await vesting.vestedAmount(start + duration + 1000n)).to.equal(total);
    });

    it("release() revert si rien à libérer", async function () {
        const { vesting, deployer, start } = await loadFixture(vFx);
        await time.setNextBlockTimestamp(Number(start + 5n));
        await expect(vesting.connect(deployer).release()).to.be.revertedWith("GhostVesting: rien a liberer");
    });

    it("status() cohérent après cliff", async function () {
        const { vesting, start, cliffDur, duration, total } = await loadFixture(vFx);
        const t = start + cliffDur + duration / 4n;
        await time.increaseTo(Number(t));
        const st = await vesting.status();
        expect(st._cliffPassed).to.equal(true);
        expect(st._released).to.equal(0n);
        expect(st._releasable + st._locked + st._released).to.equal(total);
    });

    it("deux release successifs : deuxième > 0 si le temps a avancé", async function () {
        const { vesting, beneficiary, token, start, cliffDur, duration } = await loadFixture(vFx);
        const t1 = start + cliffDur + duration / 3n;
        await time.increaseTo(Number(t1));
        await vesting.connect(beneficiary).release();
        await time.increaseTo(Number(start + cliffDur + (duration * 2n) / 3n));
        const bb = await token.balanceOf(beneficiary.address);
        await vesting.connect(beneficiary).release();
        expect(await token.balanceOf(beneficiary.address) > bb).to.equal(true);
    });
});

describe("GhostTimelock — étendu", function () {
    async function tlBase() {
        const [d, ben] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("GhostToken");
        const token = await Token.deploy();
        await token.waitForDeployment();
        return { token, ben, d };
    }

    it("rejette token zéro", async function () {
        const { ben } = await loadFixture(tlBase);
        const latest = await ethers.provider.getBlock("latest");
        const rt = BigInt(latest!.timestamp) + 100n;
        const TL = await ethers.getContractFactory("GhostTimelock");
        await expect(TL.deploy(ethers.ZeroAddress, ben.address, rt)).to.be.revertedWith("GhostTimelock: token zero");
    });

    it("rejette beneficiary zéro", async function () {
        const { token } = await loadFixture(tlBase);
        const latest = await ethers.provider.getBlock("latest");
        const rt = BigInt(latest!.timestamp) + 100n;
        const TL = await ethers.getContractFactory("GhostTimelock");
        await expect(TL.deploy(await token.getAddress(), ethers.ZeroAddress, rt)).to.be.revertedWith(
            "GhostTimelock: beneficiary zero"
        );
    });

    it("rejette releaseTime dans le passé", async function () {
        const { token, ben } = await loadFixture(tlBase);
        const latest = await ethers.provider.getBlock("latest");
        const past = BigInt(latest!.timestamp) - 1n;
        const TL = await ethers.getContractFactory("GhostTimelock");
        await expect(TL.deploy(await token.getAddress(), ben.address, past)).to.be.revertedWith(
            "GhostTimelock: date dans le passe"
        );
    });

    async function tlFx() {
        const [deployer, beneficiary, other] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("GhostToken");
        const token = await Token.deploy();
        await token.waitForDeployment();
        const latest = await ethers.provider.getBlock("latest");
        const releaseTime = BigInt(latest!.timestamp) + 500n;
        const TL = await ethers.getContractFactory("GhostTimelock");
        const timelock = await TL.deploy(await token.getAddress(), beneficiary.address, releaseTime);
        await timelock.waitForDeployment();
        const tlAddr = await timelock.getAddress();
        const amount = ethers.parseEther("100");
        await token.transfer(tlAddr, amount);
        return { token, timelock, beneficiary, other, releaseTime, amount };
    }

    it("status() secondsRemaining avant échéance", async function () {
        const { timelock, releaseTime } = await loadFixture(tlFx);
        const st = await timelock.status();
        expect(st.isUnlocked).to.equal(false);
        expect(st.unlockTimestamp).to.equal(releaseTime);
        expect(st.secondsRemaining > 0n).to.equal(true);
    });

    it("status() isUnlocked après échéance", async function () {
        const { timelock, releaseTime } = await loadFixture(tlFx);
        await time.increaseTo(Number(releaseTime));
        const st = await timelock.status();
        expect(st.isUnlocked).to.equal(true);
        expect(st.secondsRemaining).to.equal(0n);
    });

    it("release revert solde zéro après premier release", async function () {
        const { timelock, token, beneficiary, releaseTime, amount } = await loadFixture(tlFx);
        await time.setNextBlockTimestamp(Number(releaseTime + 1n));
        await timelock.connect(beneficiary).release();
        expect(await token.balanceOf(beneficiary.address)).to.equal(amount);
        await expect(timelock.connect(beneficiary).release()).to.be.revertedWith("GhostTimelock: solde zero");
    });

    it("release émet Released", async function () {
        const { timelock, beneficiary, releaseTime, amount } = await loadFixture(tlFx);
        await time.setNextBlockTimestamp(Number(releaseTime + 1n));
        await expect(timelock.connect(beneficiary).release())
            .to.emit(timelock, "Released")
            .withArgs(beneficiary.address, amount);
    });

    it("getters token / beneficiary / releaseTime", async function () {
        const { timelock, token, beneficiary, releaseTime } = await loadFixture(tlFx);
        expect(await timelock.token()).to.equal(await token.getAddress());
        expect(await timelock.beneficiary()).to.equal(beneficiary.address);
        expect(await timelock.releaseTime()).to.equal(releaseTime);
    });
});

describe("GhostToken — ERC20Votes & méta", function () {
    async function tFx() {
        const [deployer, alice] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("GhostToken");
        const token = await Token.deploy();
        await token.waitForDeployment();
        return { token, deployer, alice };
    }

    it("CLOCK_MODE retourne le mode horloge OZ (blocknumber par défaut)", async function () {
        const { token } = await loadFixture(tFx);
        expect(await token.CLOCK_MODE()).to.equal("mode=blocknumber&from=default");
    });

    it("clock retourne le numéro de bloc courant", async function () {
        const { token } = await loadFixture(tFx);
        const n = BigInt((await ethers.provider.getBlock("latest"))!.number);
        expect(await token.clock()).to.equal(n);
    });

    it("delegate vers soi : getVotes ≈ balance courante", async function () {
        const { token, deployer } = await loadFixture(tFx);
        await token.connect(deployer).delegate(deployer.address);
        expect(await token.getVotes(deployer.address)).to.equal(await token.balanceOf(deployer.address));
    });

    it("transfer après auto-délégation met à jour les votes de l’expéditeur", async function () {
        const { token, deployer, alice } = await loadFixture(tFx);
        const amt = ethers.parseEther("10000");
        await token.connect(deployer).delegate(deployer.address);
        const vBefore = await token.getVotes(deployer.address);
        await token.connect(deployer).transfer(alice.address, amt);
        expect(await token.getVotes(deployer.address)).to.equal(vBefore - amt);
    });

    it("getPastVotes cohérent après transfert (checkpoint)", async function () {
        const { token, deployer, alice } = await loadFixture(tFx);
        await token.connect(deployer).delegate(deployer.address);
        const blk = await ethers.provider.getBlockNumber();
        const amt = ethers.parseEther("1");
        await token.connect(deployer).transfer(alice.address, amt);
        const clock = await token.clock();
        expect(await token.getPastVotes(deployer.address, clock - 1n)).to.be.gt(0n);
    });
});

describe("GhostPresale — état & cas limites", function () {
    async function fxNoSoft() {
        const [, admin, b1, b2] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("GhostToken");
        const token = await Token.deploy();
        await token.waitForDeployment();
        const latest = await ethers.provider.getBlock("latest");
        const start = BigInt(latest!.timestamp) + 160n;
        const end = start + 86400n;
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
        await token.transfer(await presale.getAddress(), await token.PRIVATE_SALE_ALLOC());
        const hardCapEth = ethers.parseEther("100");
        return { token, presale, admin, b1, b2, start, end, ghostPerEth, hardCapEth };
    }

    it("finalized et refundMode faux au déploiement", async function () {
        const { presale } = await loadFixture(fxNoSoft);
        expect(await presale.finalized()).to.equal(false);
        expect(await presale.refundMode()).to.equal(false);
    });

    it("totalRaisedEth et totalTokensSold à 0 au départ", async function () {
        const { presale } = await loadFixture(fxNoSoft);
        expect(await presale.totalRaisedEth()).to.equal(0n);
        expect(await presale.totalTokensSold()).to.equal(0n);
    });

    it("contributions[buyer] suit les achats cumulés", async function () {
        const { presale, b1, start } = await loadFixture(fxNoSoft);
        await time.increaseTo(Number(start + 1n));
        const e1 = ethers.parseEther("10");
        const e2 = ethers.parseEther("5");
        await presale.connect(b1).buy({ value: e1 });
        await presale.connect(b1).buy({ value: e2 });
        expect(await presale.contributions(b1.address)).to.equal(e1 + e2);
    });

    it("finalize rejette si mode remboursement déjà actif (ordre admin)", async function () {
        const [, admin, b1] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("GhostToken");
        const token = await Token.deploy();
        await token.waitForDeployment();
        const latest = await ethers.provider.getBlock("latest");
        const start = BigInt(latest!.timestamp) + 180n;
        const end = start + 3600n;
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
            ethers.parseUnits("1000", 18),
            ethers.parseEther("5"),
            ethers.parseEther("100"),
            ethers.parseEther("50"),
            start,
            end
        );
        await presale.waitForDeployment();
        await token.transfer(await presale.getAddress(), await token.PRIVATE_SALE_ALLOC());
        await time.increaseTo(Number(start + 1n));
        await presale.connect(b1).buy({ value: ethers.parseEther("1") });
        await time.increaseTo(Number(end + 1n));
        await presale.connect(admin).enableRefundMode();
        await expect(presale.connect(admin).finalize()).to.be.revertedWith("GhostPresale: mode remboursement");
    });

    it("claim rejette en refundMode (pas finalisé)", async function () {
        const [, admin, b1] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("GhostToken");
        const token = await Token.deploy();
        await token.waitForDeployment();
        const latest = await ethers.provider.getBlock("latest");
        const start = BigInt(latest!.timestamp) + 190n;
        const end = start + 3600n;
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
            ethers.parseUnits("1000", 18),
            ethers.parseEther("5"),
            ethers.parseEther("100"),
            ethers.parseEther("50"),
            start,
            end
        );
        await presale.waitForDeployment();
        await token.transfer(await presale.getAddress(), await token.PRIVATE_SALE_ALLOC());
        await time.increaseTo(Number(start + 1n));
        await presale.connect(b1).buy({ value: ethers.parseEther("1") });
        await time.increaseTo(Number(end + 1n));
        await presale.connect(admin).enableRefundMode();
        await expect(presale.connect(b1).claim()).to.be.revertedWith("GhostPresale: pas encore finalise");
    });

    it("recoverUnsoldTokens rejette si solde GHOST = 0", async function () {
        const { presale, token, admin, b1, start, end } = await loadFixture(fxNoSoft);
        await time.increaseTo(Number(start + 1n));
        await presale.connect(b1).buy({ value: ethers.parseEther("1") });
        await time.increaseTo(Number(end + 1n));
        await presale.connect(admin).finalize();
        await presale.connect(b1).claim();
        await presale.connect(admin).recoverUnsoldTokens();
        await expect(presale.connect(admin).recoverUnsoldTokens()).to.be.revertedWith(
            "GhostPresale: aucun token a recuperer"
        );
    });

    it("enableRefundMode rejette si déjà finalisé", async function () {
        const { presale, admin, b1, b2, start, hardCapEth } = await loadFixture(fxNoSoft);
        await time.increaseTo(Number(start + 1n));
        await presale.connect(b1).buy({ value: hardCapEth / 2n });
        await presale.connect(b2).buy({ value: hardCapEth - hardCapEth / 2n });
        await presale.connect(admin).finalize();
        await expect(presale.connect(admin).enableRefundMode()).to.be.revertedWith("GhostPresale: deja finalise");
    });

    it("ghostForEth(0) retourne 0", async function () {
        const { presale } = await loadFixture(fxNoSoft);
        expect(await presale.ghostForEth(0n)).to.equal(0n);
    });

    it("ethForGhost(0) retourne 0", async function () {
        const { presale } = await loadFixture(fxNoSoft);
        expect(await presale.ethForGhost(0n)).to.equal(0n);
    });

    it("presaleInfo _tokensRemaining = solde ERC20 du contrat", async function () {
        const { presale, token, start } = await loadFixture(fxNoSoft);
        await time.increaseTo(Number(start + 1n));
        const pAddr = await presale.getAddress();
        const info = await presale.presaleInfo();
        expect(info._tokensRemaining).to.equal(await token.balanceOf(pAddr));
    });
});
