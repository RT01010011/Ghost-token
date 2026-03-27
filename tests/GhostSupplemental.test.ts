/**
 * Couverture supplémentaire — splitter, registry, token, prévente, vesting, timelock.
 */
import { expect } from "chai";
import { ethers } from "hardhat";
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";

const NON_ZERO = "0x0000000000000000000000000000000000000001";

describe("GhostSupplemental — GhostEthProceedsSplitter", function () {
    it("rejette constructeur si tableaux vides", async function () {
        const Factory = await ethers.getContractFactory("GhostEthProceedsSplitter");
        await expect(Factory.deploy([], [])).to.be.revertedWith("GhostEthSplitter: length");
    });

    it("rejette si longueur recipients ≠ bps", async function () {
        const [, a, b] = await ethers.getSigners();
        const Factory = await ethers.getContractFactory("GhostEthProceedsSplitter");
        await expect(Factory.deploy([a.address, b.address], [5000])).to.be.revertedWith("GhostEthSplitter: length");
    });

    it("rejette une entrée bps à zéro", async function () {
        const [, a, b] = await ethers.getSigners();
        const Factory = await ethers.getContractFactory("GhostEthProceedsSplitter");
        await expect(Factory.deploy([a.address, b.address], [0, 10000])).to.be.revertedWith(
            "GhostEthSplitter: zero bps"
        );
    });

    it("recipientCount, recipientAt et bpsAt reflètent le déploiement", async function () {
        const [, a, b, c] = await ethers.getSigners();
        const Factory = await ethers.getContractFactory("GhostEthProceedsSplitter");
        const splitter = await Factory.deploy([a.address, b.address, c.address], [2000, 3000, 5000]);
        await splitter.waitForDeployment();
        expect(await splitter.recipientCount()).to.equal(3n);
        expect(await splitter.recipientAt(0)).to.equal(a.address);
        expect(await splitter.recipientAt(2)).to.equal(c.address);
        expect(await splitter.bpsAt(1)).to.equal(3000n);
    });

    it("receive avec 0 wei ne crée pas de solde résiduel", async function () {
        const [deployer, a] = await ethers.getSigners();
        const Factory = await ethers.getContractFactory("GhostEthProceedsSplitter");
        const splitter = await Factory.deploy([a.address], [10000]);
        await splitter.waitForDeployment();
        const addr = await splitter.getAddress();
        await deployer.sendTransaction({ to: addr, value: 0n });
        expect(await ethers.provider.getBalance(addr)).to.equal(0n);
    });

    it("répartit correctement sur trois bénéficiaires (3333, 3333, 3334)", async function () {
        const [deployer, a, b, c] = await ethers.getSigners();
        const Factory = await ethers.getContractFactory("GhostEthProceedsSplitter");
        const splitter = await Factory.deploy([a.address, b.address, c.address], [3333, 3333, 3334]);
        await splitter.waitForDeployment();
        const addr = await splitter.getAddress();
        const v = ethers.parseEther("1");
        const ba0 = await ethers.provider.getBalance(a.address);
        const bb0 = await ethers.provider.getBalance(b.address);
        const bc0 = await ethers.provider.getBalance(c.address);
        await deployer.sendTransaction({ to: addr, value: v });
        const s1 = (v * 3333n) / 10000n;
        const s2 = (v * 3333n) / 10000n;
        expect(await ethers.provider.getBalance(a.address) - ba0).to.equal(s1);
        expect(await ethers.provider.getBalance(b.address) - bb0).to.equal(s2);
        expect(await ethers.provider.getBalance(c.address) - bc0).to.equal(v - s1 - s2);
        expect(await ethers.provider.getBalance(addr)).to.equal(0n);
    });

    it("un seul destinataire à 10_000 bps reçoit tout", async function () {
        const [deployer, a] = await ethers.getSigners();
        const Factory = await ethers.getContractFactory("GhostEthProceedsSplitter");
        const splitter = await Factory.deploy([a.address], [10000]);
        await splitter.waitForDeployment();
        const addr = await splitter.getAddress();
        const v = ethers.parseEther("2.5");
        const b0 = await ethers.provider.getBalance(a.address);
        await deployer.sendTransaction({ to: addr, value: v });
        expect(await ethers.provider.getBalance(a.address) - b0).to.equal(v);
    });

    it("petit montant impair : somme des parts = envoi total", async function () {
        const [deployer, a, b] = await ethers.getSigners();
        const Factory = await ethers.getContractFactory("GhostEthProceedsSplitter");
        const splitter = await Factory.deploy([a.address, b.address], [4000, 6000]);
        await splitter.waitForDeployment();
        const addr = await splitter.getAddress();
        const v = 101n;
        const ba0 = await ethers.provider.getBalance(a.address);
        const bb0 = await ethers.provider.getBalance(b.address);
        await deployer.sendTransaction({ to: addr, value: v });
        const deltaA = (await ethers.provider.getBalance(a.address)) - ba0;
        const deltaB = (await ethers.provider.getBalance(b.address)) - bb0;
        expect(deltaA + deltaB).to.equal(v);
        expect(await ethers.provider.getBalance(addr)).to.equal(0n);
    });
});

