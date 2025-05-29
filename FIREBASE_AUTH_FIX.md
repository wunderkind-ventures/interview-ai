# Firebase Authentication Issue Fix

## 🚨 Problem
You're getting this error when trying to save an API key:
```
Failed to save API key: 401 Unauthorized: invalid Firebase ID token: 
ID token has invalid 'iss' (issuer) claim; expected 
"https://securetoken.google.com/interviewai-mzf86" but got 
"https://accounts.google.com"
```

## 🔍 Root Cause
The token being sent to your backend has the wrong issuer. Your backend expects a Firebase Auth token but is receiving a Google OAuth token.

## 🔧 Quick Diagnosis

Run this in your browser console while on your app (http://localhost:9002):

```javascript
// Check current authentication state
(async () => {
    try {
        // Find Firebase auth - try multiple approaches
        let auth;
        
        // Approach 1: Look for Firebase in window
        if (window.firebase && window.firebase.auth) {
            auth = window.firebase.auth();
        } 
        // Approach 2: Look for auth instance directly
        else if (window.auth) {
            auth = window.auth;
        }
        // Approach 3: Try to get from React context (if available)
        else {
            console.log("❌ Firebase auth not found in window. Trying React DevTools...");
            // Instructions for React DevTools
            console.log("To check via React DevTools:");
            console.log("1. Open React Developer Tools");
            console.log("2. Search for a component using 'useAuth'");
            console.log("3. Check the hooks section for auth context");
            return;
        }
        
        const user = auth.currentUser;
        
        if (!user) {
            console.log("❌ No user is currently signed in");
            return;
        }
        
        console.log("✅ User found:", {
            displayName: user.displayName,
            email: user.email,
            uid: user.uid,
            providerData: user.providerData
        });
        
        // Get and analyze token
        console.log("\n🔍 Getting ID token...");
        const token = await user.getIdToken(true); // Force refresh
        
        // Decode token
        const parts = token.split('.');
        const payload = JSON.parse(atob(parts[1]));
        
        console.log("\n📋 Token Analysis:");
        console.log("Issuer:", payload.iss);
        console.log("Expected:", "https://securetoken.google.com/interviewai-mzf86");
        console.log("Match:", payload.iss === "https://securetoken.google.com/interviewai-mzf86" ? "✅ YES" : "❌ NO");
        
        if (payload.iss !== "https://securetoken.google.com/interviewai-mzf86") {
            console.error("\n🚨 TOKEN ISSUER MISMATCH!");
            console.log("This means you're not using Firebase Authentication properly.");
            console.log("The token is from:", payload.iss);
        }
        
        console.log("\n📄 Full token payload:", payload);
        
        // Test backend
        console.log("\n🧪 Testing backend authentication...");
        const response = await fetch('https://byot-gateway-1ntw604r.uc.gateway.dev/api/user/api-key-status', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        console.log("Backend response:", response.status, result);
        
        if (response.ok) {
            console.log("✅ Backend authentication successful!");
        } else {
            console.error("❌ Backend authentication failed!");
        }
        
    } catch (error) {
        console.error("Error during auth check:", error);
    }
})();
```

## 🛠️ Solutions

### Solution 1: Force Sign Out and Sign In Again

If the token has the wrong issuer, you need to sign out and sign back in:

```javascript
// In your browser console:
(async () => {
    try {
        const auth = window.firebase?.auth() || window.auth;
        if (auth) {
            console.log("Signing out...");
            await auth.signOut();
            console.log("✅ Signed out. Please sign in again using the app's sign-in button.");
        } else {
            console.log("❌ Could not find Firebase auth instance");
        }
    } catch (error) {
        console.error("Error signing out:", error);
    }
})();
```

### Solution 2: Check Firebase Configuration

Verify your Firebase is properly initialized:

```javascript
// Check Firebase config
console.log("Firebase config check:");
console.log("Project ID from env:", process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
console.log("Auth Domain from env:", process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN);

// If using Firebase directly
if (window.firebase) {
    const app = window.firebase.app();
    console.log("Firebase app config:", app.options);
}
```

### Solution 3: Use the Diagnostic Tool

1. Open `test-firebase-auth.html` in your browser
2. Make sure you're signed in to your app first
3. Click "Check Auth Status" to see detailed token analysis

## 📝 Common Causes

1. **Wrong Sign-In Method**: Using Google OAuth directly instead of Firebase Auth
2. **Multiple Firebase Projects**: Signed in with a different Firebase project
3. **Cached Authentication**: Old authentication state cached in browser
4. **Firebase Not Initialized**: Firebase SDK not properly initialized

## ✅ Expected Token Structure

A valid Firebase token should have:
- **Issuer (iss)**: `https://securetoken.google.com/interviewai-mzf86`
- **Audience (aud)**: `interviewai-mzf86`
- **Auth Time (auth_time)**: Unix timestamp
- **User ID (user_id)**: Firebase user UID

## 🔄 Next Steps

1. Run the diagnosis script above
2. If issuer is wrong, sign out and sign in again
3. Make sure you're using the "Sign in with Google" button in your app
4. Check that Firebase is properly initialized
5. Try the test-firebase-auth.html tool for more details

## 🚀 Testing After Fix

Once you've signed in properly, test the API key save:

```javascript
// Test saving an API key
(async () => {
    try {
        const auth = window.firebase?.auth() || window.auth;
        const user = auth?.currentUser;
        
        if (!user) {
            console.log("❌ Not signed in");
            return;
        }
        
        const token = await user.getIdToken();
        
        const response = await fetch('https://byot-gateway-1ntw604r.uc.gateway.dev/api/user/set-api-key', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                apiKey: 'test-api-key-12345'
            })
        });
        
        const result = await response.json();
        console.log("Save API key result:", response.status, result);
        
    } catch (error) {
        console.error("Error testing API key save:", error);
    }
})();
``` 