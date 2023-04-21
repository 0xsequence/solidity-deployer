import { ContractFactory, Signer } from 'ethers'
import type { CompilerInput } from 'solc'

export const COUNTER_ADDR_SEPOLIA = '0x3A15CBFa7EF9F817F11638156Af1b49e149c832a'

export const COUNTER_BYTECODE =
  '0x60808060405234610016576101c4908161001c8239f35b600080fdfe60806040818152600436101561001457600080fd5b600091823560e01c90816306661abd1461017457508063371303c0146100fb5780636d4ce63c146100df5763b3bcfa821461004e57600080fd5b346100db57816003193601126100db5781546000198101918183116100c7577fc5802a3758d71d4ea2b77079fad7b332621c089586b2fd70ec9b7e75761a8def91838260c0935192608084526009608085015268111958dc995b595b9d60ba1b60a08501526020840152820152336060820152a1815580f35b634e487b7160e01b84526011600452602484fd5b5080fd5b50346100db57816003193601126100db57602091549051908152f35b50346100db57816003193601126100db57815460018101918282116100c7577fc5802a3758d71d4ea2b77079fad7b332621c089586b2fd70ec9b7e75761a8def91838260c0935192608084526009608085015268125b98dc995b595b9d60ba1b60a08501526020840152820152336060820152a1815580f35b8390346100db57816003193601126100db57602091548152f3fea26469706673582212203e08e2b41ba8a13950dafce027ef2aab8c15793c5bd7a086ce16d17c06d39dc564736f6c63430008120033'

export const COUNTER_SOURCE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;
contract CounterWithLogs {
  uint public count;
  event CounterChanged(
    string method,
    uint256 oldNumber,
    uint256 newNumber,
    address caller
  );
  // Function to get the current count
  function get() public view returns (uint) {
    return count;
  }
  // Function to increment count by 1
  function inc() public {
    emit CounterChanged("Increment", count, count + 1, msg.sender);
    count += 1;
  }
  // Function to decrement count by 1
  function dec() public {
    emit CounterChanged("Decrement", count, count - 1, msg.sender);
    count -= 1;
  }
}
`

export const COUNTER_ABI = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: 'string',
        name: 'method',
        type: 'string',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'oldNumber',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'newNumber',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'address',
        name: 'caller',
        type: 'address',
      },
    ],
    name: 'CounterChanged',
    type: 'event',
  },
  {
    inputs: [],
    name: 'count',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'dec',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'get',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'inc',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
]

export const COUNTER_COMPILER_INPUT: CompilerInput = {
  language: 'Solidity',
  sources: {
    'contracts/Counter.sol': {
      content: COUNTER_SOURCE,
    },
  },
  settings: {
    evmVersion: 'paris',
    viaIR: true,
    optimizer: {
      enabled: true,
      runs: 200,
      details: {
        yul: true,
        // yulDetails: {
          // optimizerSteps: 'dhfoD[xarrscLMcCTU]uljmul:fDnTOc',
        // },
      },
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
}

export class CounterFactory extends ContractFactory {
  constructor(signer?: Signer) {
    super(COUNTER_ABI, COUNTER_BYTECODE, signer)
  }
}
