import axios from 'axios'
import type { CompilerInput } from 'solc'
import type { Logger } from 'src/types/logger'
// import { writeFile } from 'fs/promises'
// import { join } from 'path'

export type EtherscanVerificationRequest = {
  contractToVerify: string
  version: string // https://etherscan.io/solcversions
  compilerInput: CompilerInput
  constructorArgs?: string // As a hex string (undefined if none)
  waitForSuccess: boolean // Whether to wait for success or return after sending the request
}

type EtherscanApiResponse = {
  status: string
  result: string
  message?: string // Error
}

export class EtherscanVerifier {
  constructor(
    private readonly apiKey: string,
    private readonly networkName: string,
    private readonly logger?: Logger,
  ) {}

  // Throws on failure
  verifyContract = async (
    addr: string,
    request: EtherscanVerificationRequest,
  ): Promise<void> => {
    // Determine network
    const apiUrl = `https://api${
      this.networkName === 'homestead' ? '' : `-${this.networkName}`
    }.etherscan.io/api`

    //TODO Filter out already verified contracts

    // Create verification body
    const body: Record<string, string> = {
      apikey: this.apiKey,
      module: 'contract',
      action: 'verifysourcecode',
      contractaddress: addr,
      sourceCode: JSON.stringify(request.compilerInput),
      codeformat: 'solidity-standard-json-input',
      contractname: request.contractToVerify,
      compilerversion: request.version,
    }
    if (request.constructorArgs) {
      body.constructorArguements = request.constructorArgs // Typo in Etherscan API
    }

    // Write the compiler input file
    // this.logger?.log(
    //   `Writing compiler input file to: ${
    //     request.contractToVerify.split(':')[1]
    //   }.etherscan.json`,
    // )
    // await writeFile(
    //   join(
    //     '.',
    //     `${request.contractToVerify.split(':')[1]}.etherscan.json`,
    //   ),
    //   JSON.stringify(body, null, 2),
    // )

    //TODO Add linked library information

    // Send the request

    this.logger?.log(`Verifying ${request.contractToVerify} at ${apiUrl}`)
    try {
      const guid = await this.sendVerifyRequest(apiUrl, body)

      if (request.waitForSuccess) {
        await this.waitForVerification(apiUrl, guid)
      }
    } catch (err: unknown) {
      this.logger?.error(`Failed to verify`)
      this.logger?.error((err as Error).message)
      throw err
    }
  }

  // Throws on failure
  sendVerifyRequest = async (
    apiUrl: string,
    body: Record<string, string>,
  ): Promise<string> => {
    const res = await axios.post(apiUrl, new URLSearchParams(body))
    let errMsg
    if (res.status < 200 || res.status > 299) {
      errMsg = `Failed to verify. Code: ${res.status}`
    } else {
      // Try parse response
      const json = res.data as EtherscanApiResponse
      if (json.status === '1') {
        // Success
        this.logger?.log(`Verification started`)
        const guid = json.result
        return guid
      } else {
        errMsg = `Failed to verify. Result: ${json.result}. Message: ${json.message}`
      }
    }
    // Fail over
    this.logger?.error(errMsg)
    throw Error(errMsg)
  }

  // Throws on failure
  waitForVerification = async (apiUrl: string, guid: string): Promise<void> => {
    // Wait for verification to complete
    this.logger?.log(`Waiting for verification to complete`)

    let status = 'Pending'
    while (status.includes('Pending')) {
      await new Promise(resolve => setTimeout(resolve, 5000)) // Delay 5s
      const params = new URLSearchParams({
        module: 'contract',
        action: 'checkverifystatus',
        apikey: this.apiKey,
        guid,
      })
      const res = await axios.get(apiUrl, { params })
      const json = res.data as EtherscanApiResponse
      status = json.result
      this.logger?.log(`Verification status: ${status}`)
    }

    // Success or failure
    if (status.includes('Pass')) {
      this.logger?.log(`Verification successful`)
    } else {
      // Failed
      const msg = `Verification failed with ${status}`
      this.logger?.error(msg)
      throw Error(msg)
    }
  }
}
