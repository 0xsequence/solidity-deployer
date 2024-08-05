import axios from 'axios'
import { File, FormData } from 'formdata-node'
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
    verifyBody.append('license_type', request.licenceType.toLowerCase())
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
