import fs from 'fs';
import readline from 'readline';

import { ethers } from 'hardhat';
const FILEPATH = 'contracts';

describe('Matter Labs Ethereum Tests', () => {
    it('Runs Ethereum Tests', async () => {
        await runMatterLabsTests(FILEPATH);
    })
});

const runMatterLabsTests = async (filePath: string) => {
    if (fs.lstatSync(filePath).isDirectory()) {
        const filePaths = await fs.promises.readdir(filePath);

      for (const file of filePaths) {
          const fileName = `${filePath}/${file}`;
          await runMatterLabsTests(fileName);
      }
  } else {
          if(filePath.includes(".sol")) {
            if (filePath.startsWith(".")) {
                return;
            }
           
            console.log("FILEPATH---", filePath);
            const fileStream = fs.createReadStream(filePath);
  
            const rl = readline.createInterface({
              input: fileStream,
              crlfDelay: Infinity
            });
            const lines: string[] = [];
        
            for await (const line of rl) {
                let newLine: string = '';
        
                if(line.startsWith("// ----")) {
                    continue
                } else if (line.includes("->")) {
                    newLine = line.replace("//", "")
                }
        
                lines.push(newLine);
            }
        
            const json = lines.join("");
            console.log("json--", json);

            // let str = `f(uint16,int16,address,bytes3,bool): 1, 2, 3, "a", true -> 1, 2, 3, "a", true`
            let method = json.split("(")[0].trim()
            console.log("method---", method);

            let str = json.replace(/['"]+/g, '')

            const calldata = str.split("->")[0].trim().split(": ")[1].split(",").map(str => str.replace(" ", "")).map(val => {
                if (val.includes('\"\"')) {
                    val.replace('""', '"')
                }

                return val;
            })

            console.log(calldata);

            const expected = str.split("->")[1].trim().split(",").map(str => str.replace(" ", "")).map(val => {
                if (val.includes('\"\"')) {
                    val.replace('""', '"')
                }

                return val;
            })
            console.log("expected---", expected)

            const contractPath = `${filePath}:C`;
            console.log("Contract Path---", contractPath)

            const deployedContract = await ethers.deployContract(contractPath);
            await deployedContract.waitForDeployment();
            console.log("DEPLOYED CONTRACT", deployedContract.interface.fragments)
            const contractAddress = await deployedContract.getAddress();
            console.log("Contract address---", contractAddress)
            const contract = await ethers.getContractAt(contractPath, contractAddress);
            console.log("method is ---", method)
            // console.log("CONTRACT method---", contract[method.toString()]);
            // console.log("CONTRACT function f---", contract['f']);
            // console.log("data is---", data)
            // for (const data of calldata) {
            //     const abi = new ethers.AbiCoder();
            //     // console.log("toutf8", ethers.toB)
            //     const encodedData = abi.encode(["bytes"], [data])
            //     console.log("encoded data---", encodedData)
            // }

            console.log("FRAGMENTS--", contract.interface.fragments[0].inputs)

            // const abi = new ethers.AbiCoder();
            // const encodedData = abi.encode(contract.interface.fragments[0].inputs, ["abcdefg"])
            // console.log("ENCODED--", encodedData)
            const data = ethers.encodeBytes32String(calldata.join(","))
            console.log("data is---", data)
            const res = await contract[method](data);
            console.log("Res---", res);
          }
          
    }
}