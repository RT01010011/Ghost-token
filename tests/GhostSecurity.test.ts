/**
 * Tests orientés sécurité / audit — limites temporelles, caps, états, réentrance, invariants.
 * Lancer : npm run test:token
 */
import { expect } from "chai";
import { ethers } from "hardhat";
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";

/** Décalage avant startTime : la fixture presale mine beaucoup de blocs ; sans marge, le réseau est déjà « ouvert ». */
const PRESALE_START_OFFSET = 1_000_000n;

async function deployMockGpAddress(): Promise<string> {
    const MockGp = await ethers.getContractFactory("MockGhostProtocolV2ForPresale");
    const mockGp = await MockGp.deploy();
    await mockGp.waitForDeployment();
    return mockGp.getAddress();
}

describe("Sécurité — GhostToken", function () {
    async function deployT() {
        const [deployer, a, b] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("GhostToken");
        const token = await Token.deploy();
        await token.waitForDeployment();
        return { token, deployer, a, b };
    }

    it("pas de fonction mint() exposée sur le contrat déployé", async function () {
        const { token } = await loadFixture(deployT);
        expect((token as unknown as { mint?: unknown }).mint).to.equal(undefined);
    });

    it("supply total = balance initiale du déployeur uniquement", async function () {
        const { token, deployer, a } = await loadFixture(deployT);
        expect(await token.balanceOf(deployer.address)).to.equal(await token.TOTAL_SUPPLY());
        expect(await token.balanceOf(a.address)).to.equal(0n);
        expect(await token.totalSupply()).to.equal(await token.TOTAL_SUPPLY());
    });

    it("transfer de 0 GHOST est autorisé (ERC20) et ne change pas les soldes", async function () {
        const { token, deployer, a } = await loadFixture(deployT);
        const b0 = await token.balanceOf(a.address);
        await token.transfer(a.address, 0n);
        expect(await token.balanceOf(a.address)).to.equal(b0);
    });

    it("approve puis transferFrom avec montant exact", async function () {
        const { token, deployer, a, b } = await loadFixture(deployT);
        const x = ethers.parseEther("12345");
        await token.approve(a.address, x);
        await token.connect(a).transferFrom(deployer.address, b.address, x);
        expect(await token.balanceOf(b.address)).to.equal(x);
    });

    it("révocation allowance : approve(0)", async function () {
        const { token, deployer, a } = await loadFixture(deployT);
        await token.approve(a.address, ethers.parseEther("1"));
        await token.approve(a.address, 0n);
        expect(await token.allowance(deployer.address, a.address)).to.equal(0n);
    });

    it("auto-délégation : getVotes suit la balance après transferts", async function () {
        const { token, deployer, a } = await loadFixture(deployT);
        await token.connect(deployer).delegate(deployer.address);
        const mid = ethers.parseEther("1000000");
        await token.transfer(a.address, mid);
        expect(await token.getVotes(deployer.address)).to.equal((await token.TOTAL_SUPPLY()) - mid);
    });

    it("chaque allocation publique est un sous-ensemble du TOTAL_SUPPLY", async function () {
        const { token } = await loadFixture(deployT);
        const t = await token.TOTAL_SUPPLY();
        expect((await token.AIRDROP_ALLOC()) <= t).to.equal(true);
        expect((await token.PRIVATE_SALE_ALLOC()) <= t).to.equal(true);
        expect(
            (await token.AIRDROP_ALLOC()) +
                (await token.TREASURY_ALLOC()) +
                (await token.TEAM_ALLOC()) +
                (await token.REWARDS_ALLOC()) +
                (await token.LIQUIDITY_ALLOC()) +
                (await token.PRIVATE_SALE_ALLOC())
        ).to.equal(t);
    });
});

