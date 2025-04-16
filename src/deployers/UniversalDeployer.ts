import type {
  BigNumberish,
  BytesLike,
  Contract,
  ContractFactory,
  Signer,
  providers,
} from 'ethers'
import { BigNumber, ethers } from 'ethers'
import type { Deployer } from 'src/types/deployer'
import type { Logger } from 'src/types/logger'
import {
  UNIVERSALDEPLOYER2_ADDR,
  UNIVERSALDEPLOYER_2_BYTECODE,
  UniversalDeployer2Contract,
} from '../contracts/UniversalDeployer2'

const EOA_UNIVERSALDEPLOYER_ADDRESS =
  '0x9c5a87452d4FAC0cbd53BDCA580b20A45526B3AB'
const UNIVERSALDEPLOYER_ADDRESS = '0x1b926fbb24a9f78dcdd3272f2d86f5d0660e59c0'
const UNIVERSALDEPLOYER_FUNDING = BigNumber.from(300).mul(
  BigNumber.from(10).pow(14),
)
const UNIVERSALDEPLOYER_TX =
  '0xf9010880852416b84e01830222e08080b8b66080604052348015600f57600080fd5b50609980601d6000396000f3fe60a06020601f369081018290049091028201604052608081815260009260609284918190838280828437600092018290525084519495509392505060208401905034f5604080516001600160a01b0383168152905191935081900360200190a0505000fea26469706673582212205a310755225e3c740b2f013fb6343f4c205e7141fcdf15947f5f0e0e818727fb64736f6c634300060a00331ca01820182018201820182018201820182018201820182018201820182018201820a01820182018201820182018201820182018201820182018201820182018201820'

const DEPLOYER_MAX_GAS = ethers.utils.parseUnits("100", 'gwei')

export class UniversalDeployer implements Deployer {
  private readonly provider: providers.Provider
  universalFactory: UniversalDeployer2Contract

  constructor(
    private readonly signer: Signer,
    private readonly logger?: Logger,
    universalFactory?: UniversalDeployer2Contract,
    private readonly eoaFundingOverride?: BigNumberish,
  ) {
    if (!signer.provider) throw new Error('Signer must have a provider')
    this.provider = signer.provider
    if (universalFactory) {
      this.universalFactory = universalFactory
    } else {
      this.universalFactory = new UniversalDeployer2Contract(this.signer)
    }
  }

  deployDeployer = async (defaultTxParams: providers.TransactionRequest = {}) => {
    if (
      (await this.provider.getCode(this.universalFactory.address)).length > 2
    ) {
      // Already deployed
      return
    }

    const txParams = {
      ...defaultTxParams,
      gasLimit: defaultTxParams.gasLimit ?? 200000,
    }

    if (this.universalFactory.address !== UNIVERSALDEPLOYER2_ADDR) {
      const errMsg = `Unable to deploy universal deployer at ${this.universalFactory.address}`
      this.logger?.error(errMsg)
      throw new Error(errMsg)
    }

    // Deploy universal deployer v1 first
    if ((await this.provider.getCode(UNIVERSALDEPLOYER_ADDRESS)).length <= 2) {
      // Fund deployer EOA
      const eoaBalance = await this.provider.getBalance(
        EOA_UNIVERSALDEPLOYER_ADDRESS,
      )

      const eoaExpectedFunds = BigNumber.from(
        this.eoaFundingOverride ?? UNIVERSALDEPLOYER_FUNDING,
      )
      if (eoaBalance.lt(eoaExpectedFunds)) {
        this.logger?.log("Funding universal deployer's EOA")
        const tx = await this.signer.sendTransaction({
          to: EOA_UNIVERSALDEPLOYER_ADDRESS,
          value: eoaExpectedFunds.sub(eoaBalance),
          ...txParams,
        })
        const receipt = await tx.wait()
        if (receipt.status !== 1) {
          const errMsg = `Failed to fund universal deployer EOA ${EOA_UNIVERSALDEPLOYER_ADDRESS} with ${eoaExpectedFunds}`
          this.logger?.error(errMsg)
          throw new Error(errMsg)
        }
      }

      // Deploy universal deployer v1
      this.logger?.log('Deploying universal deployer contract')
      const gasPrice = BigNumber.from(txParams.gasPrice ?? await this.provider.getGasPrice())
      const gasTooHigh = gasPrice.gt(DEPLOYER_MAX_GAS)
      if (gasTooHigh) {
        // Warn user that gas price is too high. Try anyway
        this.logger?.error('Gas price too high for universal deployer. Trying anyway...')
      }

      const tx = await this.provider.sendTransaction(UNIVERSALDEPLOYER_TX)
      try {
        const receipt = await tx.wait()

        // Confirm deployment
        if (
          receipt.status !== 1 ||
          (await this.provider.getCode(UNIVERSALDEPLOYER_ADDRESS)).length <= 2
        ) {
          const errMsg = `Failed to deploy universal deployer at ${UNIVERSALDEPLOYER_ADDRESS}`
          this.logger?.error(errMsg)
          throw new Error(errMsg)
        }

      } catch (err) {
        if (gasTooHigh) {
          this.logger?.error('Gas price too high for universal deployer. This is likely why the transaction failed!')
        }
        throw err
      }
    }

    // Deploy universal deployer v2
    this.logger?.log('Deploying universal deployer v2 contract')
    const tx2 = await this.signer.sendTransaction({
      to: UNIVERSALDEPLOYER_ADDRESS,
      data: UNIVERSALDEPLOYER_2_BYTECODE,
      ...txParams,
    })
    const receipt2 = await tx2.wait()

    // Confirm deployment
    if (
      receipt2.status !== 1 ||
      (await this.provider.getCode(UNIVERSALDEPLOYER2_ADDR)).length <= 2
    ) {
      const errMsg = `Failed to deploy universal deployer v2 at ${UNIVERSALDEPLOYER2_ADDR}`
      this.logger?.error(errMsg)
      throw new Error(errMsg)
    }
  }

