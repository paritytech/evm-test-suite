import { killProcessOnPort, waitForHealth } from './util.ts'
import assert from 'node:assert'
import { ChildProcess, spawn } from 'node:child_process'
import { TestProject } from 'vitest/node.js'

declare module 'vitest' {
    export interface ProvidedContext {
        envs: Array<'geth' | 'eth-rpc'>
    }
}

export default async function setup(project: TestProject) {
    const procs: ChildProcess[] = []
    let useGeth = !!process.env.USE_GETH
    let useEthRpc = !!process.env.USE_ETH_RPC

    if (process.env.START_GETH) {
        useGeth = true
        const geth = process.env.GETH_BIN ?? 'geth'
        const gethArgs = [
            '--http',
            '--http.api',
            'web3,eth,debug,personal,net',
            '--http.port',
            '8546',
            '--dev',
            '--dev.period',
            '2',
            '--verbosity',
            '0',
        ]

        killProcessOnPort(8546)
        console.log('🚀 Start geth...')
        procs.push(spawn(geth, gethArgs))
        await waitForHealth('http://localhost:8546').catch()
    }

    if (process.env.START_SUBSTRATE_NODE) {
        const substrateNodeArgs = [
            '--dev',
            '--consensus', 
            'manual-seal-200',
            '-l=error,evm=debug,sc_rpc_server=info,runtime::revive=debug',
        ]

        killProcessOnPort(9944)
        assert(process.env.NODE_PATH, 'NODE_PATH should be set')
        console.log('🚀 Start substrate-node ...')
        procs.push(spawn(process.env.NODE_PATH, substrateNodeArgs))
    }

    if (process.env.START_ETH_RPC) {
        useEthRpc = true

        // Run eth-rpc on 8545
        const ethRpcArgs = [
            '--dev',
            '--node-rpc-url=ws://localhost:9944',
            '-l=rpc-metrics=debug,eth-rpc=debug',
        ]

        killProcessOnPort(8545)
        assert(process.env.ADAPTER_PATH, 'ADAPTER_PATH should be set')
        console.log('🚀 Start eth-rpc ...')
        procs.push(spawn(process.env.ADAPTER_PATH, ethRpcArgs))
        await waitForHealth('http://localhost:8545').catch()
    }

    const envs = [
        ...(useGeth ? ['geth' as const] : []),
        ...(useEthRpc ? ['eth-rpc' as const] : []),
    ]

    if (envs.length === 0) {
        throw new Error('No environment started. Set USE_GETH or USE_ETH_RPC')
    }

    project.provide('envs', envs)

    return () => {
        procs.forEach((proc) => proc.kill())
    }
}
