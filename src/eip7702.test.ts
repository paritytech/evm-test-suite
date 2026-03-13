import { sanitizeOpts as opts } from './util.ts'
import { expect } from '@std/expect'
import {
    createWalletClient,
    decodeEventLog,
    encodeFunctionData,
    http,
    parseEther,
    publicActions,
    zeroAddress,
} from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { SimpleDelegateAbi } from '../codegen/abi/SimpleDelegate.ts'
import { env, getSimpleDelegateAddr } from './deploy_contracts.ts'

// Fresh random EOA for each test run to avoid state collisions
const eoaAccount = privateKeyToAccount(generatePrivateKey())

const eoaWallet = createWalletClient({
    account: eoaAccount,
    transport: http(env.chain.rpcUrls.default.http[0]),
    chain: env.chain,
    cacheTime: 0,
}).extend(publicActions)

// Fund the fresh EOA before tests run
const fundHash = await env.serverWallet.sendTransaction({
    to: eoaAccount.address,
    value: parseEther('100'),
})
await env.serverWallet.waitForTransactionReceipt(fundHash)

// Set delegation using the sponsored pattern.
// The EOA signs the authorization; accountWallet sends the tx.
async function setDelegation(contractAddress: `0x${string}`) {
    const authorization = await eoaWallet.signAuthorization({
        contractAddress,
    })

    const hash = await env.accountWallet.sendTransaction({
        authorizationList: [authorization],
        to: eoaAccount.address,
    })
    return await env.accountWallet.waitForTransactionReceipt(hash)
}

Deno.test('eip7702', opts, async (t) => {
    const delegateAddr = await getSimpleDelegateAddr()

    await t.step('set delegation', async () => {
        const receipt = await setDelegation(delegateAddr)
        expect(receipt.status).toEqual('success')

        const code = await eoaWallet.getCode({
            address: eoaAccount.address,
        })
        expect(code?.toLowerCase()).toBe(
            `0xef0100${delegateAddr.slice(2).toLowerCase()}`,
        )
    })

    await t.step('execute through delegated EOA', async () => {
        const hash = await env.serverWallet.sendTransaction({
            to: eoaAccount.address,
            data: encodeFunctionData({
                abi: SimpleDelegateAbi,
                functionName: 'increment',
            }),
        })
        const receipt = await env.serverWallet.waitForTransactionReceipt(hash)
        expect(receipt.status).toEqual('success')

        const counter = await env.serverWallet.readContract({
            address: eoaAccount.address,
            abi: SimpleDelegateAbi,
            functionName: 'getCounter',
        })
        expect(counter).toBe(1n)

        const events = receipt.logs.map((log) =>
            decodeEventLog({
                abi: SimpleDelegateAbi,
                data: log.data,
                topics: log.topics,
            })
        )
        expect(events).toEqual([{
            eventName: 'Incremented',
            args: { account: eoaAccount.address, newValue: 1n },
        }])
    })

    await t.step('delegation persists across transactions', async () => {
        const hash = await env.serverWallet.sendTransaction({
            to: eoaAccount.address,
            data: encodeFunctionData({
                abi: SimpleDelegateAbi,
                functionName: 'increment',
            }),
        })
        const receipt = await env.serverWallet.waitForTransactionReceipt(hash)
        expect(receipt.status).toEqual('success')

        const counter = await env.serverWallet.readContract({
            address: eoaAccount.address,
            abi: SimpleDelegateAbi,
            functionName: 'getCounter',
        })
        expect(counter).toBe(2n)
    })

    await t.step('EOA balance preserved during delegation', async () => {
        const balanceBefore = await env.serverWallet.getBalance(eoaAccount)

        const sendAmount = parseEther('1')
        const hash = await env.serverWallet.sendTransaction({
            to: eoaAccount.address,
            value: sendAmount,
        })
        await env.serverWallet.waitForTransactionReceipt(hash)

        const balanceAfter = await env.serverWallet.getBalance(eoaAccount)
        expect(balanceAfter - balanceBefore).toBe(sendAmount)

        const reportedBalance = await env.serverWallet.readContract({
            address: eoaAccount.address,
            abi: SimpleDelegateAbi,
            functionName: 'selfBalance',
        })
        expect(reportedBalance).toBe(balanceAfter)
    })

    await t.step('clear delegation', async () => {
        const receipt = await setDelegation(zeroAddress)
        expect(receipt.status).toEqual('success')

        const code = await eoaWallet.getCode({
            address: eoaAccount.address,
        })
        expect(!code || code === '0x').toBe(true)
    })

    await t.step('call to undelegated EOA returns empty', async () => {
        const result = await env.serverWallet.call({
            to: eoaAccount.address,
            data: encodeFunctionData({
                abi: SimpleDelegateAbi,
                functionName: 'getCounter',
            }),
        })
        expect(!result.data || result.data === '0x').toBe(true)
    })

    await t.step('re-delegate restores access to storage', async () => {
        const receipt = await setDelegation(delegateAddr)
        expect(receipt.status).toEqual('success')

        const counter = await env.serverWallet.readContract({
            address: eoaAccount.address,
            abi: SimpleDelegateAbi,
            functionName: 'getCounter',
        })
        expect(counter).toBe(2n)
    })

    await t.step('delegation chains do not resolve', async () => {
        // A (eoaAccount) is already delegated to the SimpleDelegate contract.
        // Create B, delegate B -> A. Calling B should NOT follow A's delegation
        // (EIP-7702 forbids chained delegation).
        const accountB = privateKeyToAccount(generatePrivateKey())
        const walletB = createWalletClient({
            account: accountB,
            transport: http(env.chain.rpcUrls.default.http[0]),
            chain: env.chain,
            cacheTime: 0,
        }).extend(publicActions)

        // Fund B
        const fundB = await env.serverWallet.sendTransaction({
            to: accountB.address,
            value: parseEther('10'),
        })
        const r1 = await env.serverWallet.waitForTransactionReceipt(fundB)
        expect(r1.status).toEqual('success')

        // Delegate B -> A (another delegated EOA, not a contract).
        const authB = await walletB.signAuthorization({
            contractAddress: eoaAccount.address,
        })
        const delegateB = await env.accountWallet.sendTransaction({
            authorizationList: [authB],
            to: env.accountWallet.account.address,
        })
        const r2 = await env.accountWallet.waitForTransactionReceipt(delegateB)
        expect(r2.status).toEqual('success')

        // B's code points to A
        const codeB = await walletB.getCode({ address: accountB.address })
        expect(codeB?.toLowerCase()).toBe(
            `0xef0100${eoaAccount.address.slice(2).toLowerCase()}`,
        )

        // Calling getCounter on B should fail because the chain
        // B -> A -> SimpleDelegate is not followed.
        let chainedCallFailed = false
        try {
            const result = await env.serverWallet.call({
                to: accountB.address,
                data: encodeFunctionData({
                    abi: SimpleDelegateAbi,
                    functionName: 'getCounter',
                }),
            })
            chainedCallFailed = !result.data || result.data === '0x'
        } catch {
            chainedCallFailed = true
        }
        expect(chainedCallFailed).toBe(true)
    })
})
