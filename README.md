# Erebrus DVPN npm SDK

A Node.js client for the Erebrus Decentralized VPN (DVPN) service. This package provides a simple interface to connect to the Erebrus DVPN network using WireGuard and the new API key/organization-based authentication flow.

## Prerequisites

- Node.js (v14 or higher)
- WireGuard installed on your system
- Sudo privileges (required for WireGuard operations)

## Installation

```bash
npm install erebrus
```

## Usage

### Basic Usage Example

```javascript
const erebrusSDK = require('erebrus');

async function main() {
  // Step 1: Create an organization and get API key
  const org = await erebrusSDK.createOrganization();
  if (!org || !org.api_key) {
    console.error('Failed to create organization');
    return;
  }
  const apiKey = org.api_key;

  // Step 2: Authenticate using API key
  const token = await erebrusSDK.authenticate(apiKey);
  if (!token) {
    console.error('Authentication failed');
    return;
  }

  // Step 3: Get available nodes
  const nodes = await erebrusSDK.getAllNodes(token);
  if (!nodes.length) {
    console.error('No active nodes available');
    return;
  }
  // Print available node IDs
  console.log('Available node IDs:');
  nodes.forEach(node => console.log(node.id));

  // Step 4: Connect to DVPN (user must select a nodeId)
  const nodeId = nodes[0].id; // or let the user pick
  const connected = await erebrusSDK.connectDvpn(token, nodeId);
  if (connected) {
    console.log('Successfully connected to DVPN!');
    // ...
    await erebrusSDK.disconnectVPN();
    console.log('Disconnected successfully');
  } else {
    console.error('Failed to connect to DVPN');
  }
}

main();
```

## API Reference

### `createOrganization()`
Creates a new organization and returns its details, including the API key.
- **Returns:** `Promise<object>` (organization data)

### `authenticate(apiKey)`
Authenticates with the API using the organization API key and returns an authentication token.
- **Parameters:**
  - `apiKey` (string): Organization API key
- **Returns:** `Promise<string>` (authentication token)

### `getAllNodes(token)`
Gets all available nodes for the authenticated organization.
- **Parameters:**
  - `token` (string): Authentication token
- **Returns:** `Promise<Array>` (array of node objects)

### `connectDvpn(token, nodeId)`
Connects to the DVPN using the provided authentication token and node ID.
- **Parameters:**
  - `token` (string): Authentication token
  - `nodeId` (string): The ID of the node to connect to (must be from `getAllNodes`)
- **Returns:** `Promise<boolean>` (true if connected successfully)

### `disconnectVPN(configPath?)`
Disconnects from WireGuard.
- **Parameters:**
  - `configPath` (string, optional): Path to the WireGuard configuration file (default: `/tmp/erebrus-dvpn.conf`)
- **Returns:** `Promise<boolean>` (true if disconnected successfully)


## Example: List All Node IDs

```javascript
const erebrusSDK = require('erebrus-dvpn-client');

async function listNodes() {
  const org = await erebrusSDK.createOrganization();
  const token = await erebrusSDK.authenticate(org.api_key);
  const nodes = await erebrusSDK.getAllNodes(token);
  nodes.forEach(node => console.log(node.id, node.status));
}

listNodes();
```

## License

MIT
