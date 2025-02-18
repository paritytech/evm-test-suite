const kitchenSinkNode = '/Users/cameron-parity/workspace/polkadot-sdk/target/debug/substrate-node';

const kitchenSinkArgs = [
	'--dev', 'snap',
	'-l=error,evm=debug,sc_rpc_server=info,runtime::revive=debug',
];

const kitchenSinkNodeProcess = spawn(kitchenSinkNode, kitchenSinkArgs);

kitchenSinkNodeProcess.stdout.on('data', (data) => {
	console.log(`stdout: ${data}`);
});

kitchenSinkNodeProcess.stderr.on('data', (data) => {
	console.log(`stderr: ${data}`);
});

kitchenSinkNodeProcess.on('close', (code) => {
	console.log(`KitchenSink node process exited with code ${code}`);
});