"""Firebase authentication for ADK agents."""

import os
import logging
from typing import Optional, Dict, Any
from functools import wraps
import firebase_admin
from firebase_admin import credentials, auth, firestore
from fastapi import HTTPException, Header, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from .config import settings

logger = logging.getLogger(__name__)

# Initialize Firebase Admin SDK
cred = None
if settings.firebase_credentials_path and os.path.exists(settings.firebase_credentials_path):
    cred = credentials.Certificate(settings.firebase_credentials_path)
elif os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
    cred = credentials.ApplicationDefault()

if cred and not firebase_admin._apps:
    firebase_admin.initialize_app(cred)
    logger.info("Firebase Admin SDK initialized successfully")
else:
    logger.warning("Firebase Admin SDK not initialized - authentication may not work")

# FastAPI security scheme
security = HTTPBearer()


class FirebaseAuth:
    """Firebase authentication handler."""
    
    @staticmethod
    async def verify_token(token: str) -> Dict[str, Any]:
        """Verify Firebase ID token and return user claims."""
        try:
            decoded_token = auth.verify_id_token(token)
            return decoded_token
        except auth.InvalidIdTokenError as e:
            logger.error(f"Invalid ID token: {e}")
            raise HTTPException(status_code=401, detail="Invalid authentication token")
        except auth.ExpiredIdTokenError as e:
            logger.error(f"Expired ID token: {e}")
            raise HTTPException(status_code=401, detail="Token has expired")
        except Exception as e:
            logger.error(f"Error verifying token: {e}")
            raise HTTPException(status_code=401, detail="Authentication failed")
    
    @staticmethod
    async def get_user_claims(token: str) -> Dict[str, Any]:
        """Get user claims from token."""
        decoded_token = await FirebaseAuth.verify_token(token)
        return {
            "uid": decoded_token.get("uid"),
            "email": decoded_token.get("email"),
            "email_verified": decoded_token.get("email_verified", False),
            "custom_claims": decoded_token.get("claims", {}),
        }


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Dict[str, Any]:
    """FastAPI dependency to get current authenticated user."""
    token = credentials.credentials
    return await FirebaseAuth.get_user_claims(token)


async def verify_api_key(
    x_api_key: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None)
) -> Optional[str]:
    """Verify API key from headers."""
    # Check X-API-Key header first
    if x_api_key:
        return x_api_key
    
    # Check Authorization header for API key
    if authorization and authorization.startswith("Bearer "):
        return authorization[7:]
    
    return None


def require_auth(f):
    """Decorator to require authentication for a function."""
    @wraps(f)
    async def decorated_function(*args, **kwargs):
        # Extract token from kwargs or first positional arg
        token = kwargs.get("token") or (args[0] if args else None)
        
        if not token:
            raise HTTPException(status_code=401, detail="No authentication token provided")
        
        try:
            user_claims = await FirebaseAuth.get_user_claims(token)
            kwargs["user_claims"] = user_claims
            return await f(*args, **kwargs)
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Authentication error: {e}")
            raise HTTPException(status_code=401, detail="Authentication failed")
    
    return decorated_function


class FirestoreClient:
    """Firestore client wrapper with authentication context."""
    
    def __init__(self):
        self.db = firestore.client() if firebase_admin._apps else None
    
    def collection(self, path: str):
        """Get a Firestore collection reference."""
        if not self.db:
            raise RuntimeError("Firestore not initialized")
        return self.db.collection(path)
    
    def get_user_data(self, user_id: str, collection: str = "users") -> Optional[Dict[str, Any]]:
        """Get user data from Firestore."""
        try:
            doc = self.collection(collection).document(user_id).get()
            return doc.to_dict() if doc.exists else None
        except Exception as e:
            logger.error(f"Error fetching user data: {e}")
            return None
    
    def set_user_data(self, user_id: str, data: Dict[str, Any], collection: str = "users") -> bool:
        """Set user data in Firestore."""
        try:
            self.collection(collection).document(user_id).set(data, merge=True)
            return True
        except Exception as e:
            logger.error(f"Error setting user data: {e}")
            return False


# Global Firestore client instance
firestore_client = FirestoreClient()


def check_user_permissions(user_claims: Dict[str, Any], required_permission: str) -> bool:
    """Check if user has required permission."""
    custom_claims = user_claims.get("custom_claims", {})
    permissions = custom_claims.get("permissions", [])
    
    return required_permission in permissions or custom_claims.get("admin", False)


def require_permission(permission: str):
    """Decorator to require specific permission."""
    def decorator(f):
        @wraps(f)
        async def decorated_function(*args, **kwargs):
            user_claims = kwargs.get("user_claims")
            if not user_claims:
                raise HTTPException(status_code=401, detail="No user claims found")
            
            if not check_user_permissions(user_claims, permission):
                raise HTTPException(status_code=403, detail=f"Permission '{permission}' required")
            
            return await f(*args, **kwargs)
        return decorated_function
    return decorator