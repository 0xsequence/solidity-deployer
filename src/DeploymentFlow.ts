import { Tenderly, TenderlyConfiguration } from '@tenderly/sdk'
import { BigNumber, BigNumberish, Contract, ContractFactory, Signer, providers, utils } from 'ethers'
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
    private readonly signer: Signer,
    networkName = 'homestead',
    private readonly logger?: Logger,
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
    fundsRecoveryAddr?: string,
    txParams: providers.TransactionRequest = {},
    ...args: Parameters<T['deploy']>
  ): Promise<Contract> => {
    const c = await this.deployer.deploy(friendlyName, contract, contractInstance, txParams, ...args)
    if (fundsRecoveryAddr) {
      await this.recoverFunds(fundsRecoveryAddr)
    }
    await this.verifier.verifyContract(c.address, verificationRequest)
    return c
  }

  /**
   * Return all funds in signer to address
   * @return The dust remaining in the signer
   */
  recoverFunds = async (address: string): Promise<BigNumber> => {
    if (!this.signer.provider) throw new Error('Signer must have a provider')
    const { provider } = this.signer

    this.logger?.log(`Recovering signer funds to ${address}`)
    const signerAddress = await this.signer.getAddress()
    const signerBalance = await this.signer.getBalance(signerAddress)
    
    const isEOA = (await provider.getCode(address)).length <= 2
    const gasEstimate = isEOA ? 21000 : await this.signer.estimateGas({ to: address, value: signerBalance })
    const gasPrice = await provider.getGasPrice()

    const tx = await this.signer.sendTransaction({
      to: address,
      value: signerBalance.sub(gasPrice.mul(gasEstimate)),
      gasLimit: gasEstimate,
      gasPrice,
    })
    await tx.wait()

    const dust = await provider.getBalance(signerAddress)
    this.logger?.log(`Dust remaining: ${utils.formatEther(dust)} ETH`)
    this.logger?.log('Funds recovered')

    return dust
  }

}
