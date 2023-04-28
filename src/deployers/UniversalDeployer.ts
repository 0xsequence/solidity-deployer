import {
  BigNumberish,
  BytesLike,
  Contract,
  ContractFactory,
  Signer,
  ethers,
  providers,
} from 'ethers'
import { UniversalDeployer2Contract } from '../contracts/UniversalDeployer2'
import { Deployer } from 'src/types/deployer'
import { Logger } from 'src/types/logger'

export class UniversalDeployer implements Deployer {
  private readonly provider: providers.Provider
  universalFactory: UniversalDeployer2Contract

  constructor(
    private readonly signer: Signer,
    private readonly logger?: Logger,
    universalFactory?: UniversalDeployer2Contract,
  ) {
    if (!signer.provider) throw new Error('Signer must have a provider')
    this.provider = signer.provider
    if (universalFactory) {
      this.universalFactory = universalFactory
    } else {
      this.universalFactory = new UniversalDeployer2Contract(this.signer)
    }
  }

  deploy = async <T extends ContractFactory>(
    name: string,
    contract: new (...args: [signer: Signer]) => T,
    contractInstance: BigNumberish = 0,
    txParams: providers.TransactionRequest = {},
    ...args: Parameters<T['deploy']>
  ): Promise<Contract> => {
    this.logger?.log(`Deploying ${name}`)
    const c = new contract(this.signer)
    const { data } = c.getDeployTransaction(...args)

    if (!data) {
      throw new Error(`No data for ${name}`)
    }

    // Check if contract already deployed
    const address = await this.addressFromData(data, contractInstance)
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
    const tx = await this.universalFactory.deploy(data, contractInstance, txParams)
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
