# How to Get Firebase ID Tokens for Testing

## Method 1: Browser Console (Quickest)

1. **Open your Next.js app** in the browser and **sign in** with Firebase Auth
2. **Open browser developer tools** (F12 or right-click → Inspect)
3. **Go to the Console tab**
4. **Paste and run this code**:

```javascript
// Get Firebase Auth instance and current user
import { getAuth } from 'firebase/auth';

const auth = getAuth();
const user = auth.currentUser;

if (user) {
  // Get ID token
  user.getIdToken().then(token => {
    console.log('🔑 Firebase ID Token:');
    console.log(token);
    
    // Copy to clipboard
    navigator.clipboard.writeText(token).then(() => {
      console.log('✅ Token copied to clipboard!');
    });
    
    // Also show user info
    console.log('👤 User Info:', {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName
    });
  });
} else {
  console.log('❌ No user signed in');
}
```

## Method 2: Add Temporary Component

1. **Create a new file** in your Next.js app: `components/FirebaseTokenHelper.tsx`
2. **Copy the component** from `firebase-token-helper.tsx` (created above)
3. **Add it to any page** where you can sign in:

```tsx
// In your page or component
import FirebaseTokenHelper from '@/components/FirebaseTokenHelper';

export default function TestPage() {
  return (
    <div>
      {/* Your existing content */}
      
      {/* Temporary testing component */}
      <FirebaseTokenHelper />
    </div>
  );
}
```

4. **Sign in and click "Get Firebase ID Token"**
5. **Copy the token** and use it for API testing

## Method 3: Add to Existing Auth Context

If you already have an auth context/provider, add this function:

```typescript
// In your auth context or component
import { getAuth } from 'firebase/auth';

const getIdTokenForTesting = async () => {
  const auth = getAuth();
  const user = auth.currentUser;
  
  if (!user) {
    console.log('No user signed in');
    return null;
  }
  
  try {
    const token = await user.getIdToken(true); // Force refresh
    console.log('Firebase ID Token:', token);
    
    // Copy to clipboard
    await navigator.clipboard.writeText(token);
    console.log('Token copied to clipboard!');
    
    return token;
  } catch (error) {
    console.error('Error getting token:', error);
    return null;
  }
};

// Call this function anywhere in your app after user is signed in
```

## Method 4: Quick Test Button

Add this anywhere in your app where you're signed in:

```tsx
'use client';

import { getAuth } from 'firebase/auth';

function TokenTestButton() {
  const getToken = async () => {
    const auth = getAuth();
    const user = auth.currentUser;
    
    if (!user) {
      alert('Please sign in first');
      return;
    }
    
    try {
      const token = await user.getIdToken(true);
      console.log('🔑 Firebase ID Token:', token);
      await navigator.clipboard.writeText(token);
      alert('Token copied to clipboard! Check console for full token.');
    } catch (error) {
      console.error('Error:', error);
      alert('Error getting token');
    }
  };

  return (
    <button 
      onClick={getToken}
      className="px-4 py-2 bg-blue-500 text-white rounded"
    >
      Get Firebase Token
    </button>
  );
}
```

## Method 5: Test with Curl

Once you have the token, test it with curl:

```bash
# Replace YOUR_TOKEN_HERE with the actual token
export FIREBASE_TOKEN="YOUR_TOKEN_HERE"

# Test API key status
curl -X GET "https://byot-gateway-1ntw604r.uc.gateway.dev/api/user/api-key-status" \
  -H "Authorization: Bearer $FIREBASE_TOKEN" \
  -H "Content-Type: application/json"

# Test setting an API key
curl -X POST "https://byot-gateway-1ntw604r.uc.gateway.dev/api/user/set-api-key" \
  -H "Authorization: Bearer $FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"apiKey":"your-test-gemini-api-key"}'

# Test getting API key status again
curl -X GET "https://byot-gateway-1ntw604r.uc.gateway.dev/api/user/api-key-status" \
  -H "Authorization: Bearer $FIREBASE_TOKEN" \
  -H "Content-Type: application/json"

# Test removing API key
curl -X POST "https://byot-gateway-1ntw604r.uc.gateway.dev/api/user/remove-api-key" \
  -H "Authorization: Bearer $FIREBASE_TOKEN" \
  -H "Content-Type: application/json"
```

## ⚠️ Important Notes

1. **Token Expiration**: Firebase ID tokens expire after 1 hour. Use `getIdToken(true)` to force refresh.

2. **Security**: Never commit tokens to code or share them. Only use for testing.

3. **Project Verification**: Make sure your Firebase project ID matches `interviewai-mzf86`.

4. **User Authentication**: The user must be properly signed in through Firebase Auth.

## 🧪 Quick Verification

After getting a token, you can verify it's working by checking:

```javascript
// Decode token payload (doesn't verify signature)
const payload = JSON.parse(atob(token.split('.')[1]));
console.log('Token payload:', payload);

// Should show:
// - aud: "interviewai-mzf86"  
// - iss: "https://securetoken.google.com/interviewai-mzf86"
// - user_id: your user ID
// - exp: expiration timestamp
```

## 🎯 Recommended Approach

1. **Use Method 1 (Browser Console)** for quick testing
2. **Use Method 2 (Component)** for repeated testing during development
3. **Remove testing code** before production deployment

This should give you everything you need to get Firebase tokens and test your BYOT API! 