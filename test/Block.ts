
import {
    loadFixture,
    time,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

describe("Block", function () {
    // We define a fixture to reuse the same setup in every test.
    async function deployBlockFixture() {
        const Block = await hre.ethers.getContractFactory("Block");
        const block = await Block.deploy();

        block.waitForDeployment()

        console.log("Storage deployed to:", block.address);

        return { block };
    }

    describe("Functionality", function () {
        it("Should return the correct value when multiplying", async function () {
            const { block } = await loadFixture(deployBlockFixture);

            const input = 7;

            const result = await block.multiply(input);

            expect(result).to.equal(49);
        });

        it("Should return the correct baseFee", async function () {
            const { block } = await loadFixture(deployBlockFixture);

            const result = await block.baseFee();

            expect(result).to.equal(0);
        });

        it("Should return the correct chainId", async function () {
            const { block } = await loadFixture(deployBlockFixture);

            const result = await block.coinbase();

            expect(result).to.equal('0xC014BA5EC014ba5ec014Ba5EC014ba5Ec014bA5E')
        });

        it("Should return the correct timestamp", async function () {
            const { block } = await loadFixture(deployBlockFixture);

            const currentTimestamp = await time.latest();

            const result = await block.timestamp();

            expect(result).to.equal(currentTimestamp)
        });

        it("Should return the correct gasLimit", async function () {
            const { block } = await loadFixture(deployBlockFixture);

            const result = await block.gasLimit();

            expect(result).to.equal('30000000')
        });

        it("Should return the correct blocknumber", async function () {
            const { block } = await loadFixture(deployBlockFixture);

            const blockNumber = await hre.ethers.provider.getBlockNumber();
            const result = await block.blockNumber();

            expect(result).to.equal(blockNumber)
        });

        it("Should return the correct blockHash", async function () {
            const { block } = await loadFixture(deployBlockFixture);

            const b = await hre.ethers.provider.getBlock("latest");
            const blockNumber = await hre.ethers.provider.getBlockNumber();
            const previous = await block.blockHash(blockNumber - 1);
            const latest = await block.blockHash(blockNumber);

            expect(previous).to.not.equal('0x0000000000000000000000000000000000000000000000000000000000000000')
            expect(previous).to.equal(`${b.parentHash}`)
            expect(latest).to.equal('0x0000000000000000000000000000000000000000000000000000000000000000')
        });

    });
});