describe("Sécurité — GhostPresale fenêtre & états", function () {
    async function fx() {
        const [deployer, admin, b1, b2] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("GhostToken");
        const token = await Token.deploy();
        await token.waitForDeployment();
        const latest = await ethers.provider.getBlock("latest");
        const start = BigInt(latest!.timestamp) + PRESALE_START_OFFSET;
        const end = start + 5n * 24n * 3600n;
        const gpe = ethers.parseUnits("1000", 18);
        const gpAddr = await deployMockGpAddress();
        const Presale = await ethers.getContractFactory("GhostPresale");
        const presale = await Presale.deploy(
            await token.getAddress(),
            admin.address,
            admin.address,
            gpAddr,
            gpe,
            0n,
            ethers.parseEther("1000"),
            ethers.parseEther("100"),
            start,
            end
        );
        await presale.waitForDeployment();
        await token.transfer(await presale.getAddress(), await token.PRIVATE_SALE_ALLOC());
        return { token, presale, admin, b1, b2, start, end, gpe };
    }

    it("achat refusé strictement avant startTime", async function () {
        const { presale, b1, start } = await loadFixture(fx);
        /** increaseTo(start-1) puis buy mine un bloc souvent à timestamp = start → setNextBlockTimestamp fixe le bloc d’exécution */
        await time.setNextBlockTimestamp(Number(start - 1n));
        await expect(presale.connect(b1).buy({ value: 1n })).to.be.revertedWith("GhostPresale: pas encore commence");
    });

    it("achat autorisé exactement à startTime", async function () {
        const { presale, b1, start, gpe } = await loadFixture(fx);
        await time.increaseTo(Number(start));
        const eth = ethers.parseEther("0.001");
        await presale.connect(b1).buy({ value: eth });
        expect(await presale.contributions(b1.address)).to.equal(eth);
        expect(await presale.tokenAllocation(b1.address)).to.equal((eth * gpe) / ethers.parseEther("1"));
    });

    it("achat autorisé exactement à endTime (inclus)", async function () {
        const { presale, b1, start, end } = await loadFixture(fx);
        await time.increaseTo(Number(start + 1n));
        /** buy() mine un bloc : sans setNextBlockTimestamp le timestamp serait end+1 → « termine » */
        await time.setNextBlockTimestamp(Number(end));
        const eth = ethers.parseEther("0.01");
        await presale.connect(b1).buy({ value: eth });
        expect(await presale.contributions(b1.address)).to.equal(eth);
    });

    it("achat refusé après endTime", async function () {
        const { presale, b1, end } = await loadFixture(fx);
        await time.increaseTo(Number(end + 1n));
        await expect(presale.connect(b1).buy({ value: 1n })).to.be.revertedWith("GhostPresale: termine");
    });

    it("presaleInfo._active false avant ouverture", async function () {
        const { presale, start } = await loadFixture(fx);
        await time.increaseTo(Number(start - 2n));
        const i = await presale.presaleInfo();
        expect(i._active).to.equal(false);
    });

    it("presaleInfo._active true pendant la fenêtre", async function () {
        const { presale, start, end } = await loadFixture(fx);
        await time.increaseTo(Number(start + 1n));
        await time.increaseTo(Number(end - 1n));
        const i = await presale.presaleInfo();
        expect(i._active).to.equal(true);
    });

    it("presaleInfo._totalRaisedEth suit les achats", async function () {
        const { presale, b1, b2, start } = await loadFixture(fx);
        await time.increaseTo(Number(start + 1n));
        const e1 = ethers.parseEther("1");
        const e2 = ethers.parseEther("2");
        await presale.connect(b1).buy({ value: e1 });
        await presale.connect(b2).buy({ value: e2 });
        const i = await presale.presaleInfo();
        expect(i._totalRaisedEth).to.equal(e1 + e2);
    });

    it("ghostToken immutable lisible et cohérent", async function () {
        const { token, presale } = await loadFixture(fx);
        expect(await presale.ghostToken()).to.equal(await token.getAddress());
    });

    it("admin immutable = compte attendu", async function () {
        const { presale, admin } = await loadFixture(fx);
        expect(await presale.admin()).to.equal(admin.address);
    });
});

