#!/usr/bin/env node

const https = require('https');

// Configuration
const API_GATEWAY_URL = 'https://byot-gateway-1ntw604r.uc.gateway.dev';

// Get token from command line argument
const token = process.argv[2];

if (!token) {
  console.log('❌ Usage: node test-with-token.js <firebase-id-token>');
  console.log('');
  console.log('💡 To get a Firebase ID token:');
  console.log('1. Sign into your Next.js app');
  console.log('2. Open browser console (F12)');
  console.log('3. Run: getAuth().currentUser.getIdToken().then(console.log)');
  console.log('4. Copy the token and use it here');
  console.log('');
  console.log('📖 See get-firebase-token.md for detailed instructions');
  process.exit(1);
}

console.log('🔑 Using Firebase ID Token:', token.substring(0, 20) + '...');
console.log('🌐 API Gateway URL:', API_GATEWAY_URL);
console.log('');

function makeRequest(endpoint, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_GATEWAY_URL + endpoint);
    
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'BYOT-API-Test/1.0'
      }
    };

    const requestBody = body ? JSON.stringify(body) : null;
    if (requestBody) {
      options.headers['Content-Length'] = Buffer.byteLength(requestBody);
    }

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = {
            status: res.statusCode,
            headers: res.headers,
            body: data.length > 0 ? JSON.parse(data) : null
          };
          resolve(response);
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data,
            parseError: e.message
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (requestBody) {
      req.write(requestBody);
    }
    
    req.end();
  });
}

async function testApiEndpoints() {
  const tests = [
    {
      name: 'Get API Key Status',
      endpoint: '/api/user/api-key-status',
      method: 'GET'
    },
    {
      name: 'Set API Key',
      endpoint: '/api/user/set-api-key',
      method: 'POST',
      body: { apiKey: 'test-gemini-api-key-12345' }
    },
    {
      name: 'Get API Key Status (after setting)',
      endpoint: '/api/user/api-key-status',
      method: 'GET'
    },
    {
      name: 'Test Genkit Proxy',
      endpoint: '/api/ai/genkit/testFlow',
      method: 'POST',
      body: { input: 'test data for genkit flow' }
    },
    {
      name: 'Remove API Key',
      endpoint: '/api/user/remove-api-key',
      method: 'POST'
    },
    {
      name: 'Get API Key Status (after removal)',
      endpoint: '/api/user/api-key-status',
      method: 'GET'
    }
  ];

  for (const test of tests) {
    console.log(`\n📍 Testing: ${test.name}`);
    console.log(`   ${test.method} ${test.endpoint}`);
    
    try {
      const response = await makeRequest(test.endpoint, test.method, test.body);
      
      console.log(`   Status: ${response.status}`);
      
      if (response.body) {
        console.log(`   Response:`, JSON.stringify(response.body, null, 2));
      }
      
      // Analysis
      if (response.status === 200) {
        console.log(`   ✅ Success`);
      } else if (response.status === 401) {
        console.log(`   ❌ Unauthorized - check your Firebase token`);
      } else if (response.status === 400) {
        console.log(`   ⚠️  Bad request`);
      } else if (response.status === 500) {
        console.log(`   ❌ Server error`);
      } else if (response.status === 503) {
        console.log(`   ⚠️  Service unavailable (Genkit proxy might be down)`);
      } else {
        console.log(`   ❓ Unexpected status: ${response.status}`);
      }
      
    } catch (error) {
      console.log(`   ❌ Request failed: ${error.message}`);
    }
    
    // Add a small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

async function validateToken() {
  console.log('🔍 Validating Firebase token...');
  
  try {
    // Decode the token payload (doesn't verify signature, just checks format)
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.log('❌ Invalid token format');
      return false;
    }
    
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    
    console.log('📋 Token Info:');
    console.log(`   User ID: ${payload.user_id || payload.sub}`);
    console.log(`   Email: ${payload.email || 'Not available'}`);
    console.log(`   Audience: ${payload.aud}`);
    console.log(`   Issuer: ${payload.iss}`);
    console.log(`   Expires: ${new Date(payload.exp * 1000).toISOString()}`);
    
    // Check if token is for the right project
    if (payload.aud !== 'interviewai-mzf86') {
      console.log(`   ⚠️  Warning: Token audience (${payload.aud}) doesn't match expected project (interviewai-mzf86)`);
    } else {
      console.log(`   ✅ Token is for the correct Firebase project`);
    }
    
    // Check if token is expired
    if (payload.exp * 1000 < Date.now()) {
      console.log(`   ❌ Token is expired`);
      return false;
    } else {
      console.log(`   ✅ Token is not expired`);
    }
    
    return true;
    
  } catch (error) {
    console.log(`❌ Error validating token: ${error.message}`);
    return false;
  }
}

// Main execution
async function main() {
  const isValidToken = await validateToken();
  
  if (!isValidToken) {
    console.log('\n❌ Token validation failed. Please get a new token.');
    process.exit(1);
  }
  
  console.log('\n🚀 Starting API tests...');
  await testApiEndpoints();
  
  console.log('\n🎉 Testing complete!');
  console.log('\n💡 Tips:');
  console.log('- Check function logs: gcloud functions logs read SetAPIKeyGCF --region=us-central1');
  console.log('- Monitor in real-time: gcloud functions logs tail SetAPIKeyGCF --region=us-central1');
  console.log('- View all functions: gcloud functions list --regions=us-central1');
}

main().catch(console.error); 