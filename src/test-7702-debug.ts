import { createWalletClient, http, publicActions, parseEther } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { defineChain } from "viem"

const chain = defineChain({
    id: 420420420,
    name: "Revive Dev",
    nativeCurrency: { name: "Westie", symbol: "WST", decimals: 18 },
    rpcUrls: { default: { http: ["http://localhost:8545"] } },
    testnet: true,
})

const wallet = createWalletClient({
    transport: http("http://localhost:8545"),
    chain,
    cacheTime: 0,
}).extend(publicActions)

const [devAccount] = await wallet.getAddresses()

const sponsorAccount = privateKeyToAccount(
    "0x5fb92d6e98884f76de468fa3f6278f8807c48bebc13595d45af5bdc4da702133"
)

const eoaAccount = privateKeyToAccount(
    "0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6"
)

const serverWallet = createWalletClient({
    account: devAccount,
    transport: http("http://localhost:8545"),
    chain,
    cacheTime: 0,
}).extend(publicActions)

const sponsorWallet = createWalletClient({
    account: sponsorAccount,
    transport: http("http://localhost:8545"),
    chain,
    cacheTime: 0,
}).extend(publicActions)

const eoaWallet = createWalletClient({
    account: eoaAccount,
    transport: http("http://localhost:8545"),
    chain,
    cacheTime: 0,
}).extend(publicActions)

// Fund sponsor
console.log("Funding sponsor...")
const h1 = await serverWallet.sendTransaction({
    to: sponsorAccount.address,
    value: parseEther("1000"),
})
console.log("Fund sponsor tx:", h1)

// Fund EOA
console.log("Funding EOA...")
const h2 = await serverWallet.sendTransaction({
    to: eoaAccount.address,
    value: parseEther("100"),
})
console.log("Fund EOA tx:", h2)

// Wait a bit for blocks
await new Promise(r => setTimeout(r, 2000))

// Use a dummy address for delegation
const contractAddress = "0x0000000000000000000000000000000000000001" as `0x${string}`

try {
    console.log("\nSigning authorization...")
    const authorization = await eoaWallet.signAuthorization({ contractAddress })
    console.log("Authorization:", JSON.stringify(authorization, (_, v) => typeof v === "bigint" ? v.toString() : v, 2))
    
    console.log("\nSending EIP-7702 tx from sponsor...")
    const hash = await sponsorWallet.sendTransaction({
        authorizationList: [authorization],
        to: eoaAccount.address,
    })
    console.log("TX hash:", hash)
} catch (err: any) {
    console.error("\nError:", err.shortMessage || err.message)
}
