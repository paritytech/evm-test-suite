### Compilation Assertions
These tests run on two steps, at first the artifacts are generated through binaries
built for windows, macOS and linux, and then those artifcats are compared against
eachother to find differences between their bytecode hashes.

There are some environment variables that can to be defined in order to limit the
scope of the compilation and to update the behaviour of the compiler:
* `BIN_RESOLC_CONFIG`: the configuration flags being passed to the binarie compiler
that is using the `--bin` flag. 
* `JSON_RESOLC_CONFIG`: the configuration flags being passed to the binarie compiler
that is using the `--standard-json` flag. 
* `THREADS_NUMBER`: the number of parallel processes being spawned in order to speed
up the process. Defaults to `16`.
* `LOGS_DIR`: the directory where the compilation logs and the artifacts will be stored.
* `CONTRACTS_DIR`: the directory of the folder where the contracts are located.

The steps in which these processes are being ran can be found in `compile-test.yml`.
