
import {
    loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

describe("ExplicitRevertReason", function () {
    // We define a fixture to reuse the same setup in every test.
    async function deployExplicitRevertReasonFixture() {
        const ExplicitRevertReason = await hre.ethers.getContractFactory("ExplicitRevertReason");
        const explicitRevertReason = await ExplicitRevertReason.deploy();

        explicitRevertReason.waitForDeployment()

        return { explicitRevertReason };
    }

    describe("Functionality", function () {
        it("Should fail with revert reason", async function () {
            const { explicitRevertReason } = await loadFixture(deployExplicitRevertReasonFixture);

            await expect(explicitRevertReason.max10(30)).to.be.revertedWith(`Value must not be greater than 10.`)
        });

        it("Should return the given input", async function () {
            const { explicitRevertReason } = await loadFixture(deployExplicitRevertReasonFixture);

            const result = await explicitRevertReason.max10(9);

            expect(result).to.be.equal(9)
        });
    });
});