describe("GhostSupplemental — GhostPresaleBonusRegistry", function () {
    const CRED = ethers.keccak256(ethers.toUtf8Bytes("GhostPresaleBonusRegistry.v1"));

    it("rejette constructeur si presale address(0)", async function () {
        const Reg = await ethers.getContractFactory("GhostPresaleBonusRegistry");
        await expect(Reg.deploy(ethers.ZeroAddress, 100, CRED)).to.be.revertedWith("GhostPresaleBonus: presale zero");
    });

    it("rejette constructeur si bonusBps > 10_000", async function () {
        const Reg = await ethers.getContractFactory("GhostPresaleBonusRegistry");
        await expect(Reg.deploy(NON_ZERO, 10001, CRED)).to.be.revertedWith("GhostPresaleBonus: bps too high");
    });

    it("bonusBps et presale immuables lisibles", async function () {
        const [_, admin] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("GhostToken");
        const token = await Token.deploy();
        await token.waitForDeployment();
        const latest = await ethers.provider.getBlock("latest");
        const start = BigInt(latest!.timestamp) + 80n;
        const end = start + 3600n;
        const MockGp = await ethers.getContractFactory("MockGhostProtocolV2ForPresale");
        const mockGp = await MockGp.deploy();
        await mockGp.waitForDeployment();
        const Presale = await ethers.getContractFactory("GhostPresale");
        const presale = await Presale.deploy(
            await token.getAddress(),
            admin.address,
            admin.address,
            await mockGp.getAddress(),
            ethers.parseUnits("1000", 18),
            0n,
            ethers.parseEther("50"),
            ethers.parseEther("10"),
            start,
            end
        );
        await presale.waitForDeployment();
        const pAddr = await presale.getAddress();
        const Reg = await ethers.getContractFactory("GhostPresaleBonusRegistry");
        const registry = await Reg.deploy(pAddr, 750, CRED);
        await registry.waitForDeployment();
        expect(await registry.bonusBps()).to.equal(750n);
        expect(await registry.presale()).to.equal(pAddr);
    });

    it("pseudo1BonusListLength vaut 0 avant tout enregistrement pseudo", async function () {
        const { registry } = await loadFixture(async function regMini() {
            const [_, admin, buyer] = await ethers.getSigners();
            const Token = await ethers.getContractFactory("GhostToken");
            const token = await Token.deploy();
            await token.waitForDeployment();
            const latest = await ethers.provider.getBlock("latest");
            const start = BigInt(latest!.timestamp) + 80n;
            const end = start + 3600n;
            const MockGp = await ethers.getContractFactory("MockGhostProtocolV2ForPresale");
            const mockGp = await MockGp.deploy();
            await mockGp.waitForDeployment();
            const Presale = await ethers.getContractFactory("GhostPresale");
            const presale = await Presale.deploy(
                await token.getAddress(),
                admin.address,
                admin.address,
                await mockGp.getAddress(),
                ethers.parseUnits("1000", 18),
                0n,
                ethers.parseEther("50"),
                ethers.parseEther("10"),
                start,
                end
            );
            await presale.waitForDeployment();
            const pAddr = await presale.getAddress();
            await token.transfer(pAddr, await token.PRIVATE_SALE_ALLOC());
            const Reg = await ethers.getContractFactory("GhostPresaleBonusRegistry");
            const registry = await Reg.deploy(pAddr, 500, CRED);
            await registry.waitForDeployment();
            return { registry, presale, admin, buyer, start, end };
        });
        expect(await registry.pseudo1BonusListLength()).to.equal(0n);
    });

    it("bonusGhostAmount et credentialIdOf nuls si non enregistré", async function () {
        const [, admin, buyer] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("GhostToken");
        const token = await Token.deploy();
        await token.waitForDeployment();
        const latest = await ethers.provider.getBlock("latest");
        const start = BigInt(latest!.timestamp) + 80n;
        const end = start + 3600n;
        const MockGp = await ethers.getContractFactory("MockGhostProtocolV2ForPresale");
        const mockGp = await MockGp.deploy();
        await mockGp.waitForDeployment();
        const Presale = await ethers.getContractFactory("GhostPresale");
        const presale = await Presale.deploy(
            await token.getAddress(),
            admin.address,
            admin.address,
            await mockGp.getAddress(),
            ethers.parseUnits("1000", 18),
            0n,
            ethers.parseEther("50"),
            ethers.parseEther("10"),
            start,
            end
        );
        await presale.waitForDeployment();
        const pAddr = await presale.getAddress();
        await token.transfer(pAddr, await token.PRIVATE_SALE_ALLOC());
        const Reg = await ethers.getContractFactory("GhostPresaleBonusRegistry");
        const registry = await Reg.deploy(pAddr, 500, CRED);
        await registry.waitForDeployment();
        expect(await registry.bonusGhostAmount(buyer.address)).to.equal(0n);
        expect(await registry.credentialIdOf(buyer.address)).to.equal(ethers.ZeroHash);
    });

    it("après enregistrement credentialIdOf non nul et cohérent avec bonus", async function () {
        const [_, admin, buyer] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("GhostToken");
        const token = await Token.deploy();
        await token.waitForDeployment();
        const latest = await ethers.provider.getBlock("latest");
        const start = BigInt(latest!.timestamp) + 80n;
        const end = start + 3600n;
        const gpe = ethers.parseUnits("1000", 18);
        const MockGp = await ethers.getContractFactory("MockGhostProtocolV2ForPresale");
        const mockGp = await MockGp.deploy();
        await mockGp.waitForDeployment();
        const Presale = await ethers.getContractFactory("GhostPresale");
        const presale = await Presale.deploy(
            await token.getAddress(),
            admin.address,
            admin.address,
            await mockGp.getAddress(),
            gpe,
            0n,
            ethers.parseEther("50"),
            ethers.parseEther("10"),
            start,
            end
        );
        await presale.waitForDeployment();
        const pAddr = await presale.getAddress();
        await token.transfer(pAddr, await token.PRIVATE_SALE_ALLOC());
        const Reg = await ethers.getContractFactory("GhostPresaleBonusRegistry");
        const registry = await Reg.deploy(pAddr, 200, CRED);
        await registry.waitForDeployment();
        await time.setNextBlockTimestamp(Number(start + 1n));
        const ethIn = ethers.parseEther("1");
        await presale.connect(buyer).buy({ value: ethIn });
        await time.setNextBlockTimestamp(Number(end + 1n));
        await presale.connect(admin).finalize();
        await presale.connect(buyer).claim();
        await registry.recordEligibility(buyer.address);
        const alloc = (ethIn * gpe) / ethers.parseEther("1");
        const cid = await registry.credentialIdOf(buyer.address);
        expect(cid).to.not.equal(ethers.ZeroHash);
        expect(await registry.bonusGhostAmount(buyer.address)).to.equal((alloc * 200n) / 10000n);
    });
});