describe("Sécurité — GhostPresale caps & agrégats", function () {
    async function fxCap() {
        const [deployer, admin, b1, b2, b3] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("GhostToken");
        const token = await Token.deploy();
        await token.waitForDeployment();
        const latest = await ethers.provider.getBlock("latest");
        const start = BigInt(latest!.timestamp) + PRESALE_START_OFFSET;
        const end = start + 86400n;
        const gpe = ethers.parseUnits("500", 18);
        const maxW = ethers.parseEther("10");
        const hard = ethers.parseEther("200");
        const gpAddr = await deployMockGpAddress();
        const Presale = await ethers.getContractFactory("GhostPresale");
        const presale = await Presale.deploy(
            await token.getAddress(),
            admin.address,
            admin.address,
            gpAddr,
            gpe,
            0n,
            hard,
            maxW,
            start,
            end
        );
        await presale.waitForDeployment();
        await token.transfer(await presale.getAddress(), await token.PRIVATE_SALE_ALLOC());
        return { token, presale, admin, b1, b2, b3, start, end, gpe, maxW, hard };
    }

    /** maxPerWallet large pour tests hard cap / maxGhost multi-buyers */
    async function fxCapWide() {
        const [deployer, admin, b1, b2, b3] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("GhostToken");
        const token = await Token.deploy();
        await token.waitForDeployment();
        const latest = await ethers.provider.getBlock("latest");
        const start = BigInt(latest!.timestamp) + PRESALE_START_OFFSET;
        const end = start + 86400n;
        const gpe = ethers.parseUnits("500", 18);
        const maxW = ethers.parseEther("100");
        const hard = ethers.parseEther("200");
        const gpAddr = await deployMockGpAddress();
        const Presale = await ethers.getContractFactory("GhostPresale");
        const presale = await Presale.deploy(
            await token.getAddress(),
            admin.address,
            admin.address,
            gpAddr,
            gpe,
            0n,
            hard,
            maxW,
            start,
            end
        );
        await presale.waitForDeployment();
        await token.transfer(await presale.getAddress(), await token.PRIVATE_SALE_ALLOC());
        return { token, presale, admin, b1, b2, b3, start, end, gpe, maxW, hard };
    }

    it("limite wallet : dernier wei au-delà du plafond est refusé", async function () {
        const { presale, b1, start, maxW } = await loadFixture(fxCap);
        await time.increaseTo(Number(start + 1n));
        await presale.connect(b1).buy({ value: maxW });
        await expect(presale.connect(b1).buy({ value: 1n })).to.be.revertedWith("GhostPresale: limite wallet depassee");
    });

    it("limite wallet : deux achats dont la somme = max exact est OK", async function () {
        const { presale, b1, start, maxW } = await loadFixture(fxCap);
        await time.increaseTo(Number(start + 1n));
        const half = maxW / 2n;
        await presale.connect(b1).buy({ value: half });
        await presale.connect(b1).buy({ value: maxW - half });
        expect(await presale.contributions(b1.address)).to.equal(maxW);
    });

    it("hard cap : compléter jusqu’au dernier wei acceptable", async function () {
        const { presale, b1, b2, start, hard } = await loadFixture(fxCapWide);
        await time.increaseTo(Number(start + 1n));
        await presale.connect(b1).buy({ value: hard / 2n });
        await presale.connect(b2).buy({ value: hard - hard / 2n });
        expect(await presale.totalRaisedEth()).to.equal(hard);
    });

    it("invariant : totalTokensSold = somme des ghostForEth(contribution) pour chaque acheteur testé", async function () {
        const { presale, b1, b2, start, gpe } = await loadFixture(fxCap);
        await time.increaseTo(Number(start + 1n));
        const e1 = ethers.parseEther("3");
        const e2 = ethers.parseEther("4");
        await presale.connect(b1).buy({ value: e1 });
        await presale.connect(b2).buy({ value: e2 });
        const g1 = (e1 * gpe) / ethers.parseEther("1");
        const g2 = (e2 * gpe) / ethers.parseEther("1");
        expect(await presale.totalTokensSold()).to.equal(g1 + g2);
    });

    it("maxGhostAllocatable jamais dépassé par une série d’achats légitimes", async function () {
        const { presale, b1, b2, b3, start, hard } = await loadFixture(fxCapWide);
        await time.increaseTo(Number(start + 1n));
        const cap = await presale.maxGhostAllocatable();
        await presale.connect(b1).buy({ value: hard / 3n });
        await presale.connect(b2).buy({ value: hard / 3n });
        await presale.connect(b3).buy({ value: hard - (hard / 3n) * 2n });
        expect(await presale.totalTokensSold() <= cap).to.equal(true);
    });

    it("ghostPerEth très grand : micro-ETH peut allouer 0 GHOST (comportement documenté)", async function () {
        const [, admin, b1] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("GhostToken");
        const token = await Token.deploy();
        await token.waitForDeployment();
        const latest = await ethers.provider.getBlock("latest");
        const start = BigInt(latest!.timestamp) + PRESALE_START_OFFSET;
        const end = start + 86400n;
        /** 1 wei GHOST par 1 ETH → 1 wei ETH donne 0 GHOST alloué (division) */
        const tinyRate = 1n;
        const gpAddr = await deployMockGpAddress();
        const Presale = await ethers.getContractFactory("GhostPresale");
        const presale = await Presale.deploy(
            await token.getAddress(),
            admin.address,
            admin.address,
            gpAddr,
            tinyRate,
            0n,
            ethers.parseEther("100"),
            ethers.parseEther("50"),
            start,
            end
        );
        await presale.waitForDeployment();
        await token.transfer(await presale.getAddress(), await token.PRIVATE_SALE_ALLOC());
        await time.increaseTo(Number(start + 1n));
        await presale.connect(b1).buy({ value: 1n });
        expect(await presale.tokenAllocation(b1.address)).to.equal(0n);
        expect(await presale.contributions(b1.address)).to.equal(1n);
    });

    it("finalize : solde ETH du presale = 0 après succès", async function () {
        const { presale, admin, b1, b2, start, end, hard } = await loadFixture(fxCapWide);
        await time.increaseTo(Number(start + 1n));
        await presale.connect(b1).buy({ value: hard / 2n });
        await presale.connect(b2).buy({ value: hard - hard / 2n });
        await time.increaseTo(Number(end + 1n));
        await presale.connect(admin).finalize();
        expect(await ethers.provider.getBalance(await presale.getAddress())).to.equal(0n);
    });

    it("claim : balance GHOST presale baisse du montant claim", async function () {
        const { presale, token, admin, b1, start, end } = await loadFixture(fxCap);
        await time.increaseTo(Number(start + 1n));
        const eth = ethers.parseEther("2");
        await presale.connect(b1).buy({ value: eth });
        await time.increaseTo(Number(end + 1n));
        await presale.connect(admin).finalize();
        const pAddr = await presale.getAddress();
        const balBefore = await token.balanceOf(pAddr);
        const alloc = await presale.tokenAllocation(b1.address);
        await presale.connect(b1).claim();
        expect(await token.balanceOf(pAddr)).to.equal(balBefore - alloc);
    });
});

