import type {
  BigNumberish,
  BytesLike,
  Contract,
  ContractFactory,
  Signer,
  providers,
} from 'ethers'
import { BigNumber, ethers } from 'ethers'
import {
  SINGLETONFACTORY_ADDR,
  SingletonFactoryContract,
} from '../contracts/SingletonFactory'
import type { Logger } from 'src/types/logger'
import type { Deployer } from 'src/types/deployer'

const SINGLETONDEPLOYER_FUNDING = BigNumber.from('24700000000000000')
const EOA_SINGLETONDEPLOYER_ADDRESS =
  '0xBb6e024b9cFFACB947A71991E386681B1Cd1477D'

const SINGLETONDEPLOYER_TX =
  '0xf9016c8085174876e8008303c4d88080b90154608060405234801561001057600080fd5b50610134806100206000396000f3fe6080604052348015600f57600080fd5b506004361060285760003560e01c80634af63f0214602d575b600080fd5b60cf60048036036040811015604157600080fd5b810190602081018135640100000000811115605b57600080fd5b820183602082011115606c57600080fd5b80359060200191846001830284011164010000000083111715608d57600080fd5b91908080601f016020809104026020016040519081016040528093929190818152602001838380828437600092019190915250929550509135925060eb915050565b604080516001600160a01b039092168252519081900360200190f35b6000818351602085016000f5939250505056fea26469706673582212206b44f8a82cb6b156bfcc3dc6aadd6df4eefd204bc928a4397fd15dacf6d5320564736f6c634300060200331b83247000822470'

const DEPLOYER_MAX_GAS = ethers.utils.parseUnits("100", 'gwei')

export class SingletonDeployer implements Deployer {
  private readonly provider: providers.Provider
  singletonFactory: SingletonFactoryContract

  constructor(
    private readonly signer: Signer,
    private readonly logger?: Logger,
    singletonFactory?: SingletonFactoryContract,
    private readonly eoaFundingOverride?: BigNumberish,
  ) {
    if (!signer.provider) throw new Error('Signer must have a provider')
    this.provider = signer.provider
    if (singletonFactory) {
      this.singletonFactory = singletonFactory
    } else {
      this.singletonFactory = new SingletonFactoryContract(this.signer)
    }
  }

  deployDeployer = async (txParams: providers.TransactionRequest = {}) => {
    if (
      (await this.provider.getCode(this.singletonFactory.address)).length > 2
    ) {
      // Already deployed
      return
    }

    if (this.singletonFactory.address !== SINGLETONFACTORY_ADDR) {
      const errMsg = `Unable to deploy singleton deployer at ${this.singletonFactory.address}`
      this.logger?.error(errMsg)
      throw new Error(errMsg)
    }

    // Fund deployer EOA
    const eoaBalance = await this.provider.getBalance(
      EOA_SINGLETONDEPLOYER_ADDRESS,
    )

    const eoaExpectedFunds = BigNumber.from(
      this.eoaFundingOverride ?? SINGLETONDEPLOYER_FUNDING,
    )
    if (eoaBalance.lt(eoaExpectedFunds)) {
      this.logger?.log("Funding singleton deployer's EOA")
      const tx = await this.signer.sendTransaction({
        to: EOA_SINGLETONDEPLOYER_ADDRESS,
        value: eoaExpectedFunds.sub(eoaBalance),
        ...txParams,
      })
      const receipt = await tx.wait()
      if (receipt.status !== 1) {
        const errMsg = `Failed to fund singleton deployer EOA ${EOA_SINGLETONDEPLOYER_ADDRESS} with ${eoaExpectedFunds}`
        this.logger?.error(errMsg)
        throw new Error(errMsg)
      }
    }

    // Deploy singleton deployer
    this.logger?.log('Deploying singleton deployer contract')
    const gasPrice = BigNumber.from(txParams.gasPrice ?? await this.provider.getGasPrice())
    const gasTooHigh = gasPrice.gt(DEPLOYER_MAX_GAS)
    if (gasTooHigh) {
      // Warn user that gas price is too high. Try anyway
      this.logger?.error('Gas price too high for singleton deployer. Trying anyway...')
    }

    const tx = await this.provider.sendTransaction(SINGLETONDEPLOYER_TX)
    try {
      const receipt = await tx.wait()

      // Confirm deployment
      if (
        receipt.status !== 1 ||
        (await this.provider.getCode(SINGLETONFACTORY_ADDR)).length <= 2
      ) {
        const errMsg = `Failed to deploy singleton deployer at ${SINGLETONFACTORY_ADDR}`
        this.logger?.error(errMsg)
        throw new Error(errMsg)
      }

    } catch (err) {
      if (gasTooHigh) {
        this.logger?.error('Gas price too high for singleton deployer. This is likely why the transaction failed!')
      }
      throw err
    }
  }

  deploy = async <T extends ContractFactory>(
    name: string,
    contract: new (...args: [signer: Signer]) => T,
    contractInstance: BigNumberish = 0,
    txParams: providers.TransactionRequest = {},
    ...args: Parameters<T['deploy']>
  ): Promise<Contract> => {
    if (!BigNumber.from(contractInstance).isZero()) {
      throw new Error('Singleton cannot deploy non-zero instances')
    }

    this.logger?.log(`Deploying ${name}`)
    const c = new contract(this.signer)
    const { data } = c.getDeployTransaction(...args)

    if (!data) {
      throw new Error(`No data for ${name}`)
    }

    // Check if contract already deployed
    const address = await this.addressFromData(data)
    if ((await this.provider.getCode(address)).length > 2) {
      this.logger?.log(
        `Skipping ${name} because it has been deployed at ${address}`,
      )
      return c.attach(address)
    }

    // Up the gas
    if (!txParams.gasLimit) {
      txParams.gasLimit = await this.provider
        .getBlock('latest')
        .then(b => b.gasLimit.mul(4).div(10))
    }

    // Deploy deployer if required
    await this.deployDeployer(txParams)

    // Deploy it
    const tx = await this.singletonFactory.deploy(
      data,
      ethers.constants.HashZero,
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
    if (!BigNumber.from(contractInstance).isZero()) {
      throw new Error('Singleton cannot deploy non-zero instances')
    }

    const c = new contract(this.signer)
    const { data } = c.getDeployTransaction(...args)
    if (!data) {
      throw new Error(`No data for ${contract.name}`)
    }
    return this.addressFromData(data)
  }

  addressFromData = async (data: BytesLike): Promise<string> => {
    return ethers.utils.getAddress(
      ethers.utils.hexDataSlice(
        ethers.utils.keccak256(
          ethers.utils.solidityPack(
            ['bytes1', 'address', 'bytes32', 'bytes32'],
            [
              '0xff',
              this.singletonFactory.address,
              ethers.constants.HashZero,
              ethers.utils.keccak256(data),
            ],
          ),
        ),
        12,
      ),
    )
  }
}
