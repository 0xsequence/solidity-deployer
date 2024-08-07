# Deployers

This folder contains deployers that are able to creating contract instances at consistent addresses across networks.
This is done by using a single use deployment account.

**Note:** Deploying these deployers requires a pre-EIP-155 transaction.

When using these deployer classes, the deployer will automatically be deployed if it is not already present on the network.
If you prefer to send these transactions manually, please use the information below.

**Note:** As different networks have different gas requirements, additional costs may be required for deployment (e.g. Optimism based chains).

## Manual deployment instructions for the Singleton Deployer

The Singleton Deployer uses [ERC-2470](https://eips.ethereum.org/EIPS/eip-2470).

1. Send `0.0247` of the network native token to the one time use address: `0xBb6e024b9cFFACB947A71991E386681B1Cd1477D`.
2. Send the transaction: `0xf9016c8085174876e8008303c4d88080b90154608060405234801561001057600080fd5b50610134806100206000396000f3fe6080604052348015600f57600080fd5b506004361060285760003560e01c80634af63f0214602d575b600080fd5b60cf60048036036040811015604157600080fd5b810190602081018135640100000000811115605b57600080fd5b820183602082011115606c57600080fd5b80359060200191846001830284011164010000000083111715608d57600080fd5b91908080601f016020809104026020016040519081016040528093929190818152602001838380828437600092019190915250929550509135925060eb915050565b604080516001600160a01b039092168252519081900360200190f35b6000818351602085016000f5939250505056fea26469706673582212206b44f8a82cb6b156bfcc3dc6aadd6df4eefd204bc928a4397fd15dacf6d5320564736f6c634300060200331b83247000822470`

## Manual deployment instructions for the Universal Deployer

The Universal Deployer uses [Agustin Aguilar's Nano Universal Deployer](https://gist.github.com/Agusx1211/de05dabf918d448d315aa018e2572031).

**Note:** The Universal Deployer class deploys a second deployer with additional functionality. This second deployer does NOT require a per-EIP-155 transaction and so is not listed in these manual instructions.

1. Send `0.02170000000014` of the network native token to the one time use address: `0x9c5a87452d4FAC0cbd53BDCA580b20A45526B3AB`.
2. Send the transaction: `0xf9010880852416b84e01830222e08080b8b66080604052348015600f57600080fd5b50609980601d6000396000f3fe60a06020601f369081018290049091028201604052608081815260009260609284918190838280828437600092018290525084519495509392505060208401905034f5604080516001600160a01b0383168152905191935081900360200190a0505000fea26469706673582212205a310755225e3c740b2f013fb6343f4c205e7141fcdf15947f5f0e0e818727fb64736f6c634300060a00331ca01820182018201820182018201820182018201820182018201820182018201820a01820182018201820182018201820182018201820182018201820182018201820`

## EOA Deployer

The EOA deployer is a simple deployer that uses an EOA to deploy contracts. It is not recommended for production use as there is no guarantee that the contract will be deployed at the same address on different networks.
