/**
 * Tests — GhostEthProceedsSplitter (répartition ETH au finalize prévente).
 */
import { expect } from "chai";
import { ethers } from "hardhat";

describe("GhostEthProceedsSplitter", function () {
    it("répartit les ETH selon les bps (dernier index = reste des wei)", async function () {
        const [_, a, b] = await ethers.getSigners();
        const Factory = await ethers.getContractFactory("GhostEthProceedsSplitter");
        const splitter = await Factory.deploy([a.address, b.address], [5000, 5000]);
        await splitter.waitForDeployment();
        const addr = await splitter.getAddress();

        const oneEth = ethers.parseEther("1");
        const ba0 = await ethers.provider.getBalance(a.address);
        const bb0 = await ethers.provider.getBalance(b.address);

        await _.sendTransaction({ to: addr, value: oneEth });

        const ba1 = await ethers.provider.getBalance(a.address);
        const bb1 = await ethers.provider.getBalance(b.address);
        const half = oneEth / 2n;
        /** Premier : floor(1e18 * 5000 / 10000) = 0.5 ETH ; dernier : reste */
        expect(ba1 - ba0).to.equal(half);
        expect(bb1 - bb0).to.equal(oneEth - half);
        expect(await ethers.provider.getBalance(addr)).to.equal(0n);
    });

    it("émet EthProceedsSplit", async function () {
        const [deployer, a, b] = await ethers.getSigners();
        const Factory = await ethers.getContractFactory("GhostEthProceedsSplitter");
        const splitter = await Factory.deploy([a.address, b.address], [5000, 5000]);
        await splitter.waitForDeployment();
        const addr = await splitter.getAddress();
        const tx = await deployer.sendTransaction({ to: addr, value: ethers.parseEther("0.1") });
        const rec = await tx.wait();
        const iface = splitter.interface;
        const topic = iface.getEvent("EthProceedsSplit")!.topicHash;
        const log = rec!.logs.find((l) => l.topics[0] === topic);
        expect(log).to.not.be.undefined;
    });

    it("rejette si la somme des bps ≠ 10_000", async function () {
        const [_, a, b] = await ethers.getSigners();
        const Factory = await ethers.getContractFactory("GhostEthProceedsSplitter");
        await expect(Factory.deploy([a.address, b.address], [5000, 4999])).to.be.revertedWith(
            "GhostEthSplitter: bps sum"
        );
    });

    it("rejette un recipient zéro", async function () {
        const [, a] = await ethers.getSigners();
        const Factory = await ethers.getContractFactory("GhostEthProceedsSplitter");
        await expect(
            Factory.deploy([a.address, ethers.ZeroAddress], [5000, 5000])
        ).to.be.revertedWith("GhostEthSplitter: zero recipient");
    });
});
