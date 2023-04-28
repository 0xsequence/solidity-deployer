// These are not the official type definitions

declare module 'solc' {
  export type CompilerInputSettings = {
    viaIR?: boolean
    optimizer: {
      runs?: number
      enabled?: boolean
      details?: {
        // If viaIR then detail: {yulDetails: {optimizerSteps: "u"}}}
        yul?: boolean
        yulDetails?: {
          optimizerSteps: string
        }
      }
    }
    metadata?: { useLiteralContent: boolean }
    outputSelection: {
      [sourceName: string]: {
        [contractName: string]: string[]
      }
    }
    evmVersion?:
      | 'homestead'
      | 'tangerineWhistle'
      | 'spuriousDragon'
      | 'byzantium'
      | 'constantinople'
      | 'petersburg'
      | 'istanbul'
      | 'berlin'
      | 'london'
      | 'paris'
    libraries?: {
      [libraryFileName: string]: {
        [libraryName: string]: string
      }
    }
    remappings?: string[]
  }

  export type CompilerInput = {
    language: string
    sources: {
      [file: string]: {
        content: string
      }
    }
    settings: CompilerInputSettings
  }

  export type CompilerOutput = {
    contracts: {
      [file: string]: {
        [contractName: string]: {
          evm: {
            bytecode: {
              object: string
            }
          }
        }
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function setupMethods(soljson: any): SolcSnapshot

  export function compile(input: string): string

  export type SolcSnapshot = {
    compile: (input: string) => string
    version: () => string
  }

  export function loadRemoteVersion(
    version: string,
    callback: (err: Error | null, solcSnapshot?: SolcSnapshot) => void,
  ): void

  export function version(): string
}