  deploy = async <T extends ContractFactory>(
    name: string,
    contract: new (...args: [signer: Signer]) => T,
    contractInstance: BigNumberish = 0,
    defaultTxParams: providers.TransactionRequest = {},
    ...args: Parameters<T['deploy']>
  ): Promise<Contract> => {
    this.logger?.log(`Deploying ${name}`)
    const c = new contract(this.signer)
    const { data } = c.getDeployTransaction(...args)

    if (!data) {
      throw new Error(`No data for ${name}`)
    }

    const txParams = {
      ...defaultTxParams,
    }

    // Check if contract already deployed
    const address = await this.addressFromData(data, contractInstance)
    if ((await this.provider.getCode(address)).length > 2) {
      this.logger?.log(
        `Skipping ${name} because it has been deployed at ${address}`,
      )
      return c.attach(address)
    }

    // Deploy deployer if required
    await this.deployDeployer(txParams)

    // Up the gas
    if (!txParams.gasLimit) {
      const deployData = this.universalFactory.interface.encodeFunctionData('deploy', [data, contractInstance])
      txParams.gasLimit = await this.provider.estimateGas({
        to: this.universalFactory.address,
        data: deployData,
      })
      this.logger?.log(`Estimated gas limit: ${txParams.gasLimit}`)
    }

    // Deploy it
    const tx = await this.universalFactory.deploy(
      data,
      contractInstance,
      txParams,
    )
    await tx.wait()

    // Confirm deployment
    if ((await this.provider.getCode(address)).length <= 2) {
      const errMsg = `Failed to deploy ${name} at ${address}`
      this.logger?.error(errMsg)
      throw new Error(errMsg)
    }

    return c.attach(address)
  }

  addressOf = async <T extends ContractFactory>(
    contract: new (...args: [signer: Signer]) => T,
    contractInstance: BigNumberish = 0,
    ...args: Parameters<T['deploy']>
  ): Promise<string> => {
    const c = new contract(this.signer)
    const { data } = c.getDeployTransaction(...args)
    if (!data) {
      throw new Error(`No data for ${contract.name}`)
    }
    return this.addressFromData(data, contractInstance)
  }

  addressFromData = async (
    data: BytesLike,
    contractInstance: BigNumberish = 0,
  ): Promise<string> => {
    const codeHash = ethers.utils.keccak256(
      ethers.utils.solidityPack(['bytes'], [data]),
    )

    const salt = ethers.utils.solidityPack(['uint256'], [contractInstance])

    const hash = ethers.utils.keccak256(
      ethers.utils.solidityPack(
        ['bytes1', 'address', 'bytes32', 'bytes32'],
        ['0xff', this.universalFactory.address, salt, codeHash],
      ),
    )

    return ethers.utils.getAddress(ethers.utils.hexDataSlice(hash, 12))
  }
}
