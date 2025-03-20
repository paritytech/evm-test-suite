import { Calldata } from "../types";

export const parseCallData = (rawCallData: any[], numberOfExpectedArgs: number, filePath: string, method: string, testCaseName: string): any[] => {
    console.log("parseCallData METHOD: ", method)
    console.log("parseCallData callData: ", rawCallData)

    const callDataLength = rawCallData.length;
    const calldata: any[] = [];

    if (callDataLength === 0) {
        return calldata;
    }

    if (callDataLength === 21) {
        if (numberOfExpectedArgs === 1 && method === "polygon") {
            const n = rawCallData[0];
            const x = rawCallData.slice(1,11);
            const y = rawCallData.slice(11);

            calldata.push({ n, x, y });
        }
    }

    if (callDataLength === 16 ) {
        if (numberOfExpectedArgs === 1 && method === "main") {
            const first = rawCallData.slice(0,4) as string[];
            const second = rawCallData.slice(4,8) as string[];
            const third = rawCallData.slice(8,12) as string[];
            const fourth = rawCallData.slice(12) as string[];
    
    
            calldata.push([first, second, third, fourth]);
        }
    }

    // length 14 calldata
    if (callDataLength === 14) {
        if (numberOfExpectedArgs === 2) {
            calldata.push(rawCallData.slice(0, 10));
            calldata.push(rawCallData.slice(10));
        }
    }

    // length 13 calldata
    if (callDataLength === 13) {
        if (numberOfExpectedArgs === 4 && (method === "mergeSort" || method === "quickSort")) {
           calldata.push(rawCallData.slice(0,10));
           calldata.push(rawCallData[10]);
           calldata.push(rawCallData[11]);
           calldata.push(rawCallData[12]);
        }
    }
    
    // length 12 calldata 
    if (callDataLength === 12) {
        if (numberOfExpectedArgs === 3) {
            calldata.push(rawCallData.slice(0, 10));
            calldata.push(rawCallData[10]);
            calldata.push(rawCallData[11]);
        }
    }

    // length 11 calldata
    if (callDataLength === 11) {
        if (numberOfExpectedArgs === 3 && (method === "main" && filePath.includes("store_load_nested_witness_array_witness_index"))) {
            const first = rawCallData.slice(0,3) as string[];
            const second = rawCallData.slice(3,6) as string[];
            const third = rawCallData.slice(6,9) as string[];

            calldata.push([first, second, third]);
            calldata.push(rawCallData[9]);
            calldata.push(rawCallData[10]);
        } else if (numberOfExpectedArgs === 2) {
            const second = rawCallData[10];
            calldata.push(rawCallData.slice(0,10));
            calldata.push(second);
        } else if (numberOfExpectedArgs === 1) {
            if (filePath.includes("tuple")) {
                calldata.push(...rawCallData);
            } else {
                calldata.push(...rawCallData.slice(0,10));
            }
        }
    }

    // length 10 calldata
    if (callDataLength === 10) {
        if (numberOfExpectedArgs === 1) {
            calldata.push(...rawCallData);
        }
    }

    if (callDataLength === 2 || callDataLength === 7) {
        if (method === "recursiveAction") {
            calldata.push([rawCallData[0]], rawCallData[1]);
        } else {
            for (let i = 0; i < callDataLength; i++) {
                calldata.push(rawCallData[i]);
            }
        }
    }

    // length 6 calldata
    if (callDataLength === 6) {
        if (numberOfExpectedArgs === 2 && method === "main") {
            calldata.push(rawCallData.slice(0, 5));
            calldata.push(rawCallData[5]);
        } else {
            for (let i = 0; i < callDataLength; i++) {
                calldata.push(rawCallData[i]);
            }                
        }
    }

    // length 5 calldata
    if (callDataLength === 5) {
        if (numberOfExpectedArgs === 2) {
            if (method === "main") {
                calldata.push(rawCallData.slice(0, 4));
                calldata.push(rawCallData[4]);
            }  else if (method === "distancePointEntry") {
                calldata.push({
                    a: rawCallData[0],
                    b: rawCallData[1],
                    c: rawCallData[2]
                });
    
                calldata.push({
                    x: rawCallData[3],
                    y: rawCallData[4]
                });
            }
        } else if (method === "twelve") {
            calldata.push(...rawCallData.slice(0, 3));
        } else {
            for (let i = 0; i < callDataLength; i++) {
                calldata.push(rawCallData[i]);
            }     
        }
    }

    // length 4 calldata
    if (callDataLength === 4) {
        if (method === "calculate") {
            // double/triple functionName, second arg in calldata list e.g.
            // "0x0000000000000000000000000000000000000000000000000000000000000040",
            // "0x0000000000000000000000000000000000000000000000000000000000000005", // idx 1
            // "0x0000000000000000000000000000000000000000000000000000000000000006",
            // "0x646F75626C650000000000000000000000000000000000000000000000000000"
            calldata.push(testCaseName, rawCallData[1])
        } else if (numberOfExpectedArgs === 2 && method === "main") {
            if (filePath.includes("nested_gates_mutating")) {
                const bool1 = rawCallData[0] === '0' ? false : true;
                const bool2 = rawCallData[1] === '0' ? false : true;
                const bool3 = rawCallData[2] === '0' ? false : true;

                calldata.push([bool1, bool2, bool3], rawCallData[3])
            } else if (filePath.includes("mutating_complex")) {
                const witness = rawCallData[0] === '0' ? false : true
                const condition = rawCallData[3] === '0' ? false : true;
                
                calldata.push({a: witness, b: rawCallData[1], c: rawCallData[2]});
                calldata.push(condition);
            }
        } else {
            for (let i = 0; i < callDataLength; i++) {
                calldata.push(rawCallData[i]);
            }   
        }
    }

    // length 3 calldata
    if (callDataLength === 3) {
        if (method === "#deployer" && filePath.includes("simple.sol")) {
            const shouldRevert = rawCallData[2] === '0' ? false : true;
            calldata.push(rawCallData[0]);
            calldata.push(rawCallData[1]);
            calldata.push(shouldRevert);
        } else if ((filePath.includes("structure_immutable_method.sol") || filePath.includes("structure_mutable_method.sol")) && testCaseName === "main") {
            const structArg = {
                a: rawCallData[0],
                b: rawCallData[1],
                c: rawCallData[2],
            };
            calldata.push(structArg);
        } else if (filePath.includes("nested_gates")) {
            const bool1 = rawCallData[0] === '0' ? false : true;
            const bool2 = rawCallData[1] === '0' ? false : true;
            const bool3 = rawCallData[2] === '0' ? false : true;

            calldata.push([bool1, bool2, bool3]);
        } else if (numberOfExpectedArgs === 1 && method === "triangle") {
            const triangle = {
                a: rawCallData[0],
                b: rawCallData[1],
                c: rawCallData[2]
            };
            
            calldata.push(triangle);
        } else {
            for (let i = 0; i < callDataLength; i++) {
                calldata.push(rawCallData[i]);
            } 
        }
    }

    // length 1 calldata
    if (callDataLength === 1) {
        if (method === "main" && testCaseName.includes("condition")) {
            const arg = rawCallData[0] === '0' ? false : true;
            calldata.push(arg);
        } else if (method === "sphere") {
            calldata.push({ r: rawCallData[0] });
        } else if (method === "cube") {
            calldata.push({ a: rawCallData[0] });
        } else if (filePath.includes("require.sol")) {
            const arg = rawCallData[0] === "0" ? false : true;
            calldata.push(arg);
        } else {
            calldata.push(rawCallData[0]);
        }
    }

    return calldata;
}
