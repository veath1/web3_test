# MyData Market Web2.5 PoC

Hybrid DApp demo that stores financial data off-chain in Supabase and enforces payment plus access rights on-chain with Solidity.

This repository is intended for an isolated lab environment and authorized testing only.

## Current Toolchain

- Next.js `16.2.2`
- React `19.2.4`
- Hardhat `3.3.0`
- ethers `6.16.0`
- Supabase JS `2.101.1`
- `npm audit`: `0 vulnerabilities`

## Architecture

- Off-chain: `Supabase` stores the original `raw_data` JSON in `my_data`.
- On-chain: `MyDataMarket.sol` stores only `dbId`, search tags, price, and purchase access flags.
- Frontend: `Next.js + ethers v6` handles wallet connection, seller registration, enterprise purchase, and gated viewing.
- Demo UX: a top-right tabbed walkthrough simulates the five-step business flow and renders a mini blockchain timeline.

## Project Layout

- `app/`: Next.js App Router entrypoint and global styles
- `components/`: wallet, seller dashboard, and enterprise dashboard
- `contracts/`: Solidity smart contract
- `lib/`: Supabase client helpers, ethers helpers, ABI, and shared types
- `scripts/`: Hardhat deployment script
- `supabase/schema.sql`: table and demo RLS policy
- `test/`: Hardhat unit tests

## Environment Variables

Copy `.env.example` to `.env.local` and set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_CONTRACT_ADDRESS`
- `NEXT_PUBLIC_CHAIN_ID`
- `NEXT_PUBLIC_ETHERSCAN_BASE_URL`
- `NEXT_PUBLIC_LOCAL_SELLER_ADDRESS`
- `NEXT_PUBLIC_LOCAL_ENTERPRISE_ADDRESS`
- `LOCALHOST_RPC_URL`
- `SEPOLIA_RPC_URL`
- `PRIVATE_KEY`

## Supabase Setup

Run the SQL in [supabase/schema.sql](/c:/Users/zah62/Downloads/web3/supabase/schema.sql).

Important: the included policy allows client-side `insert` and `select` for demo speed. That matches the requested PoC flow, but it is not production-safe.

## Local Flow

1. Install Node.js 18+ and npm.
2. Install dependencies with `npm install`.
3. Start a local chain with `npx hardhat node`.
4. Reset the demo to a known clean state with `npm run demo:reset`.
5. Run the frontend with `npm run dev`.

## Demo Reset

If balances change, listings get messy, or you want the exact same state as a fresh demo, run:

```bash
npm run demo:reset
```

This command:

- creates a clean local baseline on first run
- restores the saved baseline with `evm_snapshot` and `evm_revert` on later runs
- keeps the default funded demo accounts in sync
- redeploys `MyDataMarket` automatically when the local node was restarted
- rewrites `.env.local` with the fresh local contract address
- reapplies the fixed seller and enterprise demo addresses

## Contract Notes

- `registerData(dbId, tags, price)` stores only metadata on-chain.
- `purchaseData(id)` transfers ETH directly to the seller and marks access for the buyer.
- `checkAccess(id, buyer)` is used before loading the off-chain record.
- `isSold` becomes `true` after the first purchase, but multiple buyers can still purchase the same listing through `hasPurchased`.

## Demo Scenario

- Seller uploads data such as `bank_balance: 50000000` and `has_irp: false`.
- The app inserts the JSON into Supabase and receives a UUID.
- The UUID, price, and target tags such as `high-net-worth, no-irp` are registered on-chain.
- An enterprise wallet purchases the listing and immediately gains access.
- The frontend checks `checkAccess` and then loads the raw JSON from Supabase.

## Verification

- `npm run test`: contract behavior
- `npm run build`: Next.js production build
- `npm audit`: dependency audit
- Verified locally on April 3, 2026:
- `npm run demo:reset` completed successfully against a local Hardhat node
- `npm run compile` passed
- `npm test` passed with `4 passing`
- `npm run build` passed
- `next start` responded with HTTP `200`