describe("GhostSupplemental — GhostToken", function () {
    it("somme des six allocations égal TOTAL_SUPPLY", async function () {
        const Token = await ethers.getContractFactory("GhostToken");
        const token = await Token.deploy();
        await token.waitForDeployment();
        const s =
            (await token.AIRDROP_ALLOC()) +
            (await token.TREASURY_ALLOC()) +
            (await token.TEAM_ALLOC()) +
            (await token.REWARDS_ALLOC()) +
            (await token.LIQUIDITY_ALLOC()) +
            (await token.PRIVATE_SALE_ALLOC());
        expect(s).to.equal(await token.TOTAL_SUPPLY());
    });

    it("transfer vers soi-même laisse le solde inchangé", async function () {
        const [deployer] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("GhostToken");
        const token = await Token.deploy();
        await token.waitForDeployment();
        const b0 = await token.balanceOf(deployer.address);
        await token.transfer(deployer.address, ethers.parseEther("100"));
        expect(await token.balanceOf(deployer.address)).to.equal(b0);
    });

    it("balance initiale du déployeur = TOTAL_SUPPLY", async function () {
        const [deployer] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("GhostToken");
        const token = await Token.deploy();
        await token.waitForDeployment();
        expect(await token.balanceOf(deployer.address)).to.equal(await token.TOTAL_SUPPLY());
    });

    it("eip712Domain expose name et version", async function () {
        const Token = await ethers.getContractFactory("GhostToken");
        const token = await Token.deploy();
        await token.waitForDeployment();
        const d = await token.eip712Domain();
        expect(d.name).to.equal("Ghost Protocol");
        expect(d.version).to.equal("1");
    });
});

