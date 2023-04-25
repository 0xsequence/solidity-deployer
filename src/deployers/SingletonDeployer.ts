import { Contract, ContractFactory, Signer, ethers, providers } from 'ethers'
import type { Logger } from 'src/types/logger'
import { SingletonFactoryContract } from '../contracts/SingletonFactory'

export class SingletonDeployer {
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
    ...args: Parameters<T['deploy']>
  ): Promise<Contract> => {
    this.logger?.log(`Deploying ${name}`)
    const c = new contract(this.signer)
    const { data } = c.getDeployTransaction(...args)

    if (!data) {
      throw new Error(`no data for ${name}`)
    }

    const address = ethers.utils.getAddress(
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

    if ((await this.provider.getCode(address)).length > 2) {
      this.logger?.log(
        `Skipping ${name} because it has been deployed at ${address}`,
      )
      return c.attach(address)
    }

    const maxGasLimit = await this.provider
      .getBlock('latest')
      .then(b => b.gasLimit.mul(4).div(10))
    const tx = await this.singletonFactory.deploy(
      data,
      ethers.constants.HashZero,
      { gasLimit: maxGasLimit },
    )
    await tx.wait()

    if ((await this.provider.getCode(address)).length <= 2) {
      const errMsg = `Failed to deploy ${name} at ${address}`
      this.logger?.error(errMsg)
      throw new Error(errMsg)
    }

    return c.attach(address)
  }
}
