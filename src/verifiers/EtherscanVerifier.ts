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

/**
 * Get Etherscan's API from the network name.
 * @param networkName The network name, e.g. 'homestead' or 'rinkeby'
 * @returns The Etherscan API URL
 * @notice This function does not check URL validity
 */
export const getEtherscanApiFromNetwork = (chainId: number) =>
  `https://api.etherscan.io/v2/api?chainid=${chainId}`

export class EtherscanVerifier {
  constructor(
    private readonly apiKey: string,
    private readonly apiUrl: string,
    private readonly logger?: Logger,
  ) {}

  // Throws on failure
  verifyContract = async (
    addr: string,
    request: EtherscanVerificationRequest,
  ): Promise<void> => {
    // Filter out already verified contracts
    const checkBody: Record<string, string> = {
      apikey: this.apiKey,
      module: 'contract',
      action: 'getsourcecode',
      address: addr,
    }

    try {
      const checkResult = await this.sendApiRequest(checkBody)
      if (checkResult[0].SourceCode !== '') {
        this.logger?.log(
          `Contract ${request.contractToVerify} already verified`,
        )
        return
      }
    } catch (err) {
      // Contract not verified. Continue
    }

    // Create verification body
    const verifyBody: Record<string, string> = {
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
      // Note typo in Etherscan API
      if (request.constructorArgs.startsWith('0x')) {
        verifyBody.constructorArguements = request.constructorArgs.substring(2)
      } else {
        verifyBody.constructorArguements = request.constructorArgs
      }
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

    this.logger?.log(`Verifying ${request.contractToVerify} at ${this.apiUrl}`)
    try {
      const guid = (await this.sendApiRequest(verifyBody)) as string
      this.logger?.log(`Verification started`)

      if (request.waitForSuccess) {
        await this.waitForVerification(guid)
      }
    } catch (err: unknown) {
      this.logger?.error(`Failed to verify`)
      this.logger?.error((err as Error).message)
      throw err
    }
  }

  // Throws on failure
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sendApiRequest = async (body: Record<string, string>): Promise<any> => {
    const res = await axios.post(this.apiUrl, new URLSearchParams(body))
    let errMsg
    if (res.status < 200 || res.status > 299) {
      errMsg = `Failed to verify. Code: ${res.status}`
    } else {
      // Try parse response
      const json = res.data as EtherscanApiResponse
      if (json.status === '1') {
        // Success
        return json.result
      } else {
        errMsg = `Failed to verify. Result: ${json.result}. Message: ${json.message}`
      }
    }
    // Fail over
    this.logger?.error(errMsg)
    throw Error(errMsg)
  }

  // Throws on failure
  waitForVerification = async (guid: string): Promise<void> => {
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
      const res = await axios.get(this.apiUrl, { params })
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
