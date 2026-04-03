import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ContractFactory, HDNodeWallet, JsonRpcProvider } from "ethers";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const artifactPath = path.join(
  rootDir,
  "artifacts",
  "contracts",
  "MyDataMarket.sol",
  "MyDataMarket.json"
);
const envExamplePath = path.join(rootDir, ".env.example");
const envLocalPath = path.join(rootDir, ".env.local");
const demoStatePath = path.join(rootDir, ".demo-state.json");

const defaultRpcUrl = "http://127.0.0.1:8545";
const defaultMnemonic = "test test test test test test test test test test test junk";
const derivationBase = "m/44'/60'/0'/0";

function deriveWallet(index, provider) {
  return HDNodeWallet.fromPhrase(
    defaultMnemonic,
    undefined,
    `${derivationBase}/${index}`
  ).connect(provider);
}

function updateEnvValue(content, key, value) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");

  if (pattern.test(content)) {
    return content.replace(pattern, line);
  }

  const trimmed = content.trimEnd();
  return `${trimmed}\n${line}\n`;
}

async function loadEnvTemplate() {
  try {
    return await readFile(envLocalPath, "utf8");
  } catch {
    return readFile(envExamplePath, "utf8");
  }
}

async function loadDemoState() {
  try {
    const raw = await readFile(demoStatePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function saveDemoState(state) {
  await writeFile(demoStatePath, JSON.stringify(state, null, 2), "utf8");
}

async function writeDemoEnv({
  rpcUrl,
  contractAddress,
  sellerAddress,
  enterpriseAddress
}) {
  let envFile = await loadEnvTemplate();
  envFile = updateEnvValue(envFile, "NEXT_PUBLIC_CONTRACT_ADDRESS", contractAddress);
  envFile = updateEnvValue(envFile, "NEXT_PUBLIC_CHAIN_ID", "31337");
  envFile = updateEnvValue(envFile, "LOCALHOST_RPC_URL", rpcUrl);
  envFile = updateEnvValue(envFile, "NEXT_PUBLIC_LOCAL_SELLER_ADDRESS", sellerAddress);
  envFile = updateEnvValue(envFile, "NEXT_PUBLIC_LOCAL_ENTERPRISE_ADDRESS", enterpriseAddress);
  await writeFile(envLocalPath, envFile, "utf8");
}

async function jsonRpc(rpcUrl, method, params = []) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params
    })
  });

  if (!response.ok) {
    throw new Error(`RPC request failed with HTTP ${response.status}`);
  }

  const payload = await response.json();

  if (payload.error) {
    throw new Error(`${payload.error.message} (${payload.error.code})`);
  }

  return payload.result;
}

async function main() {
  const rpcUrl = process.env.LOCALHOST_RPC_URL ?? defaultRpcUrl;

  try {
    await jsonRpc(rpcUrl, "web3_clientVersion");
  } catch (error) {
    throw new Error(
      `Local Hardhat node is not reachable at ${rpcUrl}. Start it first with "npx hardhat node". ${error instanceof Error ? error.message : ""}`.trim()
    );
  }

  const provider = new JsonRpcProvider(rpcUrl);
  const sellerWallet = deriveWallet(0, provider);
  const enterpriseWallet = deriveWallet(1, provider);
  const savedState = await loadDemoState();

  if (savedState?.rpcUrl === rpcUrl && savedState.snapshotId) {
    try {
      const reverted = await jsonRpc(rpcUrl, "evm_revert", [savedState.snapshotId]);

      if (reverted) {
        const nextSnapshotId = await jsonRpc(rpcUrl, "evm_snapshot");
        await saveDemoState({
          ...savedState,
          snapshotId: nextSnapshotId
        });
        await writeDemoEnv({
          rpcUrl,
          contractAddress: savedState.contractAddress,
          sellerAddress: sellerWallet.address,
          enterpriseAddress: enterpriseWallet.address
        });

        console.log("Local demo state restored from snapshot.");
        console.log(`RPC: ${rpcUrl}`);
        console.log(`Contract: ${savedState.contractAddress}`);
        console.log(`Seller: ${sellerWallet.address}`);
        console.log(`Enterprise: ${enterpriseWallet.address}`);
        console.log("Balances, nonce, and contract state were rolled back to the saved demo start point.");
        return;
      }
    } catch {
      // Fall through to fresh deployment when the node was restarted or the snapshot disappeared.
    }
  }

  const artifact = JSON.parse(await readFile(artifactPath, "utf8"));
  const factory = new ContractFactory(artifact.abi, artifact.bytecode, sellerWallet);
  const contract = await factory.deploy();
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  const snapshotId = await jsonRpc(rpcUrl, "evm_snapshot");

  await saveDemoState({
    rpcUrl,
    contractAddress,
    snapshotId,
    sellerAddress: sellerWallet.address,
    enterpriseAddress: enterpriseWallet.address
  });
  await writeDemoEnv({
    rpcUrl,
    contractAddress,
    sellerAddress: sellerWallet.address,
    enterpriseAddress: enterpriseWallet.address
  });

  console.log("Local demo baseline created.");
  console.log(`RPC: ${rpcUrl}`);
  console.log(`Contract: ${contractAddress}`);
  console.log(`Seller: ${sellerWallet.address}`);
  console.log(`Enterprise: ${enterpriseWallet.address}`);
  console.log("A fresh snapshot was saved. Future `npm run demo:reset` calls will restore this exact state.");
  console.log("Import Hardhat account #0 or #1 into MetaMask if you want matching wallet balances.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