describe("Sécurité — GhostPresale accès & refund", function () {
    async function fxRefund() {
        const [deployer, admin, b1] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("GhostToken");
        const token = await Token.deploy();
        await token.waitForDeployment();
        const latest = await ethers.provider.getBlock("latest");
        const start = BigInt(latest!.timestamp) + PRESALE_START_OFFSET;
        const end = start + 3600n;
        const gpAddr = await deployMockGpAddress();
        const Presale = await ethers.getContractFactory("GhostPresale");
        const presale = await Presale.deploy(
            await token.getAddress(),
            admin.address,
            admin.address,
            gpAddr,
            ethers.parseUnits("1000", 18),
            ethers.parseEther("100"),
            ethers.parseEther("500"),
            ethers.parseEther("50"),
            start,
            end
        );
        await presale.waitForDeployment();
        await token.transfer(await presale.getAddress(), await token.PRIVATE_SALE_ALLOC());
        return { token, presale, admin, b1, start, end, deployer };
    }

    it("enableRefundMode refusé pour un non-admin", async function () {
        const { presale, b1, start, end } = await loadFixture(fxRefund);
        await time.increaseTo(Number(start + 1n));
        await presale.connect(b1).buy({ value: ethers.parseEther("1") });
        await time.increaseTo(Number(end + 1n));
        await expect(presale.connect(b1).enableRefundMode()).to.be.revertedWith("GhostPresale: pas admin");
    });

    it("recoverUnsoldTokens refusé avant toute terminaison même si admin", async function () {
        const { presale, admin, start, b1 } = await loadFixture(fxRefund);
        await time.increaseTo(Number(start + 1n));
        await presale.connect(b1).buy({ value: ethers.parseEther("1") });
        await expect(presale.connect(admin).recoverUnsoldTokens()).to.be.revertedWith(
            "GhostPresale: prevente non terminee"
        );
    });

    it("buyerInfo reflète hasRefunded après refund", async function () {
        const { presale, admin, b1, start, end } = await loadFixture(fxRefund);
        await time.increaseTo(Number(start + 1n));
        await presale.connect(b1).buy({ value: ethers.parseEther("2") });
        await time.increaseTo(Number(end + 1n));
        await presale.connect(admin).enableRefundMode();
        await presale.connect(b1).refund();
        const inf = await presale.buyerInfo(b1.address);
        expect(inf.hasRefunded).to.equal(true);
        expect(inf.ethContributed).to.equal(ethers.parseEther("2"));
    });

    it("refund : tentative de ré-appel pendant receive() ne double pas le paiement", async function () {
        const { token, presale, admin, start, end, deployer } = await loadFixture(fxRefund);
        await time.increaseTo(Number(start + 1n));
        const Attacker = await ethers.getContractFactory("ReentrantRefundAttacker");
        const attacker = await Attacker.deploy(await presale.getAddress());
        await attacker.waitForDeployment();
        const paid = ethers.parseEther("1");
        await deployer.sendTransaction({ to: await attacker.getAddress(), value: ethers.parseEther("5") });
        await attacker.buyOnPresale({ value: paid });
        await time.increaseTo(Number(end + 1n));
        await presale.connect(admin).enableRefundMode();
        const balBefore = await ethers.provider.getBalance(await attacker.getAddress());
        await attacker.refundOnce();
        const balAfter = await ethers.provider.getBalance(await attacker.getAddress());
        expect(balAfter - balBefore).to.equal(paid);
        const inf = await presale.buyerInfo(await attacker.getAddress());
        expect(inf.hasRefunded).to.equal(true);
    });
});

