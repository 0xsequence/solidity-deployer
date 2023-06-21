import { Network, Tenderly } from '@tenderly/sdk'
import { config as dotenvConfig } from 'dotenv'
import { Wallet } from 'ethers'
import { writeFile } from 'fs/promises'
import solc from 'solc'
import { ContractVerifier } from '../src/ContractVerifier'
import { JsonRpcProvider } from '@ethersproject/providers'
import {
  // COUNTER_BYTECODE,
  // COUNTER_COMPILER_INPUT,
  CounterFactory,
} from './utils/counter'
import {
  NAMED_COUNTER_ADDR_SEPOLIA,
  NAMED_COUNTER_BYTECODE,
  NAMED_COUNTER_COMPILER_INPUT,
  NamedCounterFactory,
} from './utils/namedCounter'

dotenvConfig()
const {
  TENDERLY_ACCESS_KEY,
  TENDERLY_ACCOUNT_NAME,
  TENDERLY_PROJECT_NAME,
  ETHERSCAN_API_KEY,
  SEPOLIA_RPC_URL,
  SEPOLIA_PRIVATE_KEY,
} = process.env

const solcSnapshot = solc.setupMethods(
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('./solc/soljson-v0.8.18+commit.87f61d96'),
)

describe('ContractVerifier', () => {
  let verifier: ContractVerifier
  let wallet: Wallet

  let counterBytecode: string
  let namedContractAddr = NAMED_COUNTER_ADDR_SEPOLIA

  beforeAll(async () => {
    if (SEPOLIA_RPC_URL !== undefined && SEPOLIA_PRIVATE_KEY !== undefined) {
      const provider = new JsonRpcProvider(SEPOLIA_RPC_URL)
      wallet = new Wallet(SEPOLIA_PRIVATE_KEY, provider)

      // Compile and deploy NamedCounter
      await writeFile(
        'compilerInput.json',
        JSON.stringify(NAMED_COUNTER_COMPILER_INPUT, null, 2),
      )
      const namedOutput = JSON.parse(
        solcSnapshot.compile(JSON.stringify(NAMED_COUNTER_COMPILER_INPUT)),
      )
      await writeFile('output.json', JSON.stringify(namedOutput, null, 2))
      const { evm } =
        namedOutput.contracts['contracts/NamedCounter.sol']['NamedCounter']
      counterBytecode = '0x' + evm.bytecode.object
      expect(counterBytecode).toEqual(NAMED_COUNTER_BYTECODE)

      //FIXME Need to add a delay after deployment to allow verifiers to pick up the contract
      // Deploy it so we can verify it
      const factory = new NamedCounterFactory(wallet)
      const deployed = await factory.deploy()
      namedContractAddr = deployed.address
      console.log(namedContractAddr)
    } else {
      wallet = Wallet.createRandom()
    }

    let tenderly: Tenderly

    if (
      TENDERLY_ACCESS_KEY === undefined ||
      TENDERLY_ACCOUNT_NAME === undefined ||
      TENDERLY_PROJECT_NAME === undefined
    ) {
      console.log('Tenderly configuration not found, using stubs')
      // Stub tenderly
      tenderly = new Tenderly({
        accessKey: 'ABC',
        accountName: 'DEF',
        projectName: 'GHI',
        network: Network.SEPOLIA,
      })
      jest.spyOn(tenderly.contracts, 'add').mockImplementation()
      jest.spyOn(tenderly.contracts, 'verify').mockImplementation()
    } else {
      // Do it for real. Requires manual review on Tenderly
      console.log('Tenderly configuration found, using real API for tests')
      tenderly = new Tenderly({
        accessKey: process.env.TENDERLY_ACCESS_KEY,
        accountName: process.env.TENDERLY_ACCOUNT_NAME,
        projectName: process.env.TENDERLY_PROJECT_NAME,
        network: Network.SEPOLIA,
      })
    }
    verifier = new ContractVerifier(
      tenderly,
      ETHERSCAN_API_KEY ?? 'ABC',
      wallet,
      'sepolia',
      console,
    )

    // Compile the Counter source code for local validation
    // const output = JSON.parse(
    //   solcSnapshot.compile(JSON.stringify(COUNTER_COMPILER_INPUT)),
    // )
    // const { evm } = output.contracts['contracts/Counter.sol']['CounterWithLogs']
    // counterBytecode = '0x' + evm.bytecode.object
    // expect(counterBytecode).toEqual(COUNTER_BYTECODE)
  }, 120000)

  it('validates bytecode', () => {
    verifier.validateBytecode(CounterFactory, counterBytecode) // Doesn't throw
  })

  it('throws invalid bytecode', () => {
    expect(() =>
      verifier.validateBytecode(CounterFactory, counterBytecode + 'ABC'),
    ).toThrow('Bytecode mismatch')
  })

  it.only('validates with remappings', async () => {
    await verifier.verifyContract(namedContractAddr, {
      contractToVerify: 'contracts/NamedCounter.sol:NamedCounter',
      version: 'v0.8.18+commit.87f61d96',
      sources: NAMED_COUNTER_COMPILER_INPUT.sources,
      settings: {
        evmVersion: NAMED_COUNTER_COMPILER_INPUT.settings.evmVersion,
        viaIR: NAMED_COUNTER_COMPILER_INPUT.settings.viaIR,
        optimizer: {
          enabled: NAMED_COUNTER_COMPILER_INPUT.settings.optimizer.enabled,
          runs: NAMED_COUNTER_COMPILER_INPUT.settings.optimizer.runs,
        },
        remappings: NAMED_COUNTER_COMPILER_INPUT.settings.remappings,
      },
      waitForSuccess: true,
    })
  }, 120000)
})
