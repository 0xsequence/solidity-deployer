import type { TenderlyConfiguration, VerificationRequest as TenderlyVerificationRequest } from '@tenderly/sdk'
import { Tenderly } from '@tenderly/sdk'

export class TenderlyVerifier {
  private readonly tenderly: Tenderly

  constructor(tenderlyConfig: Tenderly | TenderlyConfiguration) {
    this.tenderly =
      tenderlyConfig instanceof Tenderly
        ? tenderlyConfig
        : new Tenderly(tenderlyConfig)
  }

  verifyContract = async (
    address: string,
    contractAlias: string,
    tenderVerificationRequest: TenderlyVerificationRequest,
  ): Promise<void> => {
    const addr = address.toLowerCase()

    await this.tenderly.contracts.add(addr, { displayName: contractAlias })
    await this.tenderly.contracts.verify(addr, tenderVerificationRequest)
  }
}
