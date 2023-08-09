import type { Block } from '@ethersproject/providers'
import { JsonRpcProvider } from '@ethersproject/providers'
import { config as dotenvConfig } from 'dotenv'
import { BigNumber, Wallet } from 'ethers'
import { SingletonFactoryContract } from '../../src/contracts/SingletonFactory'
import { SingletonDeployer } from '../../src/deployers/SingletonDeployer'
import { CounterFactory } from '../utils/counter'

dotenvConfig()

describe('SingletonDeployer', () => {
  let deployer: SingletonDeployer
  let stubbed = false
  let deployStub: jest.SpyInstance

  beforeEach(async () => {
    const { SEPOLIA_PRIVATE_KEY, SEPOLIA_RPC_URL } = process.env
    if (SEPOLIA_PRIVATE_KEY === undefined || SEPOLIA_RPC_URL === undefined) {
      console.log('Sepolia configuration not found, using stubs')
      stubbed = true
      // Stub provider
      const provider = new JsonRpcProvider()
      jest
        .spyOn(provider, 'detectNetwork')
        .mockReturnValue(
          Promise.resolve({ name: 'unknown', chainId: 11155111 }),
        )
      jest
        .spyOn(provider, 'getBlock')
        .mockResolvedValue({ gasLimit: BigNumber.from(5) } as Block)
      const codeStub = jest.spyOn(provider, 'getCode')
      codeStub
        .mockResolvedValueOnce('0x') // Contract before deploy
        .mockResolvedValueOnce('0x123') // Universal Deployer
        .mockResolvedValueOnce('0x123') // Contract after deploy
      const wallet = Wallet.createRandom().connect(provider)

      // Stub singleton factory
      class MockSingletonFactoryContract extends SingletonFactoryContract {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        deploy(...args: Array<any>) {
          return super.deploy(...args)
        }
      }
      const singletonFactory = new MockSingletonFactoryContract(wallet)
      deployStub = jest
        .spyOn(singletonFactory, 'deploy')
        .mockResolvedValue({ wait: jest.fn() })

      deployer = new SingletonDeployer(wallet, console, singletonFactory)
    } else {
      console.log('Sepolia configuration found, using real API for tests')
      const provider = new JsonRpcProvider(SEPOLIA_RPC_URL)
      const wallet = new Wallet(SEPOLIA_PRIVATE_KEY, provider)
      deployer = new SingletonDeployer(wallet)
    }
  })

  afterEach(async () => {
    jest.restoreAllMocks()
  })

  it('deploys successfully', async () => {
    // Note: As this is a singleton deployment, repeated deployments will not deploy the contract each time
    await deployer.deploy('Counter', CounterFactory)

    // Check
    if (stubbed) {
      expect(deployStub).toHaveBeenCalledTimes(1)
    }
  }, 120000) // Increase the timeout to 120 seconds
})
