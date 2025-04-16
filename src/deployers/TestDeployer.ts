import {
  BigNumber,
  type BigNumberish,
  type BytesLike,
  Contract,
  type ContractFactory,
  ethers,
  type providers,
  type Signer,
  utils,
} from 'ethers'
import type { Deployer } from '../types/deployer'
import type { Logger } from '../types/logger'
import { ec as EC } from 'elliptic'

import { SINGLETONFACTORY_ADDR } from '../contracts/SingletonFactory'
import {
  UNIVERSALDEPLOYER2_ADDR,
  UNIVERSALDEPLOYER2_ABI,
  UNIVERSALDEPLOYER_2_BYTECODE,
} from '../contracts/UniversalDeployer2'

export const DEPLOYMENT_COST = ethers.utils.parseEther('0.0247')

const SECP256K1_N = BigNumber.from(
  '0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141',
)

// The test deployer will generate and deploy an ERC-2470 transaction to test that it can pass
// Note this will use the UniversalDeployer if available, otherwise it will deploy a new one to a random address
export class TestDeployer implements Deployer {
  private provider: providers.Provider
  private r: string
  private s: string
  private v: number

  constructor(
    private signer: Signer,
    private logger?: Logger,
    private readonly eoaFundingOverride?: BigNumberish,
  ) {
    if (!signer.provider) {
      throw new Error('Signer must have a provider')
    }
    this.provider = signer.provider

    // Generate valid r and s using elliptic library
    const ec = new EC('secp256k1')
    const key = ec.genKeyPair()
    const signature = key.sign(utils.randomBytes(32))

    this.r = '0x' + signature.r.toString(16)
    this.s = '0x' + signature.s.toString(16)
    // Map recovery parameter to Ethereum v value (27 or 28)
    this.v = signature.recoveryParam === 0 ? 27 : 28

    // Ensure s is in the lower half of the curve order
    const sBN = BigNumber.from(this.s)
    if (sBN.gt(SECP256K1_N.div(2))) {
      this.s = utils.hexlify(SECP256K1_N.sub(sBN))
      this.v = this.v === 27 ? 28 : 27
    }
  }

  public async deploy<T extends ContractFactory>(
    name: string,
    contract: new (...args: [Signer]) => T,
    contractInstance: BigNumberish = 0,
    defaultTxParams: providers.TransactionRequest = {},
    ...args: Parameters<T['deploy']>
  ): Promise<Contract> {
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
    const deployerAddress = await this.deployDeployer(txParams)
    const universalFactory = new Contract(
      deployerAddress,
      UNIVERSALDEPLOYER2_ABI,
      this.signer,
    )

    // Up the gas
    if (!txParams.gasLimit) {
      const deployData = universalFactory.interface.encodeFunctionData(
        'deploy',
        [data, contractInstance],
      )
      txParams.gasLimit = await this.provider.estimateGas({
        to: universalFactory.address,
        data: deployData,
      })
      this.logger?.log(`Estimated gas limit: ${txParams.gasLimit}`)
    }

    // Deploy it
    const tx = await universalFactory.deploy(data, contractInstance, txParams)
    await tx.wait()

    // Confirm deployment
    if ((await this.provider.getCode(address)).length <= 2) {
      const errMsg = `Failed to deploy ${name} at ${address} in ${tx.hash}`
      this.logger?.error(errMsg)
      throw new Error(errMsg)
    }

    return c.attach(address)
  }

  private generateRawTxAndSignature = async (): Promise<{
    rawTx: string
    signature: { v: number; r: string; s: string }
    deployerEOA: string
  }> => {
    const txUnsigned: ethers.utils.UnsignedTransaction = {
      type: 0,
      chainId: 0,
      nonce: 0,
      gasPrice: BigNumber.from('0x174876E800'), // 100 gwei
      gasLimit: BigNumber.from('0x3C4D8'), // 247000
      data: UNIVERSALDEPLOYER_2_BYTECODE,
    }
    const txSignature = {
      v: this.v,
      r: this.r,
      s: this.s,
    }
    const rawTx = ethers.utils.serializeTransaction(txUnsigned, txSignature)
    const deployTx = ethers.utils.parseTransaction(rawTx)
    const deployerEOA = deployTx.from

    return { rawTx, signature: txSignature, deployerEOA }
  }