describe("GhostSupplemental — GhostPresale", function () {
    async function fx() {
        const [deployer, admin, b1, b2, stranger] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("GhostToken");
        const token = await Token.deploy();
        await token.waitForDeployment();
        const latest = await ethers.provider.getBlock("latest");
        const start = BigInt(latest!.timestamp) + 120n;
        const end = start + 86400n;
        const ghostPerEth = ethers.parseUnits("1000", 18);
        const hardCap = ethers.parseEther("100");
        const maxW = ethers.parseEther("50");
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
            hardCap,
            maxW,
            start,
            end
        );
        await presale.waitForDeployment();
        const pAddr = await presale.getAddress();
        await token.transfer(pAddr, await token.PRIVATE_SALE_ALLOC());
        return { token, presale, admin, b1, b2, stranger, start, end, ghostPerEth, hardCap, maxW, gpAddr };
    }

    it("remboursementVolontaire sans contribution : rien a rembourser", async function () {
        const { presale, stranger, start } = await loadFixture(fx);
        await time.setNextBlockTimestamp(Number(start + 1n));
        await expect(presale.connect(stranger).remboursementVolontaire()).to.be.revertedWith(
            "GhostPresale: rien a rembourser"
        );
    });

    it("admin() et ghostProtocolV2() alignés sur le déploiement", async function () {
        const { presale, admin, gpAddr } = await loadFixture(fx);
        expect(await presale.admin()).to.equal(admin.address);
        expect(await presale.ghostProtocolV2()).to.equal(gpAddr);
    });

    it("ethProceedsReceiver() aligné sur le déploiement", async function () {
        const { presale, admin } = await loadFixture(fx);
        expect(await presale.ethProceedsReceiver()).to.equal(admin.address);
    });

    it("immutables ghostPerEth, caps et fenêtre cohérents", async function () {
        const { presale, start, end, ghostPerEth, hardCap, maxW } = await loadFixture(fx);
        expect(await presale.ghostPerEth()).to.equal(ghostPerEth);
        expect(await presale.softCapEth()).to.equal(0n);
        expect(await presale.hardCapEth()).to.equal(hardCap);
        expect(await presale.maxPerWallet()).to.equal(maxW);
        expect(await presale.startTime()).to.equal(start);
        expect(await presale.endTime()).to.equal(end);
    });

    it("buyTokens avec 0 wei : montant zero", async function () {
        const { presale, b1, start } = await loadFixture(fx);
        await time.setNextBlockTimestamp(Number(start + 1n));
        await expect(presale.connect(b1).buyTokens({ value: 0 })).to.be.revertedWith("GhostPresale: montant zero");
    });

    it("deux achats buy + buyTokens cumulés sur le même wallet", async function () {
        const { presale, b1, start, ghostPerEth } = await loadFixture(fx);
        await time.setNextBlockTimestamp(Number(start + 1n));
        const a = ethers.parseEther("1");
        const c = ethers.parseEther("2");
        await presale.connect(b1).buy({ value: a });
        await presale.connect(b1).buyTokens({ value: c });
        const expected = ((a + c) * ghostPerEth) / ethers.parseEther("1");
        expect(await presale.contributions(b1.address)).to.equal(a + c);
        expect(await presale.tokenAllocation(b1.address)).to.equal(expected);
    });

    it("totalRaisedEth suit un achat unique", async function () {
        const { presale, b1, start } = await loadFixture(fx);
        const v = ethers.parseEther("3");
        await time.setNextBlockTimestamp(Number(start + 1n));
        await presale.connect(b1).buy({ value: v });
        expect(await presale.totalRaisedEth()).to.equal(v);
    });

    it("solde ETH du contrat prévente augmente à l’achat", async function () {
        const { presale, b1, start } = await loadFixture(fx);
        const v = ethers.parseEther("1");
        await time.setNextBlockTimestamp(Number(start + 1n));
        const addr = await presale.getAddress();
        const eth0 = await ethers.provider.getBalance(addr);
        await presale.connect(b1).buy({ value: v });
        expect(await ethers.provider.getBalance(addr)).to.equal(eth0 + v);
    });

    it("après finalize presaleInfo._finalized et plus _active", async function () {
        const { presale, admin, b1, b2, start, end, hardCap } = await loadFixture(fx);
        await time.increaseTo(Number(start + 1n));
        await presale.connect(b1).buy({ value: hardCap / 2n });
        await presale.connect(b2).buy({ value: hardCap - hardCap / 2n });
        await time.increaseTo(Number(end + 1n));
        await presale.connect(admin).finalize();
        const info = await presale.presaleInfo();
        expect(info._finalized).to.equal(true);
        expect(info._active).to.equal(false);
    });

    it("claim puis buyerInfo.hasClaimed true", async function () {
        const { presale, admin, b1, start, end } = await loadFixture(fx);
        await time.setNextBlockTimestamp(Number(start + 1n));
        await presale.connect(b1).buy({ value: ethers.parseEther("1") });
        await time.setNextBlockTimestamp(Number(end + 1n));
        await presale.connect(admin).finalize();
        await presale.connect(b1).claim();
        const bi = await presale.buyerInfo(b1.address);
        expect(bi.hasClaimed).to.equal(true);
    });
});

describe("GhostSupplemental — GhostVesting", function () {
    async function vfx() {
        const [deployer, beneficiary] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("GhostToken");
        const token = await Token.deploy();
        await token.waitForDeployment();
        const latest = await ethers.provider.getBlock("latest");
        const start = BigInt(latest!.timestamp) + 50n;
        const cliffDur = 100n;
        const vestDur = 1000n;
        const amount = ethers.parseEther("1000");
        const V = await ethers.getContractFactory("GhostVesting");
        const vesting = await V.deploy(
            await token.getAddress(),
            beneficiary.address,
            start,
            cliffDur,
            vestDur,
            amount
        );
        await vesting.waitForDeployment();
        const vAddr = await vesting.getAddress();
        await token.transfer(vAddr, amount);
        return { token, vesting, beneficiary, start, cliffDur, vestDur, amount };
    }

    it("vestedAmount avant cliff = 0", async function () {
        const { vesting, start, cliffDur } = await loadFixture(vfx);
        const t = start + cliffDur - 1n;
        expect(await vesting.vestedAmount(t)).to.equal(0n);
    });

    it("vestedAmount après fin de vesting = totalAmount", async function () {
        const { vesting, start, vestDur, amount } = await loadFixture(vfx);
        const t = start + vestDur + 1n;
        expect(await vesting.vestedAmount(t)).to.equal(amount);
    });

    it("getters token beneficiary duration totalAmount", async function () {
        const { vesting, token, beneficiary, amount, vestDur } = await loadFixture(vfx);
        expect(await vesting.token()).to.equal(await token.getAddress());
        expect(await vesting.beneficiary()).to.equal(beneficiary.address);
        expect(await vesting.duration()).to.equal(vestDur);
        expect(await vesting.totalAmount()).to.equal(amount);
    });
});

describe("GhostSupplemental — GhostTimelock", function () {
    it("getters après déploiement", async function () {
        const [deployer, beneficiary] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("GhostToken");
        const token = await Token.deploy();
        await token.waitForDeployment();
        const latest = await ethers.provider.getBlock("latest");
        const releaseTime = BigInt(latest!.timestamp) + 10_000n;
        const T = await ethers.getContractFactory("GhostTimelock");
        const lock = await T.deploy(await token.getAddress(), beneficiary.address, releaseTime);
        await lock.waitForDeployment();
        expect(await lock.token()).to.equal(await token.getAddress());
        expect(await lock.beneficiary()).to.equal(beneficiary.address);
        expect(await lock.releaseTime()).to.equal(releaseTime);
    });

    it("status.secondsRemaining > 0 avant échéance", async function () {
        const [deployer, beneficiary] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("GhostToken");
        const token = await Token.deploy();
        await token.waitForDeployment();
        const latest = await ethers.provider.getBlock("latest");
        const releaseTime = BigInt(latest!.timestamp) + 5000n;
        const T = await ethers.getContractFactory("GhostTimelock");
        const lock = await T.deploy(await token.getAddress(), beneficiary.address, releaseTime);
        await lock.waitForDeployment();
        const st = await lock.status();
        expect(st.isUnlocked).to.equal(false);
        expect(st.secondsRemaining).to.be.gt(0n);
    });

    it("lockedAmount suit le transfert de tokens vers le contrat", async function () {
        const [deployer, beneficiary] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("GhostToken");
        const token = await Token.deploy();
        await token.waitForDeployment();
        const latest = await ethers.provider.getBlock("latest");
        const releaseTime = BigInt(latest!.timestamp) + 8000n;
        const T = await ethers.getContractFactory("GhostTimelock");
        const lock = await T.deploy(await token.getAddress(), beneficiary.address, releaseTime);
        await lock.waitForDeployment();
        const lAddr = await lock.getAddress();
        const amt = ethers.parseEther("10");
        await token.transfer(lAddr, amt);
        const st = await lock.status();
        expect(st.lockedAmount).to.equal(amt);
    });
});
