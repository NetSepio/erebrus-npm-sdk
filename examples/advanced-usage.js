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
    const nodes = await erebrusSDK.getAllNodes(token);
    if (!nodes.length) {
      console.error('No active nodes available');
      return;
    }
    console.log(`Found ${nodes.length} active nodes`);
    // Print all node IDs and their status
    nodes.forEach((node, idx) => {
      console.log(`${idx + 1}. Node ID: ${node.id} | Status: ${node.status}`);
    });

    // Step 4: Select a nodeId (for demo, pick the first one, or let user choose)
    // You can replace this with user input if desired
    const nodeId = nodes[0].id;
    console.log(`\nSelected node: ${nodeId}`);

    // Step 5: Connect to DVPN
    console.log('\nConnecting to DVPN...');
    const connected = await erebrusSDK.connectDvpn(token, nodeId);
    if (connected) {
      console.log('Successfully connected to DVPN!');
      // Monitor connection for 1 minute
      console.log('\nMonitoring connection for 1 minute...');
      const startTime = Date.now();
      const duration = 60000; // 1 minute
      const interval = setInterval(async () => {
        const elapsed = Date.now() - startTime;
        if (elapsed >= duration) {
          clearInterval(interval);
          console.log('\nDisconnecting...');
          await erebrusSDK.disconnectVPN();
          console.log('Disconnected successfully');
        } else {
          const remaining = Math.ceil((duration - elapsed) / 1000);
          console.log(`Connection active. ${remaining} seconds remaining...`);
        }
      }, 5000); // Check every 5 seconds
    } else {
      console.error('Failed to connect to DVPN');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run the example
main(); 