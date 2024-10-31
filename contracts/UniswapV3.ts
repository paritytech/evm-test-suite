import {
    loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

describe("Uniswap V3", function () {
    let factory, positionManager, router;
    let deployer, user;

    const USDC_ADDRESS = "0xA0b86991c6218b36c1d19d4a2e9EB0cE3606EB48";
    const DAI_ADDRESS = "0x6B175474E89094C44Da98b954EedeAC495271d0F";

    // Define a fixture to deploy Uniswap contracts
    async function deployUniswapFixture() {
        // Get signers
        [deployer, user] = await hre.ethers.getSigners();

        // Deploy the Uniswap V3 Factory
        const UniswapV3Factory = await hre.ethers.getContractFactory("UniswapV3Factory", deployer);
        factory = await UniswapV3Factory.deploy(deployer.address);
        await factory.deployed();

        // Deploy the NonfungiblePositionManager
        const NonfungiblePositionManager = await hre.ethers.getContractFactory("NonfungiblePositionManager", deployer);
        positionManager = await NonfungiblePositionManager.deploy(factory.address, deployer.address);
        await positionManager.deployed();

        // Deploy the SwapRouter
        const SwapRouter = await hre.ethers.getContractFactory("SwapRouter", deployer);
        router = await SwapRouter.deploy(factory.address, hre.ethers.constants.AddressZero);
        await router.deployed();

        return { factory, positionManager, router, deployer, user };
    }

    describe("Deployment", function () {
        it("Should deploy Uniswap contracts", async function () {
            const { factory, positionManager, router } = await loadFixture(deployUniswapFixture);

            expect(factory.address).to.not.be.undefined;
            expect(positionManager.address).to.not.be.undefined;
            expect(router.address).to.not.be.undefined;
        });
    });

    describe("Pool Management", function () {
        it("Should create a new pool", async function () {
            const { factory } = await loadFixture(deployUniswapFixture);

            // Create a new pool (replace with actual token addresses and fee)
            const tx = await factory.createPool(USDC_ADDRESS, DAI_ADDRESS, 3000);
            await tx.wait();

            const poolAddress = await factory.getPool(USDC_ADDRESS, DAI_ADDRESS, 3000);
            expect(poolAddress).to.not.equal(hre.ethers.constants.AddressZero);
        });
    });
});
