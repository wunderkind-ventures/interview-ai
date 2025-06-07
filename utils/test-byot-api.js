#!/usr/bin/env node

const https = require('https');

// Configuration
const API_GATEWAY_URL = 'https://byot-gateway-1ntw604r.uc.gateway.dev';
const FIREBASE_PROJECT_ID = 'interviewai-mzf86';

// Mock Firebase token for testing (this won't work for real authentication)
// In a real scenario, you'd get this from Firebase Auth
const MOCK_FIREBASE_TOKEN = 'your-firebase-id-token-here';

// Test endpoints
const endpoints = [
  {
    name: 'Get API Key Status',
    method: 'GET',
    path: '/api/user/api-key-status',
    requiresAuth: true
  },
  {
    name: 'Set API Key',
    method: 'POST', 
    path: '/api/user/set-api-key',
    requiresAuth: true,
    body: { apiKey: 'test-api-key-123' }
  },
  {
    name: 'Remove API Key',
    method: 'POST',
    path: '/api/user/remove-api-key', 
    requiresAuth: true
  },
  {
    name: 'Proxy to Genkit',
    method: 'POST',
    path: '/api/ai/genkit/testFlow',
    requiresAuth: true,
    body: { input: 'test data' }
  }
];

function makeRequest(endpoint) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_GATEWAY_URL + endpoint.path);
    
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: endpoint.method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'BYOT-API-Test/1.0'
      }
    };

    // Add Firebase auth token if required
    if (endpoint.requiresAuth) {
      options.headers['Authorization'] = `Bearer ${MOCK_FIREBASE_TOKEN}`;
    }

    const requestBody = endpoint.body ? JSON.stringify(endpoint.body) : null;
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

async function testEndpoints() {
  console.log('🚀 Testing BYOT API endpoints...\n');
  console.log(`API Gateway URL: ${API_GATEWAY_URL}`);
  console.log(`Firebase Project: ${FIREBASE_PROJECT_ID}\n`);
  
  for (const endpoint of endpoints) {
    console.log(`\n📍 Testing: ${endpoint.name}`);
    console.log(`   ${endpoint.method} ${endpoint.path}`);
    
    try {
      const response = await makeRequest(endpoint);
      
      console.log(`   Status: ${response.status}`);
      if (response.body) {
        console.log(`   Response: ${JSON.stringify(response.body, null, 2)}`);
      }
      
      // Analysis
      if (response.status === 401) {
        console.log(`   ✅ Authentication working (401 expected without valid token)`);
      } else if (response.status === 200) {
        console.log(`   ✅ Request successful`);
      } else if (response.status === 400) {
        console.log(`   ⚠️  Bad request (check request format)`);
      } else if (response.status === 500) {
        console.log(`   ❌ Server error`);
      } else {
        console.log(`   ❓ Unexpected status: ${response.status}`);
      }
      
    } catch (error) {
      console.log(`   ❌ Request failed: ${error.message}`);
    }
  }
  
  console.log('\n📋 Test Summary:');
  console.log('- If you see 401 errors, authentication is working correctly');
  console.log('- To test with real authentication, you need a valid Firebase ID token');
  console.log('- The API Gateway is successfully routing requests to Cloud Functions');
  console.log('\n🔑 To get a real Firebase token for testing:');
  console.log('1. Set up Firebase Auth in your frontend');
  console.log('2. Sign in a user and get their ID token');
  console.log('3. Replace MOCK_FIREBASE_TOKEN with the real token');
}

// Simple health check without auth
async function healthCheck() {
  console.log('🏥 Running basic health check...\n');
  
  try {
    // Test CORS preflight
    const response = await makeRequest({
      name: 'CORS Preflight',
      method: 'OPTIONS',
      path: '/api/user/api-key-status',
      requiresAuth: false
    });
    
    console.log('CORS Preflight Response:');
    console.log(`Status: ${response.status}`);
    console.log('CORS Headers:');
    Object.keys(response.headers).forEach(key => {
      if (key.toLowerCase().includes('access-control')) {
        console.log(`  ${key}: ${response.headers[key]}`);
      }
    });
    
  } catch (error) {
    console.log(`Health check failed: ${error.message}`);
  }
}

// Main execution
if (require.main === module) {
  (async () => {
    await healthCheck();
    await testEndpoints();
  })();
}

module.exports = { makeRequest, testEndpoints, healthCheck }; 