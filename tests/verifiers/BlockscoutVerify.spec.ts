import { JsonRpcProvider } from '@ethersproject/providers'
import axios from 'axios'
import { config as dotenvConfig } from 'dotenv'
import { ContractFactory, Wallet } from 'ethers'
import solc from 'solc'
import type { BlockscoutVerificationRequest } from '../../src/verifiers'
import { BlockscoutVerifier } from '../../src/verifiers'
import {
  COUNTER_ADDR_SEPOLIA,
  COUNTER_COMPILER_INPUT,
  COUNTER_LICENCE,
} from '../utils/counter'

dotenvConfig()

const solcSnapshot = solc.setupMethods(
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('../solc/soljson-v0.8.18+commit.87f61d96'),
)

describe('BlockscoutVerifier', () => {
  let blockscoutVerifier: BlockscoutVerifier
  let axiosPostStub: jest.SpyInstance
  let contractAddr = COUNTER_ADDR_SEPOLIA

  beforeAll(async () => {
    const { SEPOLIA_PRIVATE_KEY, SEPOLIA_RPC_URL, BLOCKSCOUT_URL } = process.env
    if (!SEPOLIA_PRIVATE_KEY || !SEPOLIA_RPC_URL) {
      // Stub fetch
      console.log('Required Sepolia env vars not found, using stubs')
      axiosPostStub = jest.spyOn(axios, 'postForm')
      axiosPostStub
        .mockResolvedValueOnce({
        data: { message: 'Smart-contract verification started' },
      })
      .mockResolvedValueOnce({
        data: { message: 'Already verified' },
      })
    } else {
      // Do it for real. Requires manual review on Blockscout
      console.log('Sepolia env vars found, using real API for tests')
    }

    blockscoutVerifier = new BlockscoutVerifier(
      BLOCKSCOUT_URL ?? 'https://eth-sepolia.blockscout.com',
      console,
    )
  })

  afterEach(async () => {
    jest.restoreAllMocks()
  })

  it('verifies blockscout source', async () => {
    const request: BlockscoutVerificationRequest = {
      contractToVerify: 'contracts/Counter.sol:CounterWithLogs',
      version: `v${solcSnapshot.version().replace('.Emscripten.clang', '')}`,
      compilerInput: COUNTER_COMPILER_INPUT,
      licenceType: COUNTER_LICENCE,
      waitForSuccess: true,
    }

    const { SEPOLIA_PRIVATE_KEY, SEPOLIA_RPC_URL } = process.env
    if (SEPOLIA_PRIVATE_KEY !== undefined && SEPOLIA_RPC_URL !== undefined) {
      // Blockscout will automatically verify the contract if it's already deployed with the same settings
      // So we randomise the number of runs. That'll work most of the time
      const randomRuns = Math.floor(Math.random() * 10000)
      console.log(`Randomising runs to ${randomRuns}`)
      request.compilerInput.settings.optimizer.runs = randomRuns

      // Create the factory from scratch
      const compilerOutput = JSON.parse(
        solcSnapshot.compile(JSON.stringify(request.compilerInput)),
      )
      const contractOutput =
        compilerOutput.contracts['contracts/Counter.sol'].CounterWithLogs

      // Deploy something new so we can verify it
      const provider = new JsonRpcProvider(SEPOLIA_RPC_URL)
      const wallet = new Wallet(SEPOLIA_PRIVATE_KEY, provider)
      const factory = new ContractFactory(
        contractOutput.abi,
        contractOutput.evm.bytecode,
        wallet,
      )
      const deployed = await factory.deploy()
      contractAddr = deployed.address
      console.log(`Deployed new contract at ${contractAddr}`)

      // Pause for Blockscout to index contract
      console.log('Waiting a bit so Blockscout can index contract')
      await new Promise(resolve => setTimeout(resolve, 30000)) // Delay 30s (sometimes it needs longer...)
    }

    await blockscoutVerifier.verifyContract(contractAddr, request)

    if (axiosPostStub) {
      expect(axiosPostStub).toHaveBeenCalledTimes(2) // Once pending, once complete
    }
  }, 120000) // Increase the timeout to 120 seconds
})
