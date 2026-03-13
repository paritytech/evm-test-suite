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

    await t.step('self-sponsored set and execute', async () => {
        const hash = await eoaWallet.sendTransaction({
            to: eoaAccount.address,
            data: encodeFunctionData({
                abi: SimpleDelegateAbi,
                functionName: 'increment',
            }),
        })
        const receipt = await eoaWallet.waitForTransactionReceipt({ hash })
        expect(receipt.status).toEqual('success')

        const counter = await env.serverWallet.readContract({
            address: eoaAccount.address,
            abi: SimpleDelegateAbi,
            functionName: 'getCounter',
        })
        expect(counter).toBe(3n)
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
        expect(counter).toBe(3n)
    })

})
