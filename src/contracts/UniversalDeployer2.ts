import type { Signer } from 'ethers'
import { Contract } from 'ethers'

export const UNIVERSALDEPLOYER_2_BYTECODE =
  '0x608060405234801561001057600080fd5b5061013d806100206000396000f3fe60806040526004361061001e5760003560e01c80639c4ae2d014610023575b600080fd5b6100cb6004803603604081101561003957600080fd5b81019060208101813564010000000081111561005457600080fd5b82018360208201111561006657600080fd5b8035906020019184600183028401116401000000008311171561008857600080fd5b91908080601f01602080910402602001604051908101604052809392919081815260200183838082843760009201919091525092955050913592506100cd915050565b005b60008183516020850134f56040805173ffffffffffffffffffffffffffffffffffffffff83168152905191925081900360200190a050505056fea264697066735822122033609f614f03931b92d88c309d698449bb77efcd517328d341fa4f923c5d8c7964736f6c63430007060033'
export const UNIVERSALDEPLOYER2_ADDR =
  '0x8a5bc19e22d6ad55a2c763b93a75d09f321fe764'
export const UNIVERSALDEPLOYER2_ABI = [
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
