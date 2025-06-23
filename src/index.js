const { exec } = require('child_process');
const { ethers } = require('ethers');
const fetch = require('node-fetch');
const fs = require('fs');

// Helper function to log messages
function log(message) {
  console.log(`${new Date().toISOString()}: ${message}`);
}

//=============================================================================
// MAIN EXPORTED FUNCTIONS
//=============================================================================

/**
 * Creates a new organization and returns its details including API key
 * @return {Promise<object|null>} Organization data or null if failed
 */
async function createOrganization() {
  try {
    const response = await fetch('https://gateway.netsepio.com/api/v1.1/organisation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    log(`Organization created: ${JSON.stringify(data)}`);
    return data;
  } catch (error) {
    log('Error creating organization: ' + error.message);
    return null;
  }
}

/**
 * Authenticates with the API using organization API key and returns an authentication token
 * @param {string} apiKey - Organization API key
 * @return {Promise<string|null>} Authentication token or null if failed
 */
async function authenticate(apiKey) {
  try {
    if (!apiKey) {
      throw new Error('API key is required');
    }

    const response = await fetch('https://gateway.netsepio.com/api/v1.1/organisation/token', {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey
      }
    });

    const data = await response.json();
    log(`Authentication response: ${JSON.stringify(data)}`);
    
    if (data.status !== 200) {
      throw new Error(`Authentication failed: ${data.message || 'Unknown error'}`);
    }

    return data.payload.token;
  } catch (error) {
    log('Authentication Error: ' + error.message);
    return null;
  }
}

/**
 * Checks subscription status
 * @param {string} token - Authentication token
 * @return {Promise<object|null>} Subscription data or null if failed
 */
