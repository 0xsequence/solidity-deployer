import type {
  BigNumberish,
  Contract,
  ContractFactory,
  Signer,
  providers,
} from 'ethers'
import { ethers } from 'ethers'
import { readFileSync, writeFileSync } from 'node:fs'
import type { Deployer } from 'src/types/deployer'
import type { Logger } from 'src/types/logger'

export class EOADeployer implements Deployer {
  private deployedAddresses: { [deployData: string]: string } = {}

  constructor(
    private readonly signer: Signer,
    private readonly logger?: Logger,
    private readonly deployedFilename?: string,
  ) {
    if (deployedFilename) {
      try {
        const content = readFileSync(deployedFilename, 'utf-8')
        this.deployedAddresses = JSON.parse(content)
      } catch (e) {
        this.logger?.error(
          `Failed to load deployed addresses from ${deployedFilename}`,
        )
      }
    }
  }

  addressOf = async <T extends ContractFactory>(
    contract: new (...args: [signer: Signer]) => T,
    _?: BigNumberish,
    ...args: Parameters<T['deploy']>
  ): Promise<string> => {
    const c = new contract(this.signer)
    const { data } = c.getDeployTransaction(...args)
    if (!data) {
      throw new Error(`No data for ${contract.name}`)
    }
    const addr = this.deployedAddresses[data.toString()]
    if (!addr) {
      throw new Error(`No address for ${contract.name}`)
    }
    return addr
  }

  deploy = async <T extends ContractFactory>(
    name: string,
    contract: new (...args: [signer: Signer]) => T,
    contractInstance: BigNumberish,
    txParams: providers.TransactionRequest = {},
    ...args: Parameters<T['deploy']>
  ): Promise<Contract> => {
    this.logger?.log(`Deploying ${name}`)
    const c = new contract(this.signer)
    const { data } = c.getDeployTransaction(...args)

    if (!data) {
      throw new Error(`No data for ${name}`)
    }

    try {
      // Check if contract already deployed
      const address = await this.addressOf(contract, contractInstance, ...args)
      this.logger?.log(
        `Skipping ${name} because it has been deployed at ${address}`,
      )
      return c.attach(address)
    } catch (e) {
      // Ignore. Not deployed yet
    }

    const nonce = await this.signer.getTransactionCount()

    // Deploy it
    const tx = await this.signer.sendTransaction({
      data,
      ...txParams,
    })
    await tx.wait()
    const addr = ethers.utils.getContractAddress({
      from: await this.signer.getAddress(),
      nonce,
    })

    this.logger?.log(`Deployed ${name} at ${addr}`)

    // Store address
    this.deployedAddresses[data.toString()] = addr
    if (this.deployedFilename) {
      // Write to file immediately
      await writeFileSync(
        this.deployedFilename,
        JSON.stringify(this.deployedAddresses, null, 2),
      )
    }

    return c.attach(addr)
  }
}
