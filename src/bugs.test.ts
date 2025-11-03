import { getByteCode, getEnv, sanitizeOpts as opts } from './util.ts'
import { Issue211Abi } from '../codegen/abi/Issue211.ts'
import { expect } from '@std/expect'

// Initialize test environment
const env = await getEnv()

Deno.test('issues_211', opts, async () => {
    const hash = await env.accountWallet.deployContract({
        abi: Issue211Abi,
        bytecode: getByteCode('Issue211', env.evm),
    })
    const { contractAddress } = await env.serverWallet
        .waitForTransactionReceipt(hash)

    const initialBalance = 1000000000000000000n
    const { request } = await env.accountWallet.simulateContract({
        address: contractAddress!,
        abi: Issue211Abi,
        functionName: 'call',
        value: initialBalance,
        args: [],
    })

    await env.accountWallet.writeContract(request)

    const balance = await env.serverWallet.getBalance({
        address: contractAddress!,
    })

    expect(balance).toEqual(initialBalance)
})
