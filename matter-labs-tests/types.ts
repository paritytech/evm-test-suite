export type CalldataValue = string;
export type CalldataList = string[];
export type Calldata = CalldataList | CalldataValue;

export type StorageList = {
    kind: 'StorageList';
    data: string[];
}
export type StorageMap = {
    kind: 'StorageMap';
    data: Map<string, string>;
}

export type StorageItem = StorageList | StorageMap;

export type EventItem = {
    /// The emitter contract address.
   address: string | undefined;
    /// The indexed topics.
   topics: string[];
    /// The ordinary values.
   values: string[];
}

export enum Op {
    Exact,
    Greater,
    GreaterEq,
    Less,
    LessEq,
    Tilde,
    Caret,
    Wildcard,
    __NonExhaustive,
}

export type Identifier = {
    head: string;
    tail: string[];
}

export type Prerelease = {
    identifier: Identifier;
}

/// A pair of comparison operator and partial version, such as `>=1.2`. Forms
/// one piece of a VersionReq.
export type Comparator = {
    op: Op;
    major: number;
    minor: number | undefined;
    /// Patch is only allowed if minor is Some.
    patch: number | undefined;
    /// Non-empty pre-release is only allowed if patch is Some.
    pre: Prerelease;
}

export type VersionReq = {
    comparators: Comparator[];
}

export type Extended = {
    /// The return data values.
   return_data: string[];
    /// The emitted events.
   events?: EventItem[];
    /// Whether an exception is expected,
   exception: boolean;
    /// The compiler version filter.
   compilerVersion: VersionReq | undefined;
}

export type SingleVariant =  string[];
export type ExtendedVariant = Extended;
export type Variant  = SingleVariant | ExtendedVariant;

export type SingleExpected = Variant;
export type MultipleExpected = Variant[];
export type Expected = SingleExpected | MultipleExpected;

export type Input = {
    /// The comment to an entry.
    comment: string | undefined;
    /// The contract instance.
    instance: string;
    /// The caller address.
    caller: string;
    /// The contract method name.
    /// `#deployer` for the deployer call
    /// `#fallback` for the fallback
    method: string;
    /// The passed calldata.
    calldata: Calldata;
    /// The passed value.
    value: string | undefined;
    /// The initial contracts storage.
    storage: Map<string, StorageItem>;
    /// The expected return data.
    expected: Expected | undefined;
}

export type Case = {
    /// The comment to a case.
    comment: string | undefined;
    /// The case name.
    name: string;
    /// The mode filter.
    modes: string[] | undefined;
    /// The case inputs.
    inputs: Input[];
    /// The expected return data.
    expected: Expected;
    /// If the test case must be ignored.
    ignore: boolean;
    /// Overrides the default number of cycles.
    cycles: number | undefined;
}

export type EVMContract = {
    /// The runtime code.
    runtimeCode: string;
}

export enum Target {
    /// The EraVM target.
    EraVM,
    /// The native EVM target.
    EVM,
    /// The EVM interpreter running on top of EraVM.
    EVMInterpreter,
}

export type Metadata = {
    /// The test cases.
    cases: Case[];
    /// The mode filter.
    modes: string[] | undefined;
    /// The test contracts.
    /// The format is `instance -> path`.
    contracts: Map<string, string>;
    /// The EVM auxiliary contracts.
    /// The format is `instance -> init code`.
    evmContracts: Map<string, EVMContract>;
    /// The test libraries for linking.
    libraries: Map<string, Map<string, string>>;
    /// Enable the EraVM extensions.
    enableEravmExtensions: boolean;
    /// The target to run the test on.
    target: Target | undefined;
    /// If the entire test file must be ignored.
    ignore: boolean;
    /// The test group.
    group: string | undefined;
}

export type Contracts = {
    Main: string;
    Callable?: string;
    Storage?: string;
    First?: string;
    Second?: string;
    Third?: string;
    Library?: string;
}

export type Libraries = {
    libraries: {
        [x: string]: string
    }
}

export type ContractData =  { metadata: Metadata, contractPath: string, filePath: string }[];

export type TestNameInputs = {
    [x: string]: Input[]
}