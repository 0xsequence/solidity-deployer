import { Network } from '@tenderly/sdk'
import { Wallet } from 'ethers'
import { ContractVerifier } from '../src/ContractVerifier'
import { COUNTER_BYTECODE, CounterFactory } from './utils/counter'
import {
  NAMED_COUNTER_ADDR_SEPOLIA,
  NAMED_COUNTER_COMPILER_INPUT,
} from './utils/namedCounter'

jest.mock('../src/verifiers/TenderlyVerifier', () => ({
  TenderlyVerifier: jest.fn().mockImplementation(() => ({
    verifyContract: jest.fn(),
  })),
}))

jest.mock('../src/verifiers/EtherscanVerifier', () => {
  const mockGetEtherscanApiFromChainId = jest.fn().mockImplementation(() => 'ABC')
  const MockEtherscanVerifier = jest.fn().mockImplementation(() => ({
    verifyContract: jest.fn(),
  })) as jest.Mock & { getEtherscanApiFromChainId: jest.Mock }
  MockEtherscanVerifier.getEtherscanApiFromChainId = mockGetEtherscanApiFromChainId
  return { EtherscanVerifier: MockEtherscanVerifier }
})

describe('ContractVerifier', () => {
  let verifier: ContractVerifier

  const namedContractAddr = NAMED_COUNTER_ADDR_SEPOLIA

  beforeAll(async () => {
    verifier = new ContractVerifier(
      {
        accessKey: 'TENDERLY_ACCESS_KEY',
        accountName: 'TENDERLY_ACCOUNT_NAME',
        projectName: 'TENDERLY_PROJECT_NAME',
        network: Network.SEPOLIA,
      },
      'ETHERSCAN_API_KEY',
      Wallet.createRandom(),
      console,
    )
  })

  it('validates bytecode', () => {
    verifier.validateBytecode(CounterFactory, COUNTER_BYTECODE) // Doesn't throw
  })

  it('throws invalid bytecode', () => {
    expect(() =>
      verifier.validateBytecode(CounterFactory, COUNTER_BYTECODE + 'ABC'),
    ).toThrow('Bytecode mismatch')
  })

  it('validates', async () => {
    const contractToVerify = 'contracts/NamedCounter.sol:NamedCounter'
    const { sources } = NAMED_COUNTER_COMPILER_INPUT
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const settings: any = {
      evmVersion: NAMED_COUNTER_COMPILER_INPUT.settings.evmVersion,
      viaIR: NAMED_COUNTER_COMPILER_INPUT.settings.viaIR,
      optimizer: {
        enabled: NAMED_COUNTER_COMPILER_INPUT.settings.optimizer.enabled,
        runs: NAMED_COUNTER_COMPILER_INPUT.settings.optimizer.runs,
      },
      remappings: NAMED_COUNTER_COMPILER_INPUT.settings.remappings,
    }

    await verifier.verifyContract(namedContractAddr, {
      contractToVerify,
      version: 'v0.8.18+commit.87f61d96',
      sources,
      settings,
      waitForSuccess: true,
    })
    ;(settings.outputSelection = {
      // Default output selection
      '*': {
        '*': [
          'abi',
          'evm.bytecode',
          'evm.deployedBytecode',
          'evm.methodIdentifiers',
          'metadata',
        ],
        '': ['ast'],
      },
    }),
      expect(verifier['tenderlyVerifier'].verifyContract).toBeCalledWith(
        namedContractAddr,
        contractToVerify,
        {
          contractToVerify,
          solc: {
            version: 'v0.8.18',
            sources,
            settings,
          },
          config: {
            mode: 'public',
          },
        },
      )
    expect(verifier['etherscanVerifier'].verifyContract).toBeCalledWith(
      namedContractAddr,
      {
        contractToVerify,
        version: 'v0.8.18+commit.87f61d96',
        compilerInput: {
          language: 'Solidity',
          sources,
          settings,
        },
        waitForSuccess: true,
      },
    )
  })
})
