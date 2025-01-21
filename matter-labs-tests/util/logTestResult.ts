import chalk from 'chalk';

export const logTestResult = (method: string, expectedData?: any, result?: any) => {
    if (expectedData && result) {
        console.log(chalk.green(`Method ${method}: expected: ${expectedData} - actual: ${result}`))
    } 
}

export const logEventTestResult = (method: string, expectedIndexedData?: any, decodedIndexedData?: any, expectedUnindexedData?: any, decodedUnindexedData?: any) => {
    if (expectedIndexedData && decodedIndexedData) {
        console.log(chalk.green(`Method ${method}: indexed expected: ${expectedIndexedData} - actual: ${decodedIndexedData}`))
    }
    if (expectedUnindexedData && decodedUnindexedData) {
        console.log(chalk.green(`Method ${method}: unindexed expected: ${expectedUnindexedData} - actual: ${decodedUnindexedData}`))
    }
}