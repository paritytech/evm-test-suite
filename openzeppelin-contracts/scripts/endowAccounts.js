
const { ethers } = require("hardhat");

async function main() {
  const signers = await ethers.getSigners();
  for (const signer of signers.slice(1)) {
    const balance = await ethers.provider.getBalance(signer);

    const tx = {
        to: signer,
        value: hre.ethers.parseEther("100.0"),
      };

      const transactionResponse = await signers[0].sendTransaction(tx);

    await transactionResponse.wait();

  }
}


main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
