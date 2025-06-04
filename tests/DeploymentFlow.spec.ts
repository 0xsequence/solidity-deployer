import { JsonRpcProvider } from '@ethersproject/providers'
import { config as dotenvConfig } from 'dotenv'
import { Wallet } from 'ethers'
import { DeploymentFlow } from '../src/DeploymentFlow'
import { WalletFactoryContract } from '../src/contracts/factories/WalletFactory'
import { SequenceWallet } from './utils/wallet'

dotenvConfig()
const { SEPOLIA_PRIVATE_KEY, SEPOLIA_RPC_URL } = process.env
const useStubs =
  SEPOLIA_PRIVATE_KEY === undefined || SEPOLIA_RPC_URL === undefined

jest.mock('../src/ContractVerifier', () => ({
  ContractVerifier: jest.fn().mockImplementation(() => ({
    validateBytecode: jest.fn(),
    verifyContract: jest.fn(),
  })),
}))

//FIXME Only mock the following if Sepolia configuration is not found
jest.mock('../src/deployers/UniversalDeployer', () => ({
  UniversalDeployer: jest.fn().mockImplementation(() => ({
    addressOf: jest.fn(),
    deploy: jest.fn().mockReturnValue(
      Promise.resolve({
        address: '0xf9D09D634Fb818b05149329C1dcCFAeA53639d96',
        deploy: jest.fn().mockReturnValue(
          Promise.resolve({
            wait: jest.fn(),
          }),
        ),
      }),
    ),
  })),
}))

describe('DeploymentFlow', () => {
  let flow: DeploymentFlow
  let guardHashs: string[]
  let guardAddrs: string[]

  beforeAll(async () => {
    let wallet: Wallet
    if (useStubs) {
      console.log('Sepolia configuration not found, using stubs')
      wallet = {
        _isSigner: true,
        provider: {
          getCode: jest.fn().mockReturnValue('0x'),
        },
      } as unknown as Wallet
    } else {
      console.log('Sepolia configuration found, using real API for tests')
      const provider = new JsonRpcProvider(SEPOLIA_RPC_URL)
      wallet = new Wallet(SEPOLIA_PRIVATE_KEY, provider)
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
      console,
    )

    // Set up guard txs
    if (useStubs) {
      guardHashs = [
        '0x8c77b22c8604904a42127c62dc125f7041adb2d3a157a514adc05d929450b568',
        '0x4793b526ad5d84165a65e455dc3edef76be8f6aac2e9a93aafc34ec6282aeaf6',
      ]
      guardAddrs = [
        '0xfF0b351f830b0aCd4DF9df9eabCc1E3dF5B9cF5d',
        '0xA8886d627F7f0B65932e51F83C824a3cCb4e5220',
      ]
    } else {
      const context = {
        factory: new WalletFactoryContract(wallet).attach(
          await flow.deployer.addressOf(WalletFactoryContract),
        ),
        mainModule: {
          address: '0x8cFC0B30d59E4153Ab369068887C3eeEDB4472D0',
        },
      }
      const swKnown = SequenceWallet.detailedWallet(context, {
        threshold: 1,
        signers: [wallet.address],
      })
      const swRandom = SequenceWallet.basicWallet(context)
      guardHashs = [swKnown.imageHash, swRandom.imageHash]
      guardAddrs = [swKnown.address, swRandom.address]
    }
  })

  it('deploys guards', async () => {
    const actual = await flow.deployGuards(
      '0x8cFC0B30d59E4153Ab369068887C3eeEDB4472D0',
      guardHashs,
    )

    // Confirm expected addresses
    for (let i = 0; i < guardAddrs.length; i++) {
      expect(actual[i]).toBe(guardAddrs[i])
    }
  }, 120000) // Increase the timeout to allow for guard deployments
})
