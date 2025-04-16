import { JsonRpcProvider } from '@ethersproject/providers'
import { config as dotenvConfig } from 'dotenv'
import { Wallet } from 'ethers'
import { TestDeployer } from '../../src/deployers/TestDeployer'
import { CounterFactory } from '../utils/counter'

dotenvConfig()

describe('TestDeployer', () => {
  let provider: JsonRpcProvider
  let deployer: TestDeployer

  beforeEach(async () => {
    const { SEPOLIA_PRIVATE_KEY, SEPOLIA_RPC_URL } = process.env
    if (SEPOLIA_PRIVATE_KEY === undefined || SEPOLIA_RPC_URL === undefined) {
      console.log('Sepolia configuration not found, skipping tests')
      return
    }
    console.log('Sepolia configuration found, using real API for tests')
    provider = new JsonRpcProvider(SEPOLIA_RPC_URL)
    const wallet = new Wallet(SEPOLIA_PRIVATE_KEY, provider)
    deployer = new TestDeployer(wallet, console)
  }, 120000)

  afterEach(async () => {
    jest.restoreAllMocks()
  })

  it('deploys successfully', async () => {
    // Note: As this is a universal deployment, repeated deployments will not deploy the contract each time
    const counter = await deployer.deploy('Counter', CounterFactory)
    expect(counter.address).toBeDefined()
    expect(counter.address).toBe(await deployer.addressOf(CounterFactory))

    // Check the counter is deployed
    const code = await provider.getCode(counter.address)
    expect(code.length).toBeGreaterThan(2)
  }, 120000) // Increase the timeout to 120 seconds
})
