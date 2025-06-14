import { JsonRpcProvider } from '@ethersproject/providers'
import axios from 'axios'
import { config as dotenvConfig } from 'dotenv'
import { ContractFactory, Wallet } from 'ethers'
import solc from 'solc'
import type { EtherscanVerificationRequest } from '../../src/verifiers'
import { EtherscanVerifier } from '../../src/verifiers'
import { COUNTER_ADDR_SEPOLIA, COUNTER_COMPILER_INPUT } from '../utils/counter'

dotenvConfig()

const solcSnapshot = solc.setupMethods(
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('../solc/soljson-v0.8.18+commit.87f61d96'),
)

describe('EtherscanVerifier', () => {
  let etherscanVerifier: EtherscanVerifier
  let axiosPostStub: jest.SpyInstance
  let axiosGetStub: jest.SpyInstance
  let contractAddr = COUNTER_ADDR_SEPOLIA

  beforeAll(async () => {
    const { SEPOLIA_PRIVATE_KEY, SEPOLIA_RPC_URL, ETHERSCAN_API_KEY } =
      process.env
    if (
      SEPOLIA_PRIVATE_KEY === undefined ||
      SEPOLIA_RPC_URL === undefined ||
      ETHERSCAN_API_KEY === undefined
    ) {
      // Stub fetch
      console.log('Required Sepolia env vars not found, using stubs')
      axiosPostStub = jest.spyOn(axios, 'post')
      axiosPostStub
        .mockResolvedValueOnce({
          data: { status: '0', result: 'Not verified' },
        })
        .mockResolvedValueOnce({ data: { status: '1', result: 'Verified' } })
      axiosGetStub = jest.spyOn(axios, 'get').mockResolvedValue({
        data: { status: '1', result: 'Passed verification' },
      })
    } else {
      // Do it for real. Requires manual review on Etherscan
      console.log('Sepolia env vars found, using real API for tests')
    }

    etherscanVerifier = new EtherscanVerifier(
      ETHERSCAN_API_KEY ?? 'ABC',
      EtherscanVerifier.getEtherscanApiFromChainId(11155111), // Sepolia
    )
  })

  afterEach(async () => {
    jest.restoreAllMocks()
  })

  it('verifies etherscan source', async () => {
    const request: EtherscanVerificationRequest = {
      contractToVerify: 'contracts/Counter.sol:CounterWithLogs',
      version: `v${solcSnapshot.version().replace('.Emscripten.clang', '')}`,
      compilerInput: COUNTER_COMPILER_INPUT,
      waitForSuccess: true,
    }

    const { SEPOLIA_PRIVATE_KEY, SEPOLIA_RPC_URL, ETHERSCAN_API_KEY } =
      process.env
    if (
      SEPOLIA_PRIVATE_KEY !== undefined &&
      SEPOLIA_RPC_URL !== undefined &&
      ETHERSCAN_API_KEY !== undefined
    ) {
      // Etherscan will automatically verify the contract if it's already deployed with the same settings
      // So we randomise the number of runs. That'll work most of the time
      request.compilerInput.settings.optimizer.runs = Math.floor(
        Math.random() * 10000,
      )

      // Create the factory from scratch
      const compilerOutput = JSON.parse(
        solcSnapshot.compile(JSON.stringify(request.compilerInput)),
      )
      const contractOutput =
        compilerOutput.contracts['contracts/Counter.sol']['CounterWithLogs']

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
      console.log(contractAddr)

      // Pause for Etherscan to index contract
      console.log('Waiting a bit so Etherscan can index contract')
      await new Promise(resolve => setTimeout(resolve, 60000)) // Delay 60s (sometimes it needs longer...)
    }

    await etherscanVerifier.verifyContract(contractAddr, request)

    if (axiosPostStub) {
      expect(axiosPostStub).toHaveBeenCalledTimes(2) // Once before, once after
    }
    if (axiosGetStub) {
      // With real API, this could be called multiple times
      expect(axiosGetStub).toHaveBeenCalledTimes(1)
    }
  }, 120000) // Increase the timeout to 120 seconds
})
