import fs from 'fs';
import { basename } from 'path'
import { spawn, ChildProcess, ChildProcessWithoutNullStreams } from "child_process";
import dotenv from 'dotenv';
import { setTimeout } from 'timers/promises';
import assert, { fail } from 'assert';

import { Abi, AbiFunction, parseGwei } from 'viem';

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { waitForHealth, killProcessOnPort, createEnv, getByteCode, Env, testContractStorageState, initializeGeth, deleteFilesInFolderSync, deleteFilesInFolderAsync } from './util';
import { EventItem, Extended, Metadata } from './types';
import { getMatterLabsFilePaths } from './utils/matterLabsHelpers'
import { parseCallData } from './utils/parseCalldata'

dotenv.config();

const numberOfNodesEnv = process.env.NODE_COUNT;
const numberOfNodes = numberOfNodesEnv ? parseInt(numberOfNodesEnv, 10) : 1;

const ethereumNodeBinEnv = process.env.GETH_NODE_BIN_DIR;
const ethereumNodeBin = ethereumNodeBinEnv ? ethereumNodeBinEnv : undefined;
assert(ethereumNodeBin, 'GETH_NODE_BIN_DIR not defined');

const kitchenSinkNodeBinEnv = process.env.KITCHEN_SINK_NODE_BIN_DIR;
const kitchenSinkNodeBin = kitchenSinkNodeBinEnv ? kitchenSinkNodeBinEnv : undefined;
assert(kitchenSinkNodeBin, 'KITCHEN_SINK_NODE_BIN not defined');

const kitchenSinkEthRpcBinEnv = process.env.KITCHEN_SINK_ETH_RPC_BIN;
const kitchenSinkEthRpcBin = kitchenSinkEthRpcBinEnv ? kitchenSinkEthRpcBinEnv : undefined;
assert(kitchenSinkEthRpcBin, 'KITCHEN_SINK_ETH_RPC_BIN not defined');

const genesisJsonFileDirEnv = process.env.GENESIS_JSON_DIR;
const genesisJsonFile = genesisJsonFileDirEnv ? genesisJsonFileDirEnv : undefined;
assert(genesisJsonFile, 'GENESIS_JSON_DIR not defined');

const rpcNodeIdxs: number[] = [];

let nodeCounter = 0
while (rpcNodeIdxs.length < numberOfNodes) {
	rpcNodeIdxs.push(nodeCounter);
	nodeCounter++
}

const gethNodes: ChildProcess[] = [];
const gethEnvs: Env[] = [];

const kitchenSinkNodes: ChildProcess[] = [];
const kitchenSinkEthRpcNodes: ChildProcess[] = [];
const kitchenSinkEthRpcEnvs: Env[] = [];

const filePaths: { filePath: string, metadata: Metadata }[] = [];
const filePathDir = 'contracts/era-compiler-tests/solidity/simple';

const filters = process.env.CONTRACT_FILTERS?.split(',') || [];
await getMatterLabsFilePaths(filePathDir, filePaths, filters);

const fileChunks: { filePath: string, metadata: Metadata }[][] = [];
const filesPerNode = Math.ceil(filePaths.length / numberOfNodes);
for (let i = 0; i < numberOfNodes; i++) {
	fileChunks.push(filePaths.slice(i * filesPerNode, (i + 1) * filesPerNode))
}

let nodeSetupIdx = 0;
const nodePlaceHolders: { nodeIdx: number, fileChunk: { filePath: string, metadata: Metadata }[] }[] = [];
while (nodePlaceHolders.length < numberOfNodes) {
	nodePlaceHolders.push({ nodeIdx: nodeSetupIdx, fileChunk: fileChunks[nodeSetupIdx] });
	nodeSetupIdx++
}

