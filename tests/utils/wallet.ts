import { ethers } from 'ethers'
import {
  addressOf,
  ConfigTopology,
  EncodingOptions,
  imageHash,
  optimize2SignersTopology,
  SequenceContext,
  SimplifiedWalletConfig,
  WalletConfig,
} from './sequence'

export type StaticSigner = ethers.Signer & { address: string }
export type AnyStaticSigner = StaticSigner | SequenceWallet

export const WALLET_CODE =
  '0x603a600e3d39601a805130553df3363d3d373d3d3d363d30545af43d82803e903d91601857fd5bf3'

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }

  return a
}

export function isAnyStaticSigner(s: any): s is AnyStaticSigner {
  return s.address !== undefined
}

let LAST_CHECKPOINT = 0

export function getCheckpoint() {
  let cand = 1682638372 // Math.floor(Date.now() / 1000)

  if (cand === LAST_CHECKPOINT) {
    cand++
  }

  LAST_CHECKPOINT = cand
  return cand
}

export type WalletOptions = {
  context: SequenceContext
  config: WalletConfig
  address?: string
  signers: (ethers.Signer | SequenceWallet)[]
  encodingOptions?: EncodingOptions
  chainId?: ethers.BigNumberish
}

export type BasicWalletOptions = {
  address?: string
  threshold?: number
  signing: number | number[]
  idle: number | number[]
  encodingOptions?: EncodingOptions
  topologyConverter: (simple: SimplifiedWalletConfig) => ConfigTopology
}

export type DetailedWalletOptions = {
  address?: string
  threshold: ethers.BigNumberish
  signers: (
    | string
    | AnyStaticSigner
    | Weighted<string>
    | Weighted<AnyStaticSigner>
  )[]
  encodingOptions?: EncodingOptions
}

export type Weighted<T> = { weight: number; value: T }

export function isWeighted<T>(w: any): w is Weighted<T> {
  return w.weight !== undefined && w.value !== undefined
}

export function weightedVal<T>(w: Weighted<T> | T): T {
  return isWeighted(w) ? w.value : w
}

const defaultTopology = optimize2SignersTopology

export class SequenceWallet {
  public isSequence = true
  _isSigner: boolean = true

  constructor(public options: WalletOptions) {}

  static basicWallet(
    context: SequenceContext,
    opts?: Partial<BasicWalletOptions>,
  ): SequenceWallet {
    const options = {
      ...{ signing: 1, idle: 0, topologyConverter: defaultTopology },
      ...opts,
    }

    const signersWeight = Array.isArray(options.signing)
      ? options.signing
      : new Array(options.signing).fill(0).map(() => 1)
    const idleWeight = Array.isArray(options.idle)
      ? options.idle
      : new Array(options.idle).fill(0).map(() => 1)

    const signers = signersWeight.map(s =>
      isAnyStaticSigner(s) ? s : ethers.Wallet.createRandom(),
    )
    const idle = idleWeight.map(() =>
      ethers.utils.getAddress(
        ethers.utils.hexlify(ethers.utils.randomBytes(20)),
      ),
    )
    const checkpoint = getCheckpoint()

    const simplifiedConfig = {
      checkpoint,
      threshold: options.threshold ? options.threshold : signers.length,
      signers: shuffle(
        signers
          .map((s, i) => ({
            address: s.address,
            weight: signersWeight[i],
          }))
          .concat(
            idle.map((s, i) => ({
              address: s,
              weight: idleWeight[i],
            })),
          ),
      ),
    }

    return new SequenceWallet({
      address: options.address,
      context,
      encodingOptions: options.encodingOptions,
      config: {
        ...simplifiedConfig,
        topology: options.topologyConverter(simplifiedConfig),
      },
      signers: signers,
    })
  }

  static detailedWallet(
    context: SequenceContext,
    opts: DetailedWalletOptions,
  ): SequenceWallet {
    const simplifiedConfig = {
      threshold: opts.threshold,
      checkpoint: getCheckpoint(),
      signers: opts.signers.map(s => ({
        weight: isWeighted(s) ? s.weight : 1,
        address: (() => {
          const v = weightedVal(s)
          return isAnyStaticSigner(v) ? v.address : v
        })(),
      })),
    }

    return new SequenceWallet({
      context,
      encodingOptions: opts.encodingOptions,
      address: opts.address,
      config: {
        ...simplifiedConfig,
        topology: defaultTopology(simplifiedConfig),
      },
      signers: opts.signers.map(s => weightedVal(s)).filter(isAnyStaticSigner),
    })
  }

  get config() {
    return this.options.config
  }

  get signers() {
    return this.options.signers
  }

  get address() {
    if (this.options.address) return this.options.address
    return addressOf(
      this.options.context.factory.address,
      this.options.context.mainModule.address,
      this.imageHash,
    )
  }

  getAddress() {
    return this.address
  }

  get imageHash() {
    return imageHash(this.config)
  }
}
