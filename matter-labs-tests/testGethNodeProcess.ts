import { spawn } from "child_process";
import * as http from 'http';

const ethereumNode = '/Users/cameron-parity/workspace/evm-test-suite/networks/ethereum/build/bin/macOS/geth';
const gethArgs = [
	'--syncmode', 'snap',
	'--http',
	'--http.port', '8546',
	'--http.api', 'eth,net,web3',
];

const ethereumNodeProcess = spawn(ethereumNode, gethArgs);

// stdout
ethereumNodeProcess.stdout.on('data', (data) => {
	const output = data.toString();
	console.log(`stdout: ${output}`);

	// Check node ready message
	if (output.includes('HTTP endpoint opened')) {
		console.log('Ethereum node is ready!')
	}
});

ethereumNodeProcess.stderr.on('data', (data) => {
	console.log(`stderr: ${data}`);
});

ethereumNodeProcess.on('close', (code) => {
	console.log(`Ethereum node process exited with code ${code}`);
});

const checkEthereumNodeReady = (retries: number = 5, delay: number = 3000) => {
	const options = {
		hostname: '127.0.0.1',
		port: 8546,
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		}
	};

	const req = http.request(options, (res) => {
		if (res.statusCode === 200) {
			console.log("Ethereum node is up and running!")
		} else {
			console.log(`Node not ready, status code: ${res.statusCode}`);
			if (retries > 0) {
				console.log(`Retrying...(${retries} attempts left)`);
				setTimeout(() => checkEthereumNodeReady(retries-1, delay), delay);
			} else {
				
			}
		}
	});

	req.on('error', (e) => {
		console.error(`Error checking node status: ${e.message}`);
	});

	req.write(
		JSON.stringify({
			jsonrpc: '2.0',
			method: 'net_version',
			params: [],
			id: 1,
		})
	);

	req.end();
}

