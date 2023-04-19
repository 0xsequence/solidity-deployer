import axios from 'axios'
import { config as dotenvConfig } from 'dotenv'
import {
  EtherscanVerificationRequest,
  EtherscanVerifier,
} from '../../src/verifiers/EtherscanVerifier'
import { COUNTER_ADDR_SEPOLIA, COUNTER_SOURCE } from '../utils/constants'

dotenvConfig()

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
      axiosPostStub = jest
        .spyOn(axios, 'post')
        .mockResolvedValue({ data: { status: '1', result: 'Verified' } })
      axiosGetStub = jest
        .spyOn(axios, 'get')
        .mockResolvedValue({
          data: { status: '1', result: 'Passed verification' },
        })
    } else {
      // Do it for real. Requires manual review on Etherscan
      console.log('Sepolia env vars found, using real API for tests')
    }

    etherscanVerifier = new EtherscanVerifier(
      ETHERSCAN_API_KEY ?? 'ABC',
      'sepolia',
    )
  })

  afterEach(async () => {
    jest.restoreAllMocks()
  })

  it('verifies etherscan source', async () => {
    const request: EtherscanVerificationRequest = {
      contractToVerify: 'contracts/Counter.sol:CounterWithLogs',
      version: 'v0.8.18+commit.87f61d96',
      compilerInput: {
        language: 'Solidity',
        sources: {
          'contracts/Counter.sol': {
            content: COUNTER_SOURCE,
          },
        },
        settings: {
          optimizer: {
            enabled: false,
            runs: 200,
          },
          outputSelection: {
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
          },
          libraries: {},
          remappings: [],
        },
      },
      waitForSuccess: true,
    }

    const { SEPOLIA_PRIVATE_KEY, SEPOLIA_RPC_URL, ETHERSCAN_API_KEY } =
      process.env
    if (
      SEPOLIA_PRIVATE_KEY !== undefined &&
      SEPOLIA_RPC_URL !== undefined &&
      ETHERSCAN_API_KEY !== undefined
    ) {
      //FIXME Once deployer is added
      // Deploy something new so we can verify it
      // const provider = new JsonRpcProvider(SEPOLIA_RPC_URL)
      // const wallet = new Wallet(SEPOLIA_PRIVATE_KEY, provider)
      // const factory = new UniversalDeployer2__factory(wallet)
      // const deployed = await factory.deploy()
      // contractAddr = deployed.address
      console.log(contractAddr)

      // Pause for Etherscan to index contract
      console.log('Waiting a bit so Etherscan can index contract')
      await new Promise(resolve => setTimeout(resolve, 20000)) // Delay 20s (sometimes it needs longer...)
    }

    await etherscanVerifier.verifyContract(contractAddr, request)

    if (axiosPostStub) {
      expect(axiosPostStub).toHaveBeenCalledTimes(1)
    }
    if (axiosGetStub) {
      // With real API, this could be called multiple times
      expect(axiosGetStub).toHaveBeenCalledTimes(1)
    }
  }, 30000) // Increase the timeout to 30 seconds
})
