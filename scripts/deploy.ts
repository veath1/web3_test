import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();
  const market = await ethers.deployContract("MyDataMarket");
  await market.waitForDeployment();

  const address = await market.getAddress();

  console.log("MyDataMarket deployed to:", address);
  console.log("Set NEXT_PUBLIC_CONTRACT_ADDRESS to this value before running the frontend.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
