import { JsonRpcProvider } from '@ethersproject/providers'
import { config as dotenvConfig } from 'dotenv'
import { Wallet } from 'ethers'
import { DeploymentFlow } from '../src/DeploymentFlow'
import { WalletFactoryContract } from '../src/contracts/factories/WalletFactory'
import { SequenceContext } from './utils/sequence'
import { SequenceWallet } from './utils/wallet'

dotenvConfig()

describe('DeploymentFlow', () => {
  let flow: DeploymentFlow
  let wallet: Wallet
  let context: SequenceContext

  beforeAll(async () => {
    const { SEPOLIA_PRIVATE_KEY, SEPOLIA_RPC_URL } = process.env
    if (SEPOLIA_PRIVATE_KEY !== undefined && SEPOLIA_RPC_URL !== undefined) {
      console.log('Sepolia configuration found, using real API for tests')
      const provider = new JsonRpcProvider(SEPOLIA_RPC_URL)
      wallet = new Wallet(SEPOLIA_PRIVATE_KEY, provider)
    } else {
      console.log('Sepolia configuration not found, using stubs')
      wallet = Wallet.createRandom()
    }

    flow = new DeploymentFlow(
      {
        accessKey: 'ABC',
        accountName: 'DEF',
        projectName: 'GHI',
        network: 11155111,
      },
      'JKL',
      wallet,
      'sepolia',
      console,
    )

    context = {
      factory: new WalletFactoryContract(wallet).attach(
        await flow.deployer.addressOf(WalletFactoryContract),
      ),
      mainModule: {
        address: '0x8cFC0B30d59E4153Ab369068887C3eeEDB4472D0',
      },
    }
  })

  it('deploys guards', async () => {
    const swKnown = SequenceWallet.detailedWallet(context, {
      threshold: 1,
      signers: [wallet.address],
    })
    const swRandom = SequenceWallet.basicWallet(context)
    const guardHashs = [swKnown.imageHash, swRandom.imageHash]
    const actual = await flow.deployGuards(context.mainModule.address, guardHashs)

    // Confirm expected addresses
    expect(actual[0]).toBe(swKnown.address)
    expect(actual[1]).toBe(swRandom.address)
  }, 120000) // Increase the timeout to 120 seconds
})