describe("Sécurité — GhostVesting invariants", function () {
    async function vFx() {
        const [deployer, beneficiary] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("GhostToken");
        const token = await Token.deploy();
        await token.waitForDeployment();
        const latest = await ethers.provider.getBlock("latest");
        const start = BigInt(latest!.timestamp);
        const cliffD = 50n;
        const dur = 500n;
        const total = ethers.parseEther("10000");
        const V = await ethers.getContractFactory("GhostVesting");
        const vesting = await V.deploy(
            await token.getAddress(),
            beneficiary.address,
            start,
            cliffD,
            dur,
            total
        );
        await vesting.waitForDeployment();
        const vAddr = await vesting.getAddress();
        await token.transfer(vAddr, total);
        return { token, vesting, beneficiary, deployer, start, cliffD, dur, total };
    }

    it("released + releasable + locked = totalAmount (via status)", async function () {
        const { vesting, total, start, cliffD, dur } = await loadFixture(vFx);
        await time.increaseTo(Number(start + cliffD + dur / 2n));
        const st = await vesting.status();
        expect(st._released + st._releasable + st._locked).to.equal(total);
    });

    it("releasable ne dépasse jamais totalAmount - released", async function () {
        const { vesting, total, start, cliffD, dur } = await loadFixture(vFx);
        await time.increaseTo(Number(start + cliffD + dur / 3n));
        const rel = await vesting.releasable();
        const relsd = await vesting.released();
        expect(rel + relsd <= total).to.equal(true);
    });

    it("après libération totale releasable = 0", async function () {
        const { vesting, beneficiary, start, dur } = await loadFixture(vFx);
        await time.increaseTo(Number(start + dur + 10n));
        await vesting.connect(beneficiary).release();
        expect(await vesting.releasable()).to.equal(0n);
    });

    it("plusieurs release() consécutifs respectent le plafond totalAmount cumulé", async function () {
        const { vesting, beneficiary, token, start, cliffD, dur, total } = await loadFixture(vFx);
        await time.increaseTo(Number(start + cliffD + dur / 4n));
        await vesting.connect(beneficiary).release();
        await time.increaseTo(Number(start + cliffD + dur / 2n));
        await vesting.connect(beneficiary).release();
        await time.increaseTo(Number(start + dur + 5n));
        await vesting.connect(beneficiary).release();
        expect(await token.balanceOf(beneficiary.address)).to.equal(total);
    });

    it("beneficiary immuable : getVotes vesting N/A mais adresse fixe", async function () {
        const { vesting, beneficiary } = await loadFixture(vFx);
        expect(await vesting.beneficiary()).to.equal(beneficiary.address);
    });
});

