import { BigNumberish, Contract, ContractFactory, Signer, providers } from "ethers"

export interface Deployer {
  deploy<T extends ContractFactory>(
    name: string,
    contract: new (...args: [signer: Signer]) => T,
    contractInstance?: BigNumberish,
    txParams?: providers.TransactionRequest,
    ...args: Parameters<T['deploy']>
  ): Promise<Contract>

  addressOf<T extends ContractFactory>(
    contract: new (...args: [signer: Signer]) => T,
    contractInstance?: BigNumberish,
    ...args: Parameters<T['deploy']>
  ): Promise<string>
}
