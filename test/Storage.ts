
import {
    loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

describe("Storage", function () {
    // We define a fixture to reuse the same setup in every test.
    async function deployStorageFixture() {
        const Storage = await hre.ethers.getContractFactory("Storage");
        const storage = await Storage.deploy();

        storage.waitForDeployment()

        console.log("Storage deployed to:", storage.address);

        return { storage };
    }

    describe("Functionality", function () {
        it("Should return the empty data when storage is called for the first time", async function () {
            const { storage } = await loadFixture(deployStorageFixture);

            const key = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
            const empty = '0x0000000000000000000000000000000000000000000000000000000000000000';

            const result = await storage.getStorage(key);

            // Since the ecrecover address is mocked, we need to know what to expect here.
            // Assuming it echoes back the input for the purpose of this example.
            expect(result).to.equal(empty);
        });

        it("Should return the input data", async function () {
            const { storage } = await loadFixture(deployStorageFixture);

            const key = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
            const value = '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

            await storage.setStorage(key, value);

            const result = await storage.getStorage(key);

            expect(result).to.be.equal(value)

        })
    });
});
