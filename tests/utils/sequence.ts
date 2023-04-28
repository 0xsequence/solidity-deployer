import type { BigNumberish, BytesLike, Contract} from "ethers";
import { ethers } from "ethers"
import { WALLET_CODE } from "./wallet"

export enum SignatureType {
  Legacy = 0,
  Dynamic = 1,
  NoChaindDynamic = 2,
}

export type SignerLeaf = {
  address: string,
  weight: BigNumberish
}

export type SubdigestLeaf = {
  subdigest: string
}

export type NestedLeaf = {
  tree: ConfigTopology,
  internalThreshold: BigNumberish,
  externalWeight: BigNumberish,
}

export type ConfigLeaf = SubdigestLeaf | SignerLeaf | NestedLeaf

export type ImageHashNode = {
  left: ConfigTopology,
  right: ConfigTopology
}

export type ConfigTopology = ImageHashNode | ConfigLeaf

export type WalletConfig = {
  threshold: ethers.BigNumberish,
  checkpoint: ethers.BigNumberish,
  topology: ConfigTopology
}

export type SimplifiedNestedWalletConfig = {
  threshold: ethers.BigNumberish,
  weight: ethers.BigNumberish,
  signers: SimplifiedConfigMember[]
}

export type SimplifiedWalletConfig = {
  threshold: BigNumberish,
  checkpoint: BigNumberish,
  signers: SimplifiedConfigMember[]
}


export type SimplifiedConfigMember = SignerLeaf | SimplifiedNestedWalletConfig

export type Transaction = {
  delegateCall: boolean;
  revertOnError: boolean;
  gasLimit: BigNumberish;
  target: string;
  value: BigNumberish;
  data: BytesLike;
}

export enum SignaturePartType {
  Signature = 0,
  Address = 1,
  Dynamic = 2,
  Node = 3,
  Branch = 4,
  Subdigest = 5,
  Nested = 6
}

export type SignaturePart = {
  address: string;
  type: SignaturePartType;
  signature?: string;
}

export function applyTxDefault(
  tx: Partial<Transaction>,
  def: Transaction = {
    delegateCall: false,
    revertOnError: true,
    gasLimit: 0,
    target: '0xFb8356E7deB64034aBE2b2a8A732634f77A2DAE4', // Random address
    value: 0,
    data: []
  }
): Transaction {
  return {
    ...def,
    ...tx,
  }
}

export function applyTxDefaults(
  tx: Partial<Transaction>[],
  def?: Transaction
): Transaction[] {
  return tx.map(t => applyTxDefault(t, def))
}

export function isConfigLeaf(node: ConfigTopology): node is ConfigLeaf {
  return !('left' in node || 'right' in node)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isSignerLeaf(node: any): node is SignerLeaf {
  return isConfigLeaf(node) && 'weight' in node && 'address' in node
}

export function isSubdigestLeaf(node: ConfigTopology): node is SubdigestLeaf {
  return isConfigLeaf(node) && 'subdigest' in node
}

export function isNestedLeaf(node: ConfigTopology): node is NestedLeaf {
  return isConfigLeaf(node) && 'tree' in node
}

export function legacyTopology(leavesOrConfig: SimplifiedWalletConfig | ConfigTopology[]): ConfigTopology {
  if (!Array.isArray(leavesOrConfig)) {
    return legacyTopology(toTopology(leavesOrConfig))
  }

  return leavesOrConfig.reduce((acc, leaf) => {
    return {
      left: acc,
      right: leaf
    }
  })
}

export function toTopology(config: SimplifiedWalletConfig | SimplifiedNestedWalletConfig): ConfigTopology[] {
  return config.signers.map(s => {
    if (isSignerLeaf(s)) {
      return {
        address: s.address,
        weight: s.weight
      }
    }

    return {
      tree: merkleTopology(toTopology(s)),
      internalThreshold: s.threshold,
      externalWeight: s.weight
    }
  })
}

export function merkleTopology(leavesOrConfig: SimplifiedWalletConfig | ConfigTopology[]): ConfigTopology {
  if (!Array.isArray(leavesOrConfig)) {
    return merkleTopology(toTopology(leavesOrConfig))
  }

  const leaves = leavesOrConfig
  for (let s = leaves.length; s > 1; s = s / 2) {
    for (let i = 0; i < s / 2; i++) {
      const j1 = i * 2
      const j2 = j1 + 1

      if (j2 >= s) {
        leaves[i] = leaves[j1]
      } else {
        leaves[i] = {
          left: leaves[j1],
          right: leaves[j2]
        }
      }
    }
  }

  return leaves[0]
}

export function optimize2SignersTopology(config: SimplifiedWalletConfig): ConfigTopology {
  if (config.signers.length > 8) {
    return merkleTopology(config)
  }

  return legacyTopology(config)
}

export function hashNode(node: ConfigTopology): string {
  if (isSignerLeaf(node)) {
    return leafForAddressAndWeight(node.address, node.weight)
  }

  if (isSubdigestLeaf(node)) {
    return ethers.utils.solidityKeccak256(
      ['string', 'bytes32'],
      ['Sequence static digest:\n', node.subdigest]
    )
  }

  if (isNestedLeaf(node)) {
    return ethers.utils.solidityKeccak256(
      ['string', 'bytes32', 'uint256', 'uint256'],
      ['Sequence nested config:\n', hashNode(node.tree), node.internalThreshold, node.externalWeight]
    )
  }

  return ethers.utils.solidityKeccak256(
    ['bytes32', 'bytes32'],
    [hashNode(node.left), hashNode(node.right)]
  )
}

export function addressOf(factory: string, firstModule: string, imageHash: string): string {
  const codeHash = ethers.utils.keccak256(
    ethers.utils.solidityPack(
      ['bytes', 'bytes32'],
      [WALLET_CODE, ethers.utils.hexZeroPad(firstModule, 32)]
    )
  )

  const hash = ethers.utils.keccak256(
    ethers.utils.solidityPack(
      ['bytes1', 'address', 'bytes32', 'bytes32'],
      ['0xff', factory, imageHash, codeHash]
    )
  )

  return ethers.utils.getAddress(ethers.utils.hexDataSlice(hash, 12))
}

export function leafForAddressAndWeight(address: string, weight: ethers.BigNumberish) {
  return ethers.utils.solidityPack(
    ['uint96', 'address'],
    [weight, address]
  )
}

export function imageHash(config: WalletConfig): string {
  const signersRoot = hashNode(config.topology)

  const preImageHash = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ['bytes32', 'uint256'],
      [signersRoot, config.threshold]
    )
  )

  return ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ['bytes32', 'uint256'],
      [preImageHash, config.checkpoint]
    )
  )
}

export type EncodingOptions = {
  forceDynamicEncoding?: boolean,
  signatureType?: SignatureType,
  disableTrim?: boolean
}

export type SequenceContext = {
  factory: Contract,
  mainModule: {address: string},
}
