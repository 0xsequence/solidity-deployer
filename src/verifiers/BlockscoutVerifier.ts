import axios from 'axios'
import type { CompilerInput } from 'solc'
import type { Logger } from 'src/types/logger'

export type BlockscoutVerificationRequest = {
  contractToVerify: string
  version: string // https://etherscan.io/solcversions
  licenceType: string
  compilerInput: CompilerInput
  constructorArgs?: string // As a hex string
  waitForSuccess?: boolean
}

// https://docs.blockscout.com/devs/verification/blockscout-smart-contract-verification-api#license-type
type BlockscoutLicenseType =
  | 'none'
  | 'unlicense'
  | 'mit'
  | 'gnu_gpl_v2'
  | 'gnu_gpl_v3'
  | 'gnu_lgpl_v2_1'
  | 'gnu_lgpl_v3'
  | 'bsd_2_clause'
  | 'bsd_3_clause'
  | 'mpl_2_0'
  | 'osl_3_0'
  | 'apache_2_0'
  | 'gnu_agpl_v3'
  | 'bsl_1_1'

const BLOCKSCOUT_LICENSE_TYPE_MAP: Record<string, BlockscoutLicenseType> = {
  None: 'none',
  Unlicense: 'unlicense',
  MIT: 'mit',
  'GNU GPLv2': 'gnu_gpl_v2',
  'GNU GPLv3': 'gnu_gpl_v3',
  'GNU LGPLv2.1': 'gnu_lgpl_v2_1',
  'GNU LGPLv3': 'gnu_lgpl_v3',
  'BSD-2-Clause': 'bsd_2_clause',
  'BSD-3-Clause': 'bsd_3_clause',
  'MPL-2.0': 'mpl_2_0',
  'OSL-3.0': 'osl_3_0',
  'Apache-2.0': 'apache_2_0',
  'GNU AGPLv3': 'gnu_agpl_v3',
  'BSL 1.1': 'bsl_1_1',
}

const stringToBlockscoutLicenseType = (
  licenseString: string,
): BlockscoutLicenseType | string => {
  if (!(licenseString in BLOCKSCOUT_LICENSE_TYPE_MAP)) {
    return licenseString // Just return the original string
  }
  return BLOCKSCOUT_LICENSE_TYPE_MAP[licenseString]
}

type BlockscoutApiResponse = {
  message: string
}

export class BlockscoutVerifier {
  constructor(
    private readonly blockscoutUrl: string,
    private readonly logger?: Logger,
  ) {}

  // Throws on failure
  verifyContract = async (
    addr: string,
    request: BlockscoutVerificationRequest,
  ): Promise<void> => {
    //TODO Skip already verified contracts

    const contractNameParts = request.contractToVerify.split(':')
    const contractName = contractNameParts[
      contractNameParts.length - 1
    ].replace('.sol', '')

    // Create verification body
    const verifyBody = new FormData()
    verifyBody.append('compiler_version', request.version)
    verifyBody.append(
      'license_type',
      stringToBlockscoutLicenseType(request.licenceType),
    )
    verifyBody.append('contract_name', contractName)
    verifyBody.append('autodetect_constructor_args', 'false')
    verifyBody.append('constructor_args', request.constructorArgs ?? '')
    const compilerInput = JSON.stringify(request.compilerInput)
    const compilerInputFile = new File([compilerInput], 'compiler_input.json', {
      type: 'application/json',
    })
    verifyBody.append('files[0]', compilerInputFile, 'compiler_input.json')

    //TODO Add linked library information

    // Send the request
    this.logger?.log(
      `Verifying ${request.contractToVerify} at ${addr} on ${this.blockscoutUrl}`,
    )
    try {
      let success = false
      while (!success) {
        success = await this.sendVerifyRequest(addr, verifyBody)
        if (!request.waitForSuccess) {
          // Don't wait
          break
        }
        if (!success) {
          // Waiting for success is just retrying to verify until "verified" result returned
          this.logger?.log('Waiting for verification...')
          await new Promise(resolve => setTimeout(resolve, 10000)) // Wait 10 sec
        }
      }
      this.logger?.log('Verified')
    } catch (err: unknown) {
      this.logger?.error('Failed to verify')
      this.logger?.error((err as Error).message)
      throw err
    }
  }

  // Throws on failure
  sendVerifyRequest = async (
    addr: string,
    body: FormData,
  ): Promise<boolean> => {
    const verifyUrl = `${this.blockscoutUrl}/api/v2/smart-contracts/${addr}/verification/via/standard-input`
    const res = await axios.postForm(verifyUrl, body)
    let errMsg: string
    if (res.status < 200 || res.status > 299) {
      errMsg = `Failed to verify. Code: ${res.status}`
    } else {
      // Try parse response
      const json = res.data as BlockscoutApiResponse
      if (json.message === 'Already verified') {
        // Success
        return true
      }
      if (json.message === 'Smart-contract verification started') {
        // Pending
        return false
      }
      // Else failed
      errMsg = `Failed to verify. Message: ${json.message}`
    }
    // Fail over
    this.logger?.error(errMsg)
    throw Error(errMsg)
  }
}
