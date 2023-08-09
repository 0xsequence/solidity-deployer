import type { Signer } from 'ethers'
import { Contract } from 'ethers'

// https://eips.ethereum.org/EIPS/eip-2470

export const SINGLETONFACTORY_ADDR =
  '0xce0042B868300000d44A59004Da54A005ffdcf9f'
const SINGLETONFACTORY_ABI = [
  {
    constant: false,
    inputs: [
      {
        internalType: 'bytes',
        type: 'bytes',
      },
      {
        internalType: 'bytes32',
        type: 'bytes32',
      },
    ],
    name: 'deploy',
    outputs: [
      {
        internalType: 'address payable',
        type: 'address',
      },
    ],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
  },
]

export class SingletonFactoryContract extends Contract {
  constructor(signer: Signer) {
    super(SINGLETONFACTORY_ADDR, SINGLETONFACTORY_ABI, signer)
  }
}
