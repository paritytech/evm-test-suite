#!/bin/sh

set -eux

cd ..
npm i &&
cd ./hardhat-resolc
npm i &&
cd ../matter-labs-tests
npm i --force &&
echo "Start"
echo `date`
npx hardhat compile &&
echo End
echo `date`
