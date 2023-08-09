import { JsonRpcProvider } from '@ethersproject/providers'
import type { VerificationRequest } from '@tenderly/sdk'
import { Network, Tenderly } from '@tenderly/sdk'
import { config as dotenvConfig } from 'dotenv'
import { Wallet } from 'ethers'
import solc from 'solc'
import { TenderlyVerifier } from '../../src/verifiers'
import {
  NAMED_COUNTER_BYTECODE,
  NAMED_COUNTER_COMPILER_INPUT,
  NamedCounterFactory,
} from '../utils/namedCounter'

dotenvConfig()
const {
  TENDERLY_ACCESS_KEY,
  TENDERLY_ACCOUNT_NAME,
  TENDERLY_PROJECT_NAME,
  SEPOLIA_RPC_URL,
  SEPOLIA_PRIVATE_KEY,
} = process.env

const solcSnapshot = solc.setupMethods(
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('../solc/soljson-v0.8.18+commit.87f61d96'),
)

const describeOrSkip =
  TENDERLY_ACCESS_KEY === undefined ||
  TENDERLY_ACCOUNT_NAME === undefined ||
  TENDERLY_PROJECT_NAME === undefined
    ? describe.skip
    : describe

describeOrSkip('TenderlyVerifier', () => {
  let verifier: TenderlyVerifier

  let addStub: jest.SpyInstance
  let verifyStub: jest.SpyInstance

  let namedContractAddr = '0x0922984956b565DD0945d9B8FaD54995a33eF56C'

  beforeAll(async () => {
    if (SEPOLIA_RPC_URL !== undefined && SEPOLIA_PRIVATE_KEY !== undefined) {
      // Build from source
      const namedOutput = JSON.parse(
        solcSnapshot.compile(JSON.stringify(NAMED_COUNTER_COMPILER_INPUT)),
      )
      const { evm } =
        namedOutput.contracts['contracts/NamedCounter.sol']['NamedCounter']
      const counterBytecode = '0x' + evm.bytecode.object
      expect(counterBytecode).toEqual(NAMED_COUNTER_BYTECODE)

      //FIXME Need to add a delay after deployment to allow verifiers to pick up the contract
      // Deploy it
      const provider = new JsonRpcProvider(SEPOLIA_RPC_URL)
      const wallet = new Wallet(SEPOLIA_PRIVATE_KEY, provider)
      const factory = new NamedCounterFactory(wallet)
      const deployed = await factory.deploy()
      namedContractAddr = deployed.address
      console.log('NamedCounter deployed at', namedContractAddr)
    }

    // Do it for real. Requires manual review on Tenderly
    console.log('Tenderly configuration found, using real API for tests')
    const tenderly = new Tenderly({
      accessKey: TENDERLY_ACCESS_KEY,
      accountName: TENDERLY_ACCOUNT_NAME,
      projectName: TENDERLY_PROJECT_NAME,
      network: Network.SEPOLIA,
    })
    verifier = new TenderlyVerifier(tenderly)
  }, 120000)

  describe('Tenderly Verification', () => {
    afterEach(async () => {
      jest.restoreAllMocks()
    })

    it('verifies Tenderly source', async () => {
      const request: VerificationRequest = {
        config: {
          mode: 'public',
        },
        contractToVerify: 'contracts/NamedCounter.sol:NamedCounter',
        solc: {
          version: 'v0.8.18',
          sources: NAMED_COUNTER_COMPILER_INPUT.sources,
          settings: {
            viaIR: NAMED_COUNTER_COMPILER_INPUT.settings.viaIR,
            optimizer: {
              enabled: NAMED_COUNTER_COMPILER_INPUT.settings.optimizer.enabled,
              runs: NAMED_COUNTER_COMPILER_INPUT.settings.optimizer.runs,
            },
            remappings: NAMED_COUNTER_COMPILER_INPUT.settings.remappings,
          },
        },
      }

      await verifier.verifyContract(
        namedContractAddr,
        'NamedCounter.sol',
        request,
      )

      // Check
      if (addStub) {
        expect(addStub).toHaveBeenCalledTimes(1)
      }
      if (verifyStub) {
        expect(verifyStub).toHaveBeenCalledTimes(1)
      }
    }, 30000)
  })
})
