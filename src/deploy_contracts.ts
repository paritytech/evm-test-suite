import { parseEther } from 'viem'
import { getByteCode, getEnv, memoizedDeploy, memoizedTx } from './util.ts'
import { TesterAbi } from '../codegen/abi/Tester.ts'
import { ErrorsAbi } from '../codegen/abi/Errors.ts'
import { EventExampleAbi } from '../codegen/abi/EventExample.ts'
import { ReturnDataTesterAbi } from '../codegen/abi/ReturnDataTester.ts'
import { PretraceFixtureAbi } from '../codegen/abi/PretraceFixture.ts'
import { PretraceFixtureChildAbi } from '../codegen/abi/PretraceFixtureChild.ts'
import { TracingCalleeAbi } from '../codegen/abi/TracingCallee.ts'
import { TracingCallerAbi } from '../codegen/abi/TracingCaller.ts'

// Initialize test environment
export const env = await getEnv()

// Tester contract
export const getTesterReceipt = memoizedTx(
    env,
    () =>
        env.serverWallet.deployContract({
            abi: TesterAbi,
            bytecode: getByteCode('Tester', env.evm),
            value: parseEther('2'),
        }),
)

// Tester contract address
export const getTesterAddr = () =>
    getTesterReceipt().then((r) => r.contractAddress!)

// Errors contract
export const getErrorTesterAddr = memoizedDeploy(
    env,
    () =>
        env.serverWallet.deployContract({
            abi: ErrorsAbi,
            bytecode: getByteCode('Errors', env.evm),
        }),
)

// EventExample contract
export const getEventExampleAddr = memoizedDeploy(
    env,
    () =>
        env.serverWallet.deployContract({
            abi: EventExampleAbi,
            bytecode: getByteCode('EventExample', env.evm),
        }),
)

// ReturnDataTester contract
export const getReturnDataTesterAddr = memoizedDeploy(
    env,
    () =>
        env.serverWallet.deployContract({
            abi: ReturnDataTesterAbi,
            bytecode: getByteCode('ReturnDataTester', env.evm),
        }),
)

// PretraceFixture contract
export const getPretraceFixtureReceipt = memoizedTx(
    env,
    () =>
        env.accountWallet.deployContract({
            abi: PretraceFixtureAbi,
            bytecode: getByteCode('PretraceFixture', env.evm),
            value: parseEther('10'),
        }),
)

export const getPretraceFixtureAddr = () =>
    getPretraceFixtureReceipt().then((r) => r.contractAddress!)

// PretraceFixtureChild contract
export const getPretraceFixtureChildAddr = memoizedDeploy(
    env,
    () =>
        env.accountWallet.deployContract({
            abi: PretraceFixtureChildAbi,
            bytecode: getByteCode('PretraceFixtureChild', env.evm),
        }),
)

// Tracing caller contract
export const getTracingCallerAddr = memoizedDeploy(env, async () => {
    const tracingCalleeAddr = await getTracingCalleeAddr()
    return env.accountWallet.deployContract({
        abi: TracingCallerAbi,
        args: [tracingCalleeAddr],
        bytecode: getByteCode('TracingCaller', env.evm),
        value: parseEther('10'),
    })
})

// TracingCallee contract
export const getDeployTracingCalleeReceipt = memoizedTx(
    env,
    () =>
        env.accountWallet.deployContract({
            abi: TracingCalleeAbi,
            bytecode: getByteCode('TracingCallee', env.evm),
        }),
)

export const getTracingCalleeAddr = () =>
    getDeployTracingCalleeReceipt().then((r) => r.contractAddress!)
