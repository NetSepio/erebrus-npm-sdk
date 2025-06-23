const erebrusSDK = require('../src');

async function main() {
  try {
    // Step 1: Create organization and get API key
    console.log('Creating organization...');
    const org = await erebrusSDK.createOrganization();
    if (!org || !org.api_key) {
      console.error('Failed to create organization');
      return;
    }
    console.log('Organization created successfully!');
    console.log('API Key:', org.api_key);

    // Step 2: Authenticate using API key
    console.log('\nAuthenticating...');
    const apiKey = org.api_key;
    const token = await erebrusSDK.authenticate(apiKey);
    if (!token) {
      console.error('Authentication failed');
      return;
    }
    console.log('Authentication successful!');


    // Step 3: Get available nodes
    console.log('\nFetching available nodes...');
    const nodes = await erebrusSDK.getAllNodes();
    console.log(`Found ${nodes.length} active nodes`);

    // Step 4: Connect to DVPN
    console.log('\nConnecting to DVPN...');
    const connected = await erebrusSDK.connectDvpn(token, '12D3KooWRzNLCkm7UrwXh695rz9SGiyUQKy4xT6m3RRXxYEvUyNJ');
    if (connected) {
      console.log('Successfully connected to DVPN!');
      
      // Wait for 30 seconds
      console.log('\nConnected for 30 seconds...');
      await new Promise(resolve => setTimeout(resolve, 30000));
      
      // Disconnect
      console.log('\nDisconnecting...');
      await erebrusSDK.disconnectVPN();
      console.log('Disconnected successfully');
    } else {
      console.error('Failed to connect to DVPN');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run the example
main(); 