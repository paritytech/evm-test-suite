import { SolcOutput } from "../types";
import { exec as execCb } from 'child_process';
import { promisify } from 'util';
import { compile, resolveInputs } from '@parity/revive';
import { readFileSync, writeFileSync } from "fs";

const exec = promisify(execCb);

export async function compileWithWasm(sources: any): Promise<SolcOutput> {

    // writeFileSync('/home/bee344/Documentos/parity/evm-test-suite/input.log', JSON.stringify(sources));

    // console.log(JSON.parse(readFileSync('/home/bee344/Documentos/parity/evm-test-suite/input.log', 'utf-8')))

    const out = await compile(sources["sources"]);

    return out;
}