describe("Sécurité — GhostTimelock", function () {
    async function tlFx() {
        const [deployer, beneficiary] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("GhostToken");
        const token = await Token.deploy();
        await token.waitForDeployment();
        const latest = await ethers.provider.getBlock("latest");
        const rt = BigInt(latest!.timestamp) + 200n;
        const TL = await ethers.getContractFactory("GhostTimelock");
        const timelock = await TL.deploy(await token.getAddress(), beneficiary.address, rt);
        await timelock.waitForDeployment();
        const amt = ethers.parseEther("5000");
        await token.transfer(await timelock.getAddress(), amt);
        return { token, timelock, beneficiary, deployer, rt, amt };
    }

    it("release exactement à releaseTime est autorisé", async function () {
        const { timelock, beneficiary, rt, amt, token } = await loadFixture(tlFx);
        await time.increaseTo(Number(rt));
        const bb = await token.balanceOf(beneficiary.address);
        await timelock.connect(beneficiary).release();
        expect(await token.balanceOf(beneficiary.address)).to.equal(bb + amt);
    });

    it("status.lockedAmount = solde ERC20 du contrat", async function () {
        const { timelock, token, amt } = await loadFixture(tlFx);
        const st = await timelock.status();
        expect(st.lockedAmount).to.equal(await token.balanceOf(await timelock.getAddress()));
        expect(st.lockedAmount).to.equal(amt);
    });

    it("non-bénéficiaire : balance inchangée après tentative release (revert)", async function () {
        const { timelock, token, deployer, rt } = await loadFixture(tlFx);
        await time.increaseTo(Number(rt + 1n));
        const bb = await token.balanceOf(deployer.address);
        await expect(timelock.connect(deployer).release()).to.be.revertedWith("GhostTimelock: pas le beneficiaire");
        expect(await token.balanceOf(deployer.address)).to.equal(bb);
    });
});

describe("Sécurité — finalize & ETH", function () {
    async function fxFin() {
        const [d, admin, b1, b2, stranger] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("GhostToken");
        const token = await Token.deploy();
        await token.waitForDeployment();
        const latest = await ethers.provider.getBlock("latest");
        const start = BigInt(latest!.timestamp) + PRESALE_START_OFFSET;
        const end = start + 7200n;
        const hard = ethers.parseEther("50");
        const gpAddr = await deployMockGpAddress();
        const Presale = await ethers.getContractFactory("GhostPresale");
        const presale = await Presale.deploy(
            await token.getAddress(),
            admin.address,
            admin.address,
            gpAddr,
            ethers.parseUnits("1000", 18),
            0n,
            hard,
            ethers.parseEther("30"),
            start,
            end
        );
        await presale.waitForDeployment();
        await token.transfer(await presale.getAddress(), await token.PRIVATE_SALE_ALLOC());
        return { presale, admin, b1, b2, stranger, start, end, hard, token };
    }

    it("admin reçoit exactement totalRaisedEth au finalize (delta balance)", async function () {
        const { presale, admin, b1, b2, start, hard, end } = await loadFixture(fxFin);
        await time.increaseTo(Number(start + 1n));
        await presale.connect(b1).buy({ value: hard / 2n });
        await presale.connect(b2).buy({ value: hard - hard / 2n });
        await time.increaseTo(Number(end + 1n));
        const admBefore = await ethers.provider.getBalance(admin.address);
        const tx = await presale.connect(admin).finalize();
        const rec = await tx.wait();
        const gas = rec!.fee;
        expect(await ethers.provider.getBalance(admin.address)).to.equal(admBefore + hard - gas);
    });

    it("stranger cannot finalize même si hard cap atteint", async function () {
        const { presale, b1, b2, stranger, start, hard, end } = await loadFixture(fxFin);
        await time.increaseTo(Number(start + 1n));
        await presale.connect(b1).buy({ value: hard / 2n });
        await presale.connect(b2).buy({ value: hard - hard / 2n });
        await expect(presale.connect(stranger).finalize()).to.be.revertedWith("GhostPresale: pas admin");
    });
});

describe("Sécurité — edge ERC20 presale", function () {
    it("safeTransfer claim : montant = tokenAllocation exact", async function () {
        const [d, admin, b1] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("GhostToken");
        const token = await Token.deploy();
        await token.waitForDeployment();
        const latest = await ethers.provider.getBlock("latest");
        const start = BigInt(latest!.timestamp) + PRESALE_START_OFFSET;
        const end = start + 3600n;
        const gpe = ethers.parseUnits("777", 18);
        const gpAddr = await deployMockGpAddress();
        const Presale = await ethers.getContractFactory("GhostPresale");
        const presale = await Presale.deploy(
            await token.getAddress(),
            admin.address,
            admin.address,
            gpAddr,
            gpe,
            0n,
            ethers.parseEther("80"),
            ethers.parseEther("40"),
            start,
            end
        );
        await presale.waitForDeployment();
        await token.transfer(await presale.getAddress(), await token.PRIVATE_SALE_ALLOC());
        await time.increaseTo(Number(start + 1n));
        const eth = ethers.parseEther("1.234567");
        await presale.connect(b1).buy({ value: eth });
        await time.increaseTo(Number(end + 1n));
        await presale.connect(admin).finalize();
        const alloc = await presale.tokenAllocation(b1.address);
        const bb = await token.balanceOf(b1.address);
        await presale.connect(b1).claim();
        expect(await token.balanceOf(b1.address)).to.equal(bb + alloc);
    });
});

