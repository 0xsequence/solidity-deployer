import { Contract, Signer } from 'ethers'

const UNIVERSALDEPLOYER2_ADDR = '0x8a5bc19e22d6ad55a2c763b93a75d09f321fe764'
const UNIVERSALDEPLOYER2_ABI = [
  {
    anonymous: true,
    inputs: [
      {
        indexed: false,
        internalType: 'address',
        name: '_addr',
        type: 'address',
      },
    ],
    name: 'Deploy',
    type: 'event',
  },
  {
    constant: false,
    inputs: [
      {
        internalType: 'bytes',
        name: '_creationCode',
        type: 'bytes',
      },
      {
        internalType: 'uint256',
        name: '_instance',
        type: 'uint256',
      },
    ],
    name: 'deploy',
    outputs: [],
    payable: false,
    type: 'function',
  },
]

export class UniversalDeployer2Contract extends Contract {
  constructor(signer: Signer) {
    super(UNIVERSALDEPLOYER2_ADDR, UNIVERSALDEPLOYER2_ABI, signer)
  }
}
