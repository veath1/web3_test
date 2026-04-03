import { expect } from "chai";
import { network } from "hardhat";

describe("MyDataMarket", function () {
  async function deployFixture() {
    const { ethers } = await network.connect();
    const [seller, buyerA, buyerB] = await ethers.getSigners();
    const market = await ethers.deployContract("MyDataMarket");
    await market.waitForDeployment();

    const price = ethers.parseEther("0.01");

    await market
      .connect(seller)
      .registerData("7f30f688-f5c6-4882-a490-4eb6c56cf790", "high-net-worth, no-irp", price);

    return {
      ethers,
      market,
      seller,
      buyerA,
      buyerB,
      price
    };
  }

  it("registers a new data asset", async function () {
    const { market, seller, price } = await deployFixture();

    expect(await market.dataCount()).to.equal(1n);

    const asset = await market.dataAssets(1);
    expect(asset.id).to.equal(1n);
    expect(asset.owner).to.equal(seller.address);
    expect(asset.dbId).to.equal("7f30f688-f5c6-4882-a490-4eb6c56cf790");
    expect(asset.tags).to.equal("high-net-worth, no-irp");
    expect(asset.price).to.equal(price);
    expect(asset.isSold).to.equal(false);
  });

  it("grants access and pays the seller immediately", async function () {
    const { ethers, market, seller, buyerA, price } = await deployFixture();
    const beforeBalance = await ethers.provider.getBalance(seller.address);

    const tx = await market.connect(buyerA).purchaseData(1, { value: price });
    await tx.wait();

    const afterBalance = await ethers.provider.getBalance(seller.address);
    expect(afterBalance - beforeBalance).to.equal(price);
    expect(await market.checkAccess(1, buyerA.address)).to.equal(true);

    const asset = await market.dataAssets(1);
    expect(asset.isSold).to.equal(true);
  });

  it("prevents duplicate purchase by the same buyer", async function () {
    const { market, buyerA, price } = await deployFixture();

    await market.connect(buyerA).purchaseData(1, { value: price });

    await expect(
      market.connect(buyerA).purchaseData(1, { value: price })
    ).to.be.revertedWith("already purchased");
  });

  it("allows multiple enterprises to buy the same asset independently", async function () {
    const { market, buyerA, buyerB, price } = await deployFixture();

    await market.connect(buyerA).purchaseData(1, { value: price });
    await market.connect(buyerB).purchaseData(1, { value: price });

    expect(await market.checkAccess(1, buyerA.address)).to.equal(true);
    expect(await market.checkAccess(1, buyerB.address)).to.equal(true);
  });
});
