'use client';

import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebase'; // Adjust import path to your Firebase config

export default function TokenButton() {
  const [user] = useAuthState(auth);

  const getToken = async () => {
    if (!user) {
      alert('Please sign in first');
      return;
    }

    try {
      const token = await user.getIdToken(true);
      console.log('🔑 Firebase ID Token:', token);
      await navigator.clipboard.writeText(token);
      alert('Token copied to clipboard! Check console for full token.');
      
      // Also show in alert for easy copying
      prompt('Firebase ID Token (Ctrl+C to copy):', token);
    } catch (error) {
      console.error('Error getting token:', error);
      alert('Error getting token');
    }
  };

  if (!user) {
    return <div className="p-4 bg-yellow-100 rounded">Please sign in to get token</div>;
  }

  return (
    <div className="p-4 bg-blue-100 rounded">
      <p className="mb-2">Signed in as: {user.email}</p>
      <button 
        onClick={getToken}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Get Firebase Token
      </button>
    </div>
  );
} 