beforeAll(async () => {
	let gethNodePort = process.env.GETH_NODE_PORT ? parseInt(process.env.GETH_NODE_PORT, 10) : 8845;
	let kitchenSinkDefaultPort = process.env.KITCHEN_SINK_NODE_PORT ? parseInt(process.env.KITCHEN_SINK_NODE_PORT, 10) : 9944;
	let ethRpcDefaultPort = process.env.KITCHEN_SINK_ETH_RPC_PORT ? parseInt(process.env.KITCHEN_SINK_ETH_RPC_PORT, 10) : 8545;

	await Promise.all(
		rpcNodeIdxs.map(async (i) => {
			const ethereumNodeProcess = await (async () => {
				let gethNodeProcess: ChildProcessWithoutNullStreams;
				gethNodePort += i;
				killProcessOnPort(gethNodePort);
				console.log("GETH DEFAULT PORT---", gethNodePort)
				await deleteFilesInFolderAsync('./dev-db');

				await initializeGeth(ethereumNodeBin, genesisJsonFile, gethNodePort);

				const ethereumArgs = [
					'--datadir', `dev-db/dev-chain-${gethNodePort}`,
					'--syncmode', 'snap',
					'--http',
					'--dev',
					'--http.port', `${gethNodePort}`,
					'--http.api', 'eth,net,web3,debug',
				];

				gethNodeProcess = spawn(ethereumNodeBin, ethereumArgs);

				// stdout
				gethNodeProcess.stdout.on('data', (data) => {
					const output = data.toString();
					console.log(`stdout: ${output}`);

					// Check node ready message
					if (output.includes('HTTP endpoint opened')) {
						console.log(`Geth node is ready on port ${gethNodePort}`)
					}
				});

				gethNodeProcess.stderr.on('data', (data) => {
					console.log(`stderr: ${data}`);
				});

				gethNodeProcess.on('close', (code) => {
					console.log(`Geth node process exited with code ${code}`);
				});

				const url = `http:localhost:${gethNodePort}`;
				console.log("Waiting for health on ", url);
				await waitForHealth(url).catch()

				gethEnvs.push(await createEnv('geth', gethNodeProcess.pid!, gethNodePort))

				return gethNodeProcess
			})()
			gethNodes.push(ethereumNodeProcess)

			const kitchenSinkNodeProcess = await (async () => {
				kitchenSinkDefaultPort += i;
				killProcessOnPort(kitchenSinkDefaultPort);
				const kitchenSinkArgs = [
					'--rpc-port', `${kitchenSinkDefaultPort}`,
					'--dev',
					'-l=error,evm=debug,sc_rpc_server=info,runtime::revive=debug',
				]
				const kitchenSinkNodeProcess = spawn(kitchenSinkNodeBin, kitchenSinkArgs);

				// stdout
				kitchenSinkNodeProcess.stdout.on('data', (data) => {
					const output = data.toString();
					console.log(`stdout: ${output}`);

					// Check node ready message
					if (output.includes('HTTP endpoint opened')) {
						console.log(`KitchenSink node is ready on port ${kitchenSinkDefaultPort}!}`)
					}
				});

				kitchenSinkNodeProcess.stderr.on('data', (data) => {
					console.log(`stderr: ${data}`);
				});

				kitchenSinkNodeProcess.on('close', (code) => {
					console.log(`KitchenSink node process exited with code ${code}`);
				});
				const kitchenSinkEthRpcProcess = await (async () => {
					ethRpcDefaultPort += i;
					killProcessOnPort(ethRpcDefaultPort);
					console.log("ETH RPC DEFAULT PORT---", ethRpcDefaultPort)
					const kitchSinkEthRpcArgs = [
						'--rpc-port', `${ethRpcDefaultPort}`,
						'--dev',
						`--node-rpc-url=ws://localhost:${kitchenSinkDefaultPort}`,
						'-l=rpc-metrics=debug,eth-rpc=debug',
					];

					const kitchenSinkEthRpcNodeProcess = spawn(kitchenSinkEthRpcBin, kitchSinkEthRpcArgs);

					// stdout
					kitchenSinkEthRpcNodeProcess.stdout.on('data', (data) => {
						const output = data.toString();
						console.log(`stdout: ${output}`);

						// Check node ready message
						if (output.includes('HTTP endpoint opened')) {
							console.log(`KitchenSink eth-rpc node is ready on port ${kitchenSinkDefaultPort}!}`)
						}
					});

					kitchenSinkEthRpcNodeProcess.stderr.on('data', (data) => {
						console.log(`stderr: ${data}`);
					});

					kitchenSinkEthRpcNodeProcess.on('close', (code) => {
						console.log(`KitchenSink eth-rpc node process exited with code ${code}`);
					});

					const url = `http://localhost:${ethRpcDefaultPort}`;
					console.log("Waiting for health on ", url);
					await waitForHealth(url).catch()

					kitchenSinkEthRpcEnvs.push(await createEnv('eth-rpc', kitchenSinkEthRpcNodeProcess.pid!, ethRpcDefaultPort))

					return kitchenSinkEthRpcNodeProcess
				})()
				kitchenSinkEthRpcNodes.push(kitchenSinkEthRpcProcess)

				return kitchenSinkNodeProcess
			})()
			kitchenSinkNodes.push(kitchenSinkNodeProcess)
		})
	)
}, 500000);

afterAll(async () => {
	gethNodes.forEach((node) => node.kill())
	kitchenSinkNodes.forEach((node) => node.kill())
	kitchenSinkEthRpcNodes.forEach((node) => node.kill())
	deleteFilesInFolderSync('./dev-db');
});

describe("Differential Tests", async () => {
	it('creates the correct number of geth node processes', () => {
		expect(gethNodes.length).to.equal(numberOfNodes);
	});

	it('creates the correct number of geth test environments', async () => {

		console.log('SERVER WALLET BALANCE----', await gethEnvs[0].serverWallet.getBalance({ address: gethEnvs[0].serverWallet.account.address }))
		expect(gethEnvs.length).to.equal(numberOfNodes);
	});

	it('creates the correct number of kitchen sink node processes', async () => {
		expect(kitchenSinkNodes.length, 'failed to create the correct number of KitchenSink nodes').to.equal(numberOfNodes);
	});

	it('creates the correct number of kitchen sink eth-rpc node processes', async () => {
		expect(kitchenSinkEthRpcNodes.length, 'failed to create the correct number of KitchenSink eth-rpc nodes').to.equal(numberOfNodes);
	});

	it('creates the correct number of kitchen sink eth-rpc test environments', async () => {
		expect(kitchenSinkEthRpcEnvs.length, 'failed to create the correct number of KitchenSink eth-rpc test environments').to.equal(numberOfNodes);
	});

	nodePlaceHolders.forEach(({ fileChunk }, nodeIdx) => {
		let gethEnv: Env | undefined = gethEnvs[nodeIdx];
		let kitchenSinkEthRpcEnv: Env | undefined = kitchenSinkEthRpcEnvs[nodeIdx];

		fileChunk.forEach(async ({ filePath, metadata }, idx) => {
			const baseFilePath = basename(filePath, '.sol')
			const contractPath = `${baseFilePath}:Test`;
			const contractAbiPath = `${baseFilePath}:Test.json`;
			const contractAbi = JSON.parse(fs.readFileSync(`./abi/${contractAbiPath}`, 'utf-8')) as Abi

			let gethContractAddress: `0x${string}` | undefined | null = undefined;
			let kitchenSinkContractAddress: `0x${string}` | undefined | null = undefined;

			beforeAll(async () => {
				if (!gethEnv) {
					gethEnv = gethEnvs[nodeIdx];
				}
				if (!gethContractAddress) {
					const hash = await gethEnv.serverWallet.deployContract({
						maxPriorityFeePerGas: parseGwei('50'),
						maxFeePerGas: parseGwei('50'),
						abi: contractAbi,
						bytecode: getByteCode(contractPath, gethEnv.evm),
					});
					await setTimeout(100);
					const deployReceipt = await gethEnv.serverWallet.waitForTransactionReceipt({ hash });
					gethContractAddress = deployReceipt.contractAddress!
				}

				if (!kitchenSinkEthRpcEnv) {
					kitchenSinkEthRpcEnv = kitchenSinkEthRpcEnvs[nodeIdx];
				}
				if (!kitchenSinkContractAddress) {
					const hash = await kitchenSinkEthRpcEnv.serverWallet.deployContract({
						maxFeePerGas: parseGwei('50'),
						abi: contractAbi,
						bytecode: getByteCode(contractPath, kitchenSinkEthRpcEnv.evm),
					});

					await setTimeout(100);
					const deployReceipt = await kitchenSinkEthRpcEnv.serverWallet.waitForTransactionReceipt({ hash });
					kitchenSinkContractAddress = deployReceipt.contractAddress!
				}
			});

			it(`geth deploys ${baseFilePath}.sol`, async () => {
				expect(gethContractAddress, `geth contract address for ${contractAbiPath} is undefined`).not.to.equal(undefined);
				expect(gethContractAddress, `geth contract address for ${contractAbiPath} is null`).not.to.equal(null);
			})

			it(`kitchen sink deploys ${baseFilePath}.sol`, async () => {
				expect(kitchenSinkContractAddress, `kitchen sink eth rpc contract address for ${contractAbiPath} is undefined`).not.to.equal(undefined);
				expect(kitchenSinkContractAddress, `kitchen sink eth rpc contract address for ${contractAbiPath} is null`).not.to.equal(null);
			})

			metadata.cases.forEach(({ name: caseName, inputs, expected },) => {
				it.each(inputs)(`${baseFilePath} case: ${caseName} method: $method`, async ({ method, calldata }) => {
					// skip deployer since we've deployed already
					if (method === '#deployer') {
						return;
					}

					assert(gethEnv, 'geth env is undefined')
					assert(gethContractAddress, 'gethContractAddress is undefined')
					assert(kitchenSinkEthRpcEnv, 'kitchen sink eth-rpc env is undefined')
					assert(kitchenSinkContractAddress, 'kitchenSinkContractAddress is undefined')

					// get the number of expected arguments for the method
					let numberOfExpectedArgs = 0
					let abiVals = Array.from(contractAbi.values()) as AbiFunction[]
					for (const abi of abiVals) {
						if (abi.name === method) {
							numberOfExpectedArgs = abi.inputs.length;
							break
						}
					}

					// Call Output

					// check simulated call return values/outputs
					let parsedCalldata = parseCallData(calldata, numberOfExpectedArgs, filePath, method, caseName);
					console.log("PARSED CALL DATA---", parsedCalldata)
					console.log("NUMBER OF EXPECTED ARGS---", numberOfExpectedArgs)
					const args = numberOfExpectedArgs > 1 ? [...parsedCalldata] : numberOfExpectedArgs === 1 ? [parsedCalldata] : []
					console.log("CONTRACT METHOD---", method)
					console.log("ARGS---", args);

					let gethOutput = await gethEnv.serverWallet.simulateContract({
						address: gethContractAddress,
						abi: contractAbi,
						functionName: method,
						args,
					});

					let kitchenSinkOutput = await kitchenSinkEthRpcEnv.serverWallet.simulateContract({
						address: kitchenSinkContractAddress,
						abi: contractAbi,
						functionName: method,
						args,
					})
					expect(kitchenSinkOutput.result, 'KitchenSink and Geth contract call outputs did not match').toStrictEqual(gethOutput.result)

					// Balances 
					// TODO: determine balance assertions

					// get account balances
					const gethAccountBalance = await gethEnv.serverWallet.getBalance({ address: gethEnv.serverWallet.account.address });
					const kitchenSinkAccountBalance = await kitchenSinkEthRpcEnv.serverWallet.getBalance({ address: kitchenSinkEthRpcEnv.serverWallet.account.address });

					// get contract balances 
					const gethContractBalance = await gethEnv.serverWallet.getBalance({ address: gethContractAddress });
					const kitchenSinkContractBalance = await kitchenSinkEthRpcEnv.serverWallet.getBalance({ address: kitchenSinkContractAddress });

					// Bytecode
					// TODO: Determine bytecode assertions

					// get contract bytecode
					const gethContractCode = await gethEnv.serverWallet.getCode({ address: gethContractAddress });
					const kitchenSinkContractCode = await kitchenSinkEthRpcEnv.serverWallet.getCode({ address: kitchenSinkContractAddress });


					// Storage

					// check contract storages match
					await testContractStorageState(gethEnv, kitchenSinkEthRpcEnv, gethContractAddress, kitchenSinkContractAddress);


					// Events/Logs

					// geth contract logs
					const { request: gethRequest } = gethOutput;
					const gethTransactionHash = await gethEnv.serverWallet.writeContract(gethRequest)
					const gethContractTransactionReceipt = await gethEnv.serverWallet.waitForTransactionReceipt({ hash: gethTransactionHash });
					const gethContractLogs = await gethEnv.serverWallet.getLogs({
						address: gethContractAddress,
						blockHash: gethContractTransactionReceipt.blockHash,
					});
					console.log("Geth Contract Logs JSON---", JSON.stringify(gethContractLogs, (key, value) =>
						typeof value === 'bigint' ? value.toString() : value
					));

					// kitchen sink contract logs
					const { request: kitchenSinkRequest } = kitchenSinkOutput;
					const kitchenSinkTransactionHash = await kitchenSinkEthRpcEnv.serverWallet.writeContract(kitchenSinkRequest);
					const kitcheSinkContractTransactionReceipt = await kitchenSinkEthRpcEnv.serverWallet.waitForTransactionReceipt({ hash: kitchenSinkTransactionHash });
					const kitchenSinkContractLogs = await kitchenSinkEthRpcEnv.serverWallet.getLogs({
						address: kitchenSinkContractAddress,
						blockHash: kitcheSinkContractTransactionReceipt.blockHash,
					});
					console.log("KitchenSink Contract Logs JSON---", JSON.stringify(kitchenSinkContractLogs, (key, value) =>
						typeof value === 'bigint' ? value.toString() : value
					))

					// check log topics/data
					if (gethContractLogs.length > 0) {
						for (let i = 0; i < kitchenSinkContractLogs.length; i++) {
							const kitchenSinkLog = kitchenSinkContractLogs[i];
							const gethLog = gethContractLogs[i];
							const expectedEventLogTopics = ((expected as Extended).events as EventItem[])[i].topics;

							// if ((!kitchenSinkLog.topics && gethLog.topics)) {
							// 	fail('Kitchen Sink topics not found')
							// }

							if (kitchenSinkLog.topics && gethLog.topics) {
								expect(kitchenSinkLog.topics.length, 'KitchenSink and Geth log topics length should match').to.equal(gethLog.topics.length);
								for (let j = 0; j < kitchenSinkLog.topics.length; j++) {
									const expectedTopic = expectedEventLogTopics[j];
									const kitchenSinkLogItem = kitchenSinkLog.topics[i];
									const gethLogItem = gethLog.topics[i];

									if (expectedTopic === 'Test.address') { // topics which are contract addresses wont match
										expect(kitchenSinkLogItem, 'KitchenSink and Geth log topic items should match').to.equal(gethLogItem)
									} else {
										expect(kitchenSinkLogItem, 'Expected deployed KitchenSink contract address to differ from Geths').not.to.equal(gethLog);
									}
								}
								expect(kitchenSinkLog.data, 'KitchenSink and Geth log data should match').to.equal(gethLog.data);
							} else {
								expect(kitchenSinkLog.data, 'KitchenSink anonymous event log data should match Geths event').to.equal(gethLog.data);
							}
						}
					}
				}, 10000);
			});
		});
	}, 100000);
});	
