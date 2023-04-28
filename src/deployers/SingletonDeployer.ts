import type {
  BigNumberish,
  BytesLike,
  Contract,
  ContractFactory,
  Signer,
  providers,
} from 'ethers'
import { BigNumber, ethers } from 'ethers'
import { SingletonFactoryContract } from '../contracts/SingletonFactory'
import type { Logger } from 'src/types/logger'
import type { Deployer } from 'src/types/deployer'

export class SingletonDeployer implements Deployer {
  private readonly provider: providers.Provider
  singletonFactory: SingletonFactoryContract

  constructor(
    private readonly signer: Signer,
    private readonly logger?: Logger,
    singletonFactory?: SingletonFactoryContract,
  ) {
    if (!signer.provider) throw new Error('Signer must have a provider')
    this.provider = signer.provider
    if (singletonFactory) {
      this.singletonFactory = singletonFactory
    } else {
      this.singletonFactory = new SingletonFactoryContract(this.signer)
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
