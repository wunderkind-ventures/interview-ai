'use client';

import { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

export default function FirebaseTokenHelper() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (!user) {
        setToken('');
      }
    });

    return () => unsubscribe();
  }, []);

  const getToken = async () => {
    if (!user) {
      alert('Please sign in first');
      return;
    }

    setLoading(true);
    try {
      const idToken = await user.getIdToken(true); // Force refresh
      setToken(idToken);
      console.log('Firebase ID Token:', idToken);
    } catch (error) {
      console.error('Error getting token:', error);
      alert('Error getting token: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToken = async () => {
    if (token) {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const testApiCall = async () => {
    if (!token) {
      alert('Get token first');
      return;
    }

    const apiUrl = 'https://byot-gateway-1ntw604r.uc.gateway.dev';
    
    try {
      const response = await fetch(`${apiUrl}/api/user/api-key-status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      console.log('API Response:', data);
      alert(`API Response (${response.status}): ${JSON.stringify(data, null, 2)}`);
    } catch (error) {
      console.error('API call failed:', error);
      alert('API call failed: ' + error.message);
    }
  };

  const testSetApiKey = async () => {
    if (!token) {
      alert('Get token first');
      return;
    }

    const apiKey = prompt('Enter a test API key:');
    if (!apiKey) return;

    const apiUrl = 'https://byot-gateway-1ntw604r.uc.gateway.dev';
    
    try {
      const response = await fetch(`${apiUrl}/api/user/set-api-key`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey }),
      });

      const data = await response.json();
      console.log('Set API Key Response:', data);
      alert(`Set API Key Response (${response.status}): ${JSON.stringify(data, null, 2)}`);
    } catch (error) {
      console.error('Set API key failed:', error);
      alert('Set API key failed: ' + error.message);
    }
  };

  if (!user) {
    return (
      <div className="p-6 border border-gray-300 rounded-lg bg-yellow-50">
        <h3 className="text-lg font-semibold mb-4">🔑 Firebase Token Helper</h3>
        <p className="text-gray-600">Please sign in to get your Firebase ID token for API testing.</p>
      </div>
    );
  }

  return (
    <div className="p-6 border border-gray-300 rounded-lg bg-gray-50">
      <h3 className="text-lg font-semibold mb-4">🔑 Firebase Token Helper</h3>
      
      <div className="mb-4">
        <p className="text-sm text-gray-600">
          Signed in as: <strong>{user.email}</strong>
        </p>
        <p className="text-sm text-gray-600">
          UID: <code className="bg-gray-200 px-1 rounded">{user.uid}</code>
        </p>
      </div>

      <div className="space-y-3">
        <button
          onClick={getToken}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Getting Token...' : 'Get Firebase ID Token'}
        </button>

        {token && (
          <div className="space-y-2">
            <div className="p-3 bg-white border rounded">
              <p className="text-sm font-medium mb-2">Firebase ID Token:</p>
              <div className="font-mono text-xs break-all bg-gray-100 p-2 rounded">
                {token.substring(0, 50)}...{token.substring(token.length - 20)}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Full token logged to console and ready for copy
              </p>
            </div>
            
            <div className="flex space-x-2">
              <button
                onClick={copyToken}
                className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
              >
                {copied ? 'Copied!' : 'Copy Token'}
              </button>
              
              <button
                onClick={testApiCall}
                className="px-3 py-1 bg-purple-500 text-white rounded hover:bg-purple-600 text-sm"
              >
                Test API Status
              </button>
              
              <button
                onClick={testSetApiKey}
                className="px-3 py-1 bg-orange-500 text-white rounded hover:bg-orange-600 text-sm"
              >
                Test Set API Key
              </button>
            </div>
          </div>
        )}
      </div>
      
      <div className="mt-4 text-xs text-gray-500">
        <p>💡 This component is for testing. Remove it before production.</p>
        <p>🔍 Check browser console for full token and API responses.</p>
      </div>
    </div>
  );
} 