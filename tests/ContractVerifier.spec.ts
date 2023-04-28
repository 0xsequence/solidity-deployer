import solc from 'solc';

import { Wallet } from 'ethers'
import { ContractVerifier } from '../src/ContractVerifier'
import { COUNTER_BYTECODE, COUNTER_COMPILER_INPUT, CounterFactory } from './utils/counter'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const solcSnapshot = solc.setupMethods(require('./solc/soljson-v0.8.18+commit.87f61d96'))

describe('ContractVerifier', () => {
  let verifier: ContractVerifier
  let wallet: Wallet

  let counterBytecode: string

  beforeAll(async () => {
    wallet = Wallet.createRandom()

    verifier = new ContractVerifier(
      {
        accessKey: 'ABC',
        accountName: 'DEF',
        projectName: 'GHI',
        network: 11155111,
      },
      'JKL',
      wallet,
    )

    // Compile the Counter source code
    const output = JSON.parse(solcSnapshot.compile(JSON.stringify(COUNTER_COMPILER_INPUT)))
    const { evm } = output.contracts['contracts/Counter.sol']['CounterWithLogs']
    counterBytecode = '0x' + evm.bytecode.object
    expect(counterBytecode).toEqual(COUNTER_BYTECODE)
  })

  it('validates bytecode', () => {
    verifier.validateBytecode(CounterFactory, counterBytecode) // Doesn't throw
  })

  it('throws invalid bytecode', () => {
    expect(() =>
      verifier.validateBytecode(CounterFactory, counterBytecode + 'ABC'),
    ).toThrow('Bytecode mismatch')
  })
})