async function checkSubscription(token) {
  try {
    log('Checking subscription status with token: ' + token);
    const response = await fetch('https://gateway.dev.netsepio.com/api/v1.0/subscription', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    // Log the raw response for debugging
    log('Response status: ' + response.status);
    log('Response headers: ' + JSON.stringify(response.headers));
    
    const data = await response.json();
    log('Raw subscription API response: ' + JSON.stringify(data, null, 2));
    
    // Check if we have a valid response with subscription data
    if (data && data.subscription && data.status) {
      return data;
    }
    
    // If we don't have the expected structure, return notFound
    return { status: 'notFound' };
  } catch (error) {
    log('Subscription check error: ' + error.message);
    return null;
  }
}

/**
 * Creates a trial subscription
 * @param {string} token - Authentication token
 * @return {Promise<object|null>} Subscription data or null if failed
 */
async function createTrialSubscription(token) {
  try {
    log('Creating trial subscription...');
    const response = await fetch('https://gateway.dev.netsepio.com/api/v1.0/subscription/trial', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    log('Trial subscription response: ' + JSON.stringify(data));
    
    return data;
  } catch (error) {
    log('Trial subscription error: ' + error.message);
    return null;
  }
}

/**
 * Gets all available nodes
 * @param {string} token - Authentication token
 * @return {Promise<Array>} Array of node objects
 */
async function getAllNodes(token) {
  try {
    log('Fetching all available nodes...');
    const response = await fetch('https://gateway.erebrus.io/api/v1.0/nodes/all', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await response.json();
    log(`Found ${data.payload.length} nodes`);
    // Filter only active nodes
    const activeNodes = data.payload.filter(node => node.status === 'active');
    log(`${activeNodes.length} nodes are active`);
    return activeNodes;
  } catch (error) {
    log('Get nodes error: ' + error.message);
    return [];
  }
}

/**
 * Creates a client for a specific node
 * @param {string} token - Authentication token
 * @param {string} nodeId - ID of the node to connect to
 * @param {string} clientName - Name for the client
 * @return {Promise<object|null>} Client data or null if failed
 */
async function createClient(token, nodeId, clientName = "client") {
  try {
    log(`Creating client for node: ${nodeId}`);
    
    // Generate WireGuard keys using wg command
    const keyPair = await generateWireGuardKeyPair();
    if (!keyPair) {
      throw new Error('Failed to generate WireGuard key pair');
    }
    
    // Generate preshared key
    const presharedKey = await generatePresharedKey();
    if (!presharedKey) {
      throw new Error('Failed to generate WireGuard preshared key');
    }
    
    const clientData = {
      name: clientName,
      publicKey: keyPair.publicKey,
      presharedKey: presharedKey
    };
    
    log(`Sending client data: ${JSON.stringify(clientData)}`);
    
    const response = await fetch(`https://gateway.netsepio.com/api/v1.0/erebrus/client/${nodeId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(clientData)
    });
    
    // Log the raw response details for debugging
    log(`Response status: ${response.status} ${response.statusText}`);
    log(`Response status: ${response.status} ${response}`);

    
    // Get the raw text first to see what's being returned
    const rawText = await response.text();
    log(`Raw response: ${rawText}`);
    
    // If we have a valid response, parse it as JSON
    let data = null;
    if (rawText && rawText.trim()) {
      try {
        data = JSON.parse(rawText);
        log(`Client creation response: ${JSON.stringify(data)}`);
        
        // Store the private key and preshared key with the response data
        data.privateKey = keyPair.privateKey;
        data.presharedKey = presharedKey;
        
      } catch (parseError) {
        log(`Error parsing JSON: ${parseError.message}`);
      }
    } else {
      log('Empty response received from server');
    }
    
    return data;
  } catch (error) {
    log(`Client creation error: ${error.message}`);
    return null;
  }
}

/**
 * Creates a WireGuard configuration string
 * @param {object} clientData - Client data from createClient
 * @return {Promise<string|null>} WireGuard configuration string or null if failed
 */
async function createWireGuardConfig(clientData) {
  try {
    const { client, endpoint, serverPublicKey } = clientData.payload;
    const privateKey = clientData.privateKey;
    
    log('Creating WireGuard configuration...');
    
    // Create WireGuard configuration content
    const configContent = `[Interface]
PrivateKey = ${privateKey}
Address = ${client.Address[0]}
DNS = 1.1.1.1, 8.8.8.8
PostUp = echo 'nameserver 1.1.1.1' | resolvconf -a %i -m 0 || true
PostDown = resolvconf -d %i || true

[Peer]
PublicKey = ${serverPublicKey}
PresharedKey = ${client.PresharedKey}
AllowedIPs = 0.0.0.0/0, ::/0
Endpoint = ${endpoint}:51820
PersistentKeepalive = 25
`;

    // Write configuration to file with restricted permissions
    const configPath = '/tmp/erebrus-dvpn.conf';
    await fs.promises.writeFile(configPath, configContent, { mode: 0o600 }); // Set permissions to 600 (user read/write only)
    log(`WireGuard configuration written to ${configPath}`);
    
    return configPath;
  } catch (error) {
    log(`Error creating WireGuard config: ${error.message}`);
    return null;
  }
}

/**
 * Connects to DVPN
 * @param {string} token - Authentication token
 * @param {string} nodeId - Node ID to connect to
 * @return {Promise<boolean>} True if connected successfully, false otherwise
 */
async function connectDvpn(token, nodeId) {
  try {
    log('Starting DVPN connection process...');
    
    // Check if WireGuard is installed
    const isWireGuardInstalled = await checkWireGuard();
    
    if (!isWireGuardInstalled) {
      log('Cannot connect to DVPN without WireGuard installed.');
      return false;
    }
    
    // Get all available nodes (for validation/logging)
    const nodes = await getAllNodes(token);
    if (nodes.length === 0) {
      log('No active nodes available. Cannot connect to DVPN.');
      return false;
    }
    
    // Validate the provided nodeId
    const selectedNode = nodes.find(n => n.id === nodeId);
    if (!selectedNode) {
      log(`Provided nodeId ${nodeId} is not in the list of active nodes.`);
      return false;
    }
    log(`Connecting to specified node: ${nodeId}`);
    
    // Create client for the specified node
    const client = await createClient(token, nodeId);
    
    if (!client) {
      log('Failed to create client for the specified node.');
      return false;
    }
    
    log('DVPN client created successfully!');
    log('Client details:');
    log(client);
    
    // Create WireGuard configuration
    const configPath = await createWireGuardConfig(client);
    
    if (!configPath) {
      log('Failed to create WireGuard configuration.');
      return false;
    }
    
    // Connect to WireGuard
    try {
      await connectToWireGuard(configPath);
      log('Successfully connected to DVPN via WireGuard!');
      
      // Check if connection was successful by verifying IP change
      exec('curl -s https://api.ipify.org', (error, stdout, stderr) => {
        if (!error) {
          log(`Your new public IP address is: ${stdout}`);
        }
      });
      
      return true;
    } catch (error) {
      log(`Failed to connect to WireGuard: ${error.message}`);
      return false;
    }
  } catch (error) {
    log(`DVPN Error: ${error.message}`);
    return false;
  }
}

/**
 * Disconnects from WireGuard
 * @param {string} configPath - Path to the WireGuard configuration file
 * @return {Promise<boolean>} True if disconnected successfully, false otherwise
 */
async function disconnectVPN(configPath = '/tmp/erebrus-dvpn.conf') {
  return new Promise((resolve, reject) => {
    log(`Disconnecting from WireGuard...`);
    
    // First try wg-quick down
    exec(`sudo wg-quick down ${configPath}`, (error) => {
      // Then ensure the interface is deleted
      exec('sudo ip link delete dev erebrus-dvpn', (error) => {
        if (error) {
          log(`Warning: Could not delete interface: ${error.message}`);
        }
        log(`WireGuard disconnected successfully`);
        resolve(true);
      });
    });
  });
}

//=============================================================================
// DEPENDENCY FUNCTIONS
//=============================================================================

/**
 * Checks if WireGuard is installed on the system
 * @return {Promise<boolean>} True if WireGuard is installed, false otherwise
 */
async function checkWireGuard() {
  return new Promise((resolve) => {
    log('Checking if WireGuard is installed...');
    
    exec('which wg', (error, stdout) => {
      if (error || !stdout.trim()) {
        log('WireGuard is NOT installed on the system.');
        resolve(false);
      } else {
        log(`WireGuard found at: ${stdout.trim()}`);
        resolve(true);
      }
    });
  });
}

/**
 * Generates a WireGuard key pair
 * @return {Promise<object|null>} Object containing privateKey and publicKey, or null if failed
 */
async function generateWireGuardKeyPair() {
  try {
    log('Generating WireGuard key pair...');
    
    // Create a temporary directory for key generation
    const tempDir = `/tmp/wg-keys-${Date.now()}`;
    await fs.promises.mkdir(tempDir, { recursive: true });
    
    // Generate private key
    await new Promise((resolve, reject) => {
      exec(`wg genkey > ${tempDir}/private.key`, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
    
    // Generate public key from private key
    await new Promise((resolve, reject) => {
      exec(`cat ${tempDir}/private.key | wg pubkey > ${tempDir}/public.key`, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
    
    // Read the keys
    const privateKey = (await fs.promises.readFile(`${tempDir}/private.key`, 'utf8')).trim();
    const publicKey = (await fs.promises.readFile(`${tempDir}/public.key`, 'utf8')).trim();
    
    // Clean up
    await fs.promises.rm(tempDir, { recursive: true, force: true });
    
    log('WireGuard key pair generated successfully');
    return { privateKey, publicKey };
  } catch (error) {
    log(`Error generating WireGuard key pair: ${error.message}`);
    return null;
  }
}

/**
 * Generates a WireGuard preshared key
 * @return {Promise<string|null>} Preshared key or null if failed
 */
async function generatePresharedKey() {
  try {
    log('Generating WireGuard preshared key...');
    
    // Create a temporary file for key generation
    const tempFile = `/tmp/wg-psk-${Date.now()}`;
    
    // Generate preshared key
    await new Promise((resolve, reject) => {
      exec(`wg genpsk > ${tempFile}`, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
    
    // Read the key
    const presharedKey = (await fs.promises.readFile(tempFile, 'utf8')).trim();
    
    // Clean up
    await fs.promises.unlink(tempFile);
    
    log('WireGuard preshared key generated successfully');
    return presharedKey;
  } catch (error) {
    log(`Error generating WireGuard preshared key: ${error.message}`);
    return null;
  }
}

// Function to clean up WireGuard interface
async function cleanupWireGuard() {
  return new Promise((resolve) => {
    log('Cleaning up existing WireGuard interface...');
    
    // Try to bring down the interface first
    exec('sudo wg-quick down erebrus-dvpn', (error) => {
      // Ignore errors here as the interface might not exist
      
      // Then try to delete the interface
      exec('sudo ip link delete dev erebrus-dvpn', (error) => {
        // Ignore errors here as well
        log('Cleanup completed');
        resolve();
      });
    });
  });
}

// Function to connect to WireGuard
async function connectToWireGuard(configPath) {
  return new Promise((resolve, reject) => {
    log(`Connecting to WireGuard using config: ${configPath}`);
    
    // First clean up any existing interface
    cleanupWireGuard().then(() => {
      // Try using wg-quick first
      exec(`sudo wg-quick up ${configPath}`, (error, stdout, stderr) => {
        if (error) {
          log(`wg-quick failed, trying manual setup: ${error.message}`);
          log(`stderr: ${stderr}`);
          
          // Parse the config file to get the necessary information
          fs.readFile(configPath, 'utf8', (readErr, data) => {
            if (readErr) {
              reject(readErr);
              return;
            }
            
            // Extract values from config
            const privateKey = data.match(/PrivateKey\s*=\s*([^\s]+)/)[1];
            const address = data.match(/Address\s*=\s*([^\s]+)/)[1];
            const publicKey = data.match(/PublicKey\s*=\s*([^\s]+)/)[1];
            const presharedKey = data.match(/PresharedKey\s*=\s*([^\s]+)/)[1];
            const endpoint = data.match(/Endpoint\s*=\s*([^\s]+)/)[1];
            
            // Create a temporary config for wg command
            const tempConf = `/tmp/wg-temp-${Date.now()}.conf`;
            const wgConf = `private_key=${privateKey}\npublic_key=${publicKey}\npreshared_key=${presharedKey}\nendpoint=${endpoint}\nallowed_ip=0.0.0.0/0\nallowed_ip=::/0\n`;
            
            fs.writeFile(tempConf, wgConf, { mode: 0o600 }, (writeErr) => {
              if (writeErr) {
                reject(writeErr);
                return;
              }
              
              // Manual setup commands
              const commands = [
                `sudo ip link add dev erebrus-dvpn type wireguard`,
                `sudo wg setconf erebrus-dvpn ${tempConf}`,
                `sudo ip addr add ${address} dev erebrus-dvpn`,
                `sudo ip link set mtu 1420 up dev erebrus-dvpn`,
                `sudo ip route add default dev erebrus-dvpn`
              ];
              
              // Execute commands in sequence
              const execCommands = (index) => {
                if (index >= commands.length) {
                  // Clean up temp file
                  fs.unlink(tempConf, () => {});
                  resolve(true);
                  return;
                }
                
                exec(commands[index], (cmdErr, cmdStdout, cmdStderr) => {
                  if (cmdErr) {
                    log(`Command failed: ${commands[index]}`);
                    log(`Error: ${cmdErr.message}`);
                    
                    // Clean up on error
                    exec('sudo ip link delete dev erebrus-dvpn', () => {
                      fs.unlink(tempConf, () => {});
                      reject(cmdErr);
                    });
                    return;
                  }
                  
                  execCommands(index + 1);
                });
              };
              
              execCommands(0);
            });
          });
        } else {
          log(`WireGuard connection established!`);
          
          // Add a DNS fix - sometimes DNS doesn't get set properly
          exec('echo "nameserver 1.1.1.1" | sudo tee /etc/resolv.conf > /dev/null', (dnsErr) => {
            if (dnsErr) {
              log(`Warning: Could not set DNS: ${dnsErr.message}`);
            } else {
              log('DNS configuration updated');
            }
            
            // Add a delay to allow the connection to stabilize
            setTimeout(() => {
              // Test internet connectivity
              exec('ping -c 1 8.8.8.8', (pingErr) => {
                if (pingErr) {
                  log('Warning: Internet connectivity test failed');
                } else {
                  log('Internet connectivity confirmed');
                }
                resolve(true);
              });
            }, 2000);
          });
        }
      });
    });
  });
}

// Export all functions for SDK use
module.exports = {
  createOrganization,
  authenticate,
  checkSubscription,
  createTrialSubscription,
  getAllNodes,
  createClient,
  createWireGuardConfig,
  connectDvpn,
  disconnectVPN
};