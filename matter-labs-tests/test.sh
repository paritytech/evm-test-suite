#!/bin/sh

set -eux

cd ..
npm i &&
cd ./hardhat-resolc
npm i &&
cd ../matter-labs-tests
npm i --force &&
npx hardhat compile
