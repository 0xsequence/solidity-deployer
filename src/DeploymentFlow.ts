import type { Tenderly, TenderlyConfiguration } from '@tenderly/sdk'
import type {
  BigNumber,
  BigNumberish,
  Contract,
  ContractFactory,
  ContractTransaction,
  Signer,
  providers,
} from 'ethers'
import { utils } from 'ethers'
import type { ContractVerificationRequest } from './ContractVerifier'
import { ContractVerifier } from './ContractVerifier'
import { WalletFactoryContract } from './contracts/factories/WalletFactory'
import { UniversalDeployer } from './deployers'
import type { Deployer } from './types/deployer'
import type { Logger } from './types/logger'

const WALLET_CODE =
  '0x603a600e3d39601a805130553df3363d3d373d3d3d363d30545af43d82803e903d91601857fd5bf3'

export class DeploymentFlow {
  readonly deployer: Deployer
  private readonly verifier: ContractVerifier

  constructor(
    tenderly: TenderlyConfiguration | Tenderly,
    etherscanApiKey: string,
    private readonly signer: Signer,
    private readonly logger?: Logger,
    deployer?: Deployer,
  ) {
    this.verifier = new ContractVerifier(
      tenderly,
      etherscanApiKey,
      signer,
      logger,
    )
    if (deployer) {
      this.deployer = deployer
    } else {
      this.deployer = new UniversalDeployer(signer, logger)
    }
  }

  /**
   * Deploys guard wallets.
   * @param moduleAddr Deployed module address
   * @param guards List of image hashs for each guard wallet
   * @return List of deployed guard wallet addresses
   */
  deployGuards = async (
    moduleAddr: string,
    guards: string[],
  ): Promise<string[]> => {
    const { provider } = this.signer
    if (!provider) throw new Error('Signer must have a provider')

    // Deploy wallet factory
    const walletFactory = await this.deployer.deploy(
      'WalletFactory',
      WalletFactoryContract,
    )

    const codeHash = utils.keccak256(
      utils.solidityPack(
        ['bytes', 'bytes32'],
        [WALLET_CODE, utils.hexZeroPad(moduleAddr, 32)],
      ),
    )

    const deployedAddrs = []
    const txs: Promise<void>[] = []

    for (const imageHash of guards) {
      // Filter already deployed wallets
      const deployHash = utils.keccak256(
        utils.solidityPack(
          ['bytes1', 'address', 'bytes32', 'bytes32'],
          ['0xff', walletFactory.address, imageHash, codeHash],
        ),
      )
      const guardAddr = utils.getAddress(utils.hexDataSlice(deployHash, 12))
      deployedAddrs.push(guardAddr)
      if ((await provider.getCode(guardAddr)).length > 2) {
        this.logger?.log(
          `Skipping guard wallet ${guardAddr} (already deployed)`,
        )
        continue
      }
      this.logger?.log(
        `Deploying guard wallet ${guardAddr} with hash ${imageHash}`,
      )
      // Deploy it
      const tx: ContractTransaction = await walletFactory.deploy(
        moduleAddr,
        imageHash,
        { gasLimit: 800000 },
      )
      txs.push(
        (async () => {
          this.logger?.log(`Waiting on ${guardAddr} with hash ${imageHash}`)
          await tx.wait()
          this.logger?.log(
            `Deployed guard wallet ${guardAddr} with hash ${imageHash}`,
          )
        })(),
      )
    }

    await Promise.all(txs)

    return deployedAddrs
  }

  deployAndVerify = async <T extends ContractFactory>(
    friendlyName: string,
    contract: new (...args: [signer: Signer]) => T,
    verificationRequest: ContractVerificationRequest,
    deploymentArgs: Parameters<T['deploy']>[] = [],
    contractInstance: BigNumberish = 0,
    txParams: providers.TransactionRequest = {},
    fundsRecoveryAddr?: string,
  ): Promise<Contract> => {
    const c = await this.deployer.deploy.apply(null, [
      friendlyName,
      contract,
      contractInstance,
      txParams,
      ...deploymentArgs,
    ])
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
    const gasEstimate = isEOA
      ? 21000
      : await this.signer.estimateGas({ to: address, value: signerBalance })
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
