import type { Signer } from 'ethers'
import { ContractFactory } from 'ethers'
import { COUNTER_SOURCE } from './counter'
import type { CompilerInput } from 'solc'

export const NAMED_COUNTER_ADDR_SEPOLIA =
  '0x2cA5078d114D1A5FC77dA7b0d103F9023396514b'

export const NAMED_COUNTER_BYTECODE =
  '0x6080806040523461001657610771908161001c8239f35b600080fdfe608060409080825260048036101561001657600080fd5b600091823560e01c90816306661abd146106405750806306fdde03146104d4578063371303c0146104265780636d4ce63c146103eb578063b3bcfa82146102f25763c47f00271461006657600080fd5b346102ee57602090817ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffc3601126102ea57803567ffffffffffffffff918282116102e657366023830112156102e65781810135958387116102ba5751957fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0926100f68685601f85011601896106cb565b81885236602483830101116102b6578187926024889301838b013788010152855192831161028a575060019261012c8454610678565b601f8111610226575b508091601f841160011461018e575050839482939492610183575b50507fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff82841b9260031b1c191617905580f35b015190503880610150565b8486528316957fb10e2d527612073b26eecdfd717e6a320cf44b4afac2b0732d9fcbe2b7fa0cf6929186905b88821061020f57505083859697106101d8575b505050811b01905580f35b01517fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff60f88460031b161c191690553880806101cd565b8087859682949686015181550195019301906101ba565b8486527fb10e2d527612073b26eecdfd717e6a320cf44b4afac2b0732d9fcbe2b7fa0cf6601f850160051c810191838610610280575b601f0160051c019085905b828110610275575050610135565b878155018590610267565b909150819061025c565b8460416024927f4e487b7100000000000000000000000000000000000000000000000000000000835252fd5b8680fd5b6024866041847f4e487b7100000000000000000000000000000000000000000000000000000000835252fd5b8480fd5b8280fd5b5080fd5b5082346102ea57827ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffc3601126102ea578254907fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff8201928284116103bf57507fc5802a3758d71d4ea2b77079fad7b332621c089586b2fd70ec9b7e75761a8def91838260c093519260808452600960808501527f44656372656d656e74000000000000000000000000000000000000000000000060a08501526020840152820152336060820152a1815580f35b8460116024927f4e487b7100000000000000000000000000000000000000000000000000000000835252fd5b8284346102ee57817ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffc3601126102ee57602091549051908152f35b5082346102ea57827ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffc3601126102ea5782549060018201928383116103bf57507fc5802a3758d71d4ea2b77079fad7b332621c089586b2fd70ec9b7e75761a8def91838260c093519260808452600960808501527f496e6372656d656e74000000000000000000000000000000000000000000000060a08501526020840152820152336060820152a1815580f35b8284346102ee57817ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffc3601126102ee578051828160019182549261051784610678565b8084529381811690811561060057506001146105a4575b5061053e925094929403846106cb565b815192839160208084528251928382860152825b84811061058e57505050828201840152601f017fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0168101030190f35b8181018301518882018801528795508201610552565b8087528691507fb10e2d527612073b26eecdfd717e6a320cf44b4afac2b0732d9fcbe2b7fa0cf65b8483106105e5575061053e93505081016020018661052e565b819350908160209254838589010152019101909184926105cc565b6020935061053e9592507fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff0091501682840152151560051b8201018661052e565b8390346102ee57817ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffc3601126102ee57602091548152f35b90600182811c921680156106c1575b602083101461069257565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052602260045260246000fd5b91607f1691610687565b90601f7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0910116810190811067ffffffffffffffff82111761070c57604052565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fdfea2646970667358221220609ffbae3f1b7dfcba5ee79643010322e96118a06f1d3c173c7fe1573e5d90e064736f6c63430008120033'

export const NAMED_COUNTER_SOURCE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {CounterWithLogs} from "remap-me/Counter/Counter.sol";

contract NamedCounter is CounterWithLogs {
  string public name;

  function setName(string memory _name) public {
    name = _name;
  }
}
`

export const NAMED_COUNTER_ABI = [
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
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
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
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
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
  {
    inputs: [],
    name: 'name',
    outputs: [
      {
        internalType: 'string',
        name: '',
        type: 'string',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'string',
        name: '_name',
        type: 'string',
      },
    ],
    name: 'setName',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
]

// Using verification request here to test remappings
export const NAMED_COUNTER_COMPILER_INPUT: CompilerInput = {
  language: 'Solidity',
  sources: {
    'contracts/NamedCounter.sol': {
      content: NAMED_COUNTER_SOURCE,
    },
    'remapped/Counter/Counter.sol': {
      content: COUNTER_SOURCE,
    },
  },
  settings: {
    viaIR: true,
    optimizer: {
      enabled: true,
      runs: 20000,
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
    remappings: ['remap-me/Counter/=remapped/Counter/'],
  },
}

export class NamedCounterFactory extends ContractFactory {
  constructor(signer?: Signer) {
    super(NAMED_COUNTER_ABI, NAMED_COUNTER_BYTECODE, signer)
  }
}
