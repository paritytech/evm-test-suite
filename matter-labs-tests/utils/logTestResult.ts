import chalk from 'chalk';

export const logTestResult = (method: string, expectedData?: any, result?: any, verboseLogging?: string) => {
    if ((verboseLogging?.toLowerCase() === 'true') && expectedData && result) {
        console.log(chalk.green(`Method ${method}: expected: ${JSON.stringify(expectedData)} - actual: ${result}`))
    } 
}

export const logEventTestResult = (method: string, expectedIndexedData?: any, decodedIndexedData?: any, expectedUnindexedData?: any, decodedUnindexedData?: any, verboseLogging?: string) => {
    if (verboseLogging && expectedIndexedData && decodedIndexedData) {
        console.log(chalk.green(`Method ${method}: indexed expected: ${JSON.stringify(expectedIndexedData)} - actual: ${decodedIndexedData}`))
    }
    if (verboseLogging && expectedUnindexedData && decodedUnindexedData) {
        console.log(chalk.green(`Method ${method}: unindexed expected: ${JSON.stringify(expectedUnindexedData)} - actual: ${decodedUnindexedData}`))
    }
}