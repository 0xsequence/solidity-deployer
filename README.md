# Solidity Deployer

Solidity Deployer is a TypeScript project that simplifies the process of deploying, managing, and verifying Solidity smart contracts. It streamlines the deployment process by providing a robust workflow for deploying contracts, deploying guard wallets, recovering funds, and verifying contracts through Etherscan and Tenderly.

## Key Features

- Deploying Guard Wallets
- Deploying Contracts
- Verifying Contracts on Tenderly and Etherscan
- Recovering Funds

## Installation

To use Solidity Deployer in your project, you need to have Node.js and Yarn installed. You can install the package via Yarn:

```bash
yarn add solidity-deployer
```

## Usage

### DeploymentFlow

The `DeploymentFlow` class is the core of the project, which handles the deployment and management of smart contracts.

#### Constructor

```typescript
constructor(tenderly: TenderlyConfiguration | Tenderly, etherscanApiKey: string, signer: Signer, networkName?: string, logger?: Logger, deployer?: Deployer)
```

Initialize a new `DeploymentFlow` instance with the required configuration options for Tenderly, Etherscan, and other necessary parameters.

#### Deploying Guard Wallets

```typescript
deployGuards: (moduleAddr: string, guards: string[]) => Promise<string[]>
```

This method deploys guard wallets for a given module address and a list of image hashes. It returns a promise that resolves to an array of deployed guard wallet addresses.

#### Deploying and Verifying Contracts

```typescript
deployAndVerify: <T extends ContractFactory>(
  friendlyName: string,
  contract: new (signer: Signer) => T,
  verificationRequest: ContractVerificationRequest,
  deploymentArgs?: Parameters<T['deploy']>[],
  contractInstance?: BigNumberish,
  txParams?: providers.TransactionRequest,
  fundsRecoveryAddr?: string,
) => Promise<Contract>
```

This method deploys and verifies a contract using the provided contract factory and deployment arguments. It also takes a friendly name for the contract, verification request details, and optional transaction parameters and funds recovery address.

#### Recovering Funds

```typescript
recoverFunds: (address: string) => Promise<BigNumber>
```

This method helps to recover all funds in the signer and returns them to the specified address. It returns a promise that resolves to the remaining dust in the signer.

## Example

```typescript
import { Tenderly } from "tenderly";
import { Wallet } from "ethers";
import { DeploymentFlow } from "solidity-deployer";

const tenderlyConfig = {...}; // Your Tenderly configuration
const etherscanApiKey = "your-etherscan-api-key";
const privateKey = "your-private-key";
const networkName = "mainnet";

const signer = new Wallet(privateKey);
const tenderly = new Tenderly(tenderlyConfig);

const deploymentFlow = new DeploymentFlow(tenderly, etherscanApiKey, signer, networkName);

async function main() {
  // Deploy and verify a contract
  const contract = ...; // Your contract factory
  const verificationRequest = ...; // Contract verification request
  const deploymentArgs = ...; // Contract deployment arguments

  const deployedContract = await deploymentFlow.deployAndVerify("MyContract", contract, verificationRequest, deploymentArgs);
  console.log("Deployed contract address:", deployedContract.address);

  // Deploy guards
  const moduleAddr = deployedContract.address;
  const guards = [...]; // List of image hashes for each guard wallet
  const deployedGuardWallets = await deploymentFlow.deployGuards(moduleAddr, guards);
  console.log("Deployed guard wallets:", deployedGuardWallets);

  // Recover funds
  const recoveryAddress = "your-recovery-address";
  const remainingDust = await deploymentFlow.recoverFunds(recoveryAddress);
  console.log("Remaining dust in signer:", remainingDust.toString());
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
```
