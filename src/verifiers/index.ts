import {
  BlockscoutVerifier,
  type BlockscoutVerificationRequest,
} from './BlockscoutVerifier'
import {
  EtherscanVerifier,
  type EtherscanVerificationRequest,
} from './EtherscanVerifier'
import { TenderlyVerifier } from './TenderlyVerifier'

export type VerificationRequest = BlockscoutVerificationRequest &
  EtherscanVerificationRequest

export { BlockscoutVerifier, EtherscanVerifier, TenderlyVerifier }
export type { BlockscoutVerificationRequest, EtherscanVerificationRequest }