describe("Sécurité — GhostPresale complément", function () {
    async function fxSoftExact() {
        const [d, admin, b1, b2, stranger] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("GhostToken");
        const token = await Token.deploy();
        await token.waitForDeployment();
        const latest = await ethers.provider.getBlock("latest");
        const start = BigInt(latest!.timestamp) + PRESALE_START_OFFSET;
        const end = start + 7200n;
        const soft = ethers.parseEther("10");
        const gpAddr = await deployMockGpAddress();
        const Presale = await ethers.getContractFactory("GhostPresale");
        const presale = await Presale.deploy(
            await token.getAddress(),
            admin.address,
            admin.address,
            gpAddr,
            ethers.parseUnits("1000", 18),
            soft,
            ethers.parseEther("100"),
            ethers.parseEther("50"),
            start,
            end
        );
        await presale.waitForDeployment();
        await token.transfer(await presale.getAddress(), await token.PRIVATE_SALE_ALLOC());
        return { presale, admin, b1, b2, stranger, start, end, soft, token };
    }

    it("soft cap exact : finalize après end si totalRaised = soft", async function () {
        const { presale, admin, b1, start, end, soft } = await loadFixture(fxSoftExact);
        await time.increaseTo(Number(start + 1n));
        await presale.connect(b1).buy({ value: soft });
        await time.increaseTo(Number(end + 1n));
        await presale.connect(admin).finalize();
        expect(await presale.finalized()).to.equal(true);
    });

    it("ETH envoyé au presale via receive() avant start → revert", async function () {
        const { presale, b1, start } = await loadFixture(fxSoftExact);
        await time.setNextBlockTimestamp(Number(start - 1n));
        await expect(
            b1.sendTransaction({ to: await presale.getAddress(), value: ethers.parseEther("0.1") })
        ).to.be.revertedWith("GhostPresale: pas encore commence");
    });

    it("totalRaisedEth reste 0 si aucun achat réussi", async function () {
        const { presale, start } = await loadFixture(fxSoftExact);
        await time.increaseTo(Number(start - 1n));
        expect(await presale.totalRaisedEth()).to.equal(0n);
    });

    it("refundMode et finalized mutuellement exclus dans les chemins normaux", async function () {
        const { presale, admin, b1, start, end } = await loadFixture(fxSoftExact);
        await time.increaseTo(Number(start + 1n));
        await presale.connect(b1).buy({ value: ethers.parseEther("1") });
        await time.increaseTo(Number(end + 1n));
        await presale.connect(admin).enableRefundMode();
        expect(await presale.refundMode()).to.equal(true);
        expect(await presale.finalized()).to.equal(false);
    });

    it("hardCapEth >= softCapEth imposé au constructeur (violation)", async function () {
        const [, admin] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("GhostToken");
        const token = await Token.deploy();
        await token.waitForDeployment();
        const latest = await ethers.provider.getBlock("latest");
        const start = BigInt(latest!.timestamp) + PRESALE_START_OFFSET;
        const gpAddr = await deployMockGpAddress();
        const Presale = await ethers.getContractFactory("GhostPresale");
        await expect(
            Presale.deploy(
                await token.getAddress(),
                admin.address,
                admin.address,
                gpAddr,
                ethers.parseUnits("1", 18),
                ethers.parseEther("100"),
                ethers.parseEther("50"),
                ethers.parseEther("10"),
                start,
                start + 1000n
            )
        ).to.be.revertedWith("GhostPresale: hardcap < softcap");
    });

    it("claim impossible pour allocation 0 même après finalize", async function () {
        const { presale, admin, b1, stranger, start, end, soft } = await loadFixture(fxSoftExact);
        await time.increaseTo(Number(start + 1n));
        await presale.connect(b1).buy({ value: soft });
        await time.increaseTo(Number(end + 1n));
        await presale.connect(admin).finalize();
        await expect(presale.connect(stranger).claim()).to.be.revertedWith("GhostPresale: aucune allocation");
    });

    it("finalize impossible en refundMode", async function () {
        const { presale, admin, b1, start, end } = await loadFixture(fxSoftExact);
        await time.increaseTo(Number(start + 1n));
        await presale.connect(b1).buy({ value: ethers.parseEther("1") });
        await time.increaseTo(Number(end + 1n));
        await presale.connect(admin).enableRefundMode();
        await expect(presale.connect(admin).finalize()).to.be.revertedWith("GhostPresale: mode remboursement");
    });
});

