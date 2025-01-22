import { ethers } from 'hardhat'

async function main() {
  const signers = await ethers.getSigners();

  for (const signer of signers.slice(1)) {
    const tx = {
        to: signer,
        value: ethers.parseEther("100.0"), // Amount to send (1.0 ETH in this example)
      };

      const transactionResponse = await signers[0].sendTransaction(tx);

    await transactionResponse.wait();
  }
}


main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
