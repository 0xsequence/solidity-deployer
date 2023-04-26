import { Tenderly, TenderlyConfiguration } from '@tenderly/sdk'
import { BigNumberish, Contract, ContractFactory, Signer, providers } from 'ethers'
import { Logger } from './types/logger'
import { Deployer } from './types/deployer'
import { ContractVerificationRequest, ContractVerifier } from './ContractVerifier'
import { UniversalDeployer } from './deployers/UniversalDeployer'

export class DeployerFlow {
  private readonly deployer: Deployer
  private readonly verifier: ContractVerifier

  constructor(
    tenderly: TenderlyConfiguration | Tenderly,
    etherscanApiKey: string,
    signer: Signer,
    networkName = 'homestead',
    logger?: Logger,
    deployer?: Deployer,
  ) {
    this.verifier = new ContractVerifier(tenderly, etherscanApiKey, signer, networkName, logger)
    if (deployer) {
      this.deployer = deployer
    } else {
      this.deployer = new UniversalDeployer(signer)
    }
  }

  deployAndVerify = async <T extends ContractFactory>(
    friendlyName: string,
    contract: new (...args: [signer: Signer]) => T,
    verificationRequest: ContractVerificationRequest,
    contractInstance: BigNumberish = 0,
    txParams: providers.TransactionRequest = {},
    ...args: Parameters<T['deploy']>
  ): Promise<Contract> => {
    const c = await this.deployer.deploy(friendlyName, contract, contractInstance, txParams, ...args)
    await this.verifier.verifyContract(c.address, verificationRequest)
    return c
  }

}