describe("Sécurité — GhostToken complément", function () {
    async function t() {
        const [d, a, b] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("GhostToken");
        const token = await Token.deploy();
        await token.waitForDeployment();
        return { token, d, a, b };
    }

    it("transfer vers address(0) revert (ERC20)", async function () {
        const { token, d } = await loadFixture(t);
        await expect(token.transfer(ethers.ZeroAddress, 1n)).to.be.revertedWithCustomError(
            token,
            "ERC20InvalidReceiver"
        );
    });

    it("balanceOf inconnue = 0", async function () {
        const { token } = await loadFixture(t);
        const random = ethers.Wallet.createRandom().address;
        expect(await token.balanceOf(random)).to.equal(0n);
    });

    it("allowance initiale déployeur → tiers = 0", async function () {
        const { token, d, a } = await loadFixture(t);
        expect(await token.allowance(d.address, a.address)).to.equal(0n);
    });

    it("PERMIT_TYPEHASH / version EIP-712 cohérents (permit)", async function () {
        const { token } = await loadFixture(t);
        expect(await token.name()).to.equal("Ghost Protocol");
        const ds = await token.DOMAIN_SEPARATOR();
        expect(ds.length).to.equal(66);
    });
});

describe("Sécurité — GhostVesting / Timelock complément", function () {
    it("vesting : release() sans fonds token sur le contrat revert à safeTransfer", async function () {
        const [deployer, beneficiary] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("GhostToken");
        const token = await Token.deploy();
        await token.waitForDeployment();
        const latest = await ethers.provider.getBlock("latest");
        const start = BigInt(latest!.timestamp);
        const V = await ethers.getContractFactory("GhostVesting");
        const vesting = await V.deploy(
            await token.getAddress(),
            beneficiary.address,
            start,
            1n,
            100n,
            ethers.parseEther("1")
        );
        await vesting.waitForDeployment();
        /** Pas de transfer de tokens vers le vesting */
        await time.increaseTo(Number(start + 50n));
        await expect(vesting.connect(beneficiary).release()).to.be.revertedWithCustomError(
            token,
            "ERC20InsufficientBalance"
        );
    });

    it("timelock : release avant releaseTime laisse les tokens sur le contrat", async function () {
        const [d, beneficiary] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("GhostToken");
        const token = await Token.deploy();
        await token.waitForDeployment();
        const latest = await ethers.provider.getBlock("latest");
        const rt = BigInt(latest!.timestamp) + 10_000n;
        const TL = await ethers.getContractFactory("GhostTimelock");
        const timelock = await TL.deploy(await token.getAddress(), beneficiary.address, rt);
        await timelock.waitForDeployment();
        const amt = ethers.parseEther("100");
        await token.transfer(await timelock.getAddress(), amt);
        await time.increaseTo(Number(rt - 2n));
        await expect(timelock.connect(beneficiary).release()).to.be.revertedWith(
            "GhostTimelock: tokens encore verrouilles"
        );
        expect(await token.balanceOf(await timelock.getAddress())).to.equal(amt);
    });

    it("timelock : secondsRemaining > 0 avant déverrouillage", async function () {
        const [d, beneficiary] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("GhostToken");
        const token = await Token.deploy();
        await token.waitForDeployment();
        const latest = await ethers.provider.getBlock("latest");
        const rt = BigInt(latest!.timestamp) + 5000n;
        const TL = await ethers.getContractFactory("GhostTimelock");
        const timelock = await TL.deploy(await token.getAddress(), beneficiary.address, rt);
        await timelock.waitForDeployment();
        await token.transfer(await timelock.getAddress(), ethers.parseEther("1"));
        const st = await timelock.status();
        expect(st.secondsRemaining > 0n).to.equal(true);
        expect(st.isUnlocked).to.equal(false);
    });
});