  private deployDeployer = async (
    defaultTxParams: providers.TransactionRequest = {},
  ): Promise<string> => {
    const deployerAddress = await this.determineAddress()
    let deployerCode = await this.provider.getCode(deployerAddress)

    if (deployerCode.length > 2) {
      this.logger?.log(`Deployer already deployed at ${deployerAddress}`)
      if (deployerAddress === UNIVERSALDEPLOYER2_ADDR) {
        this.logger?.log(
          `Using the Universal Deployer address at ${deployerAddress}`,
        )
      }
      return deployerAddress
    }

    // Generate the deployment transaction
    const { rawTx, deployerEOA } = await this.generateRawTxAndSignature()

    // Check deployer EOA balance
    const deployerEOABalance = await this.provider.getBalance(deployerEOA)
    const cost = this.eoaFundingOverride ?? DEPLOYMENT_COST
    if (deployerEOABalance.lt(cost)) {
      this.logger?.log(
        `Funding deployer EOA ${deployerEOA} from ${await this.signer.getAddress()} with ${utils.formatEther(
          cost,
        )} ETH to cover gas`,
      )
      const txFund = await this.signer.sendTransaction({
        to: deployerEOA,
        value: cost,
        ...defaultTxParams,
      })
      await txFund.wait()
    }

    // Broadcast the transaction
    const sent = await this.provider.sendTransaction(rawTx)
    const receipt = await sent.wait()
    if (receipt.status !== 1) {
      throw new Error(
        `Failed to deploy UniversalDeployer2 via forged transaction. Tx hash: ${sent.hash}`,
      )
    }

    // Check it was deployed
    deployerCode = await this.provider.getCode(deployerAddress)
    if (deployerCode.length < 2) {
      throw new Error(
        `Failed to deploy UniversalDeployer2 at ${deployerAddress} in ${sent.hash}`,
      )
    }
    this.logger?.log(
      `UniversalDeployer2 is now deployed at ${deployerAddress} in ${sent.hash}`,
    )
    return deployerAddress
  }

  private determineAddress = async (): Promise<string> => {
    const [singletonCode, universalCode] = await Promise.all([
      this.provider.getCode(SINGLETONFACTORY_ADDR),
      this.provider.getCode(UNIVERSALDEPLOYER2_ADDR),
    ])

    // If both are present, do nothing and use the universal deployer
    if (singletonCode.length > 2 && universalCode.length > 2) {
      this.logger?.log(
        'Singleton & Universal both deployed. Using Universal Deployer',
      )
      return UNIVERSALDEPLOYER2_ADDR
    }

    // Generate the deployment transaction
    const { deployerEOA } = await this.generateRawTxAndSignature()

    // Recover the addresses
    const deployerAddress = ethers.utils.getContractAddress({
      from: deployerEOA,
      nonce: 0,
    })
    return deployerAddress
  }

  public async addressOf<T extends ContractFactory>(
    contract: new (...args: [Signer]) => T,
    contractInstance: BigNumberish = 0,
    ...args: Parameters<T['deploy']>
  ): Promise<string> {
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

    const deployerAddress = await this.determineAddress()

    const hash = ethers.utils.keccak256(
      ethers.utils.solidityPack(
        ['bytes1', 'address', 'bytes32', 'bytes32'],
        ['0xff', deployerAddress, salt, codeHash],
      ),
    )

    return ethers.utils.getAddress(ethers.utils.hexDataSlice(hash, 12))
  }
}
