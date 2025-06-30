"""Cloud Functions Gen2 entry point using functions-framework.

This wraps the FastAPI app to work with Google Cloud Functions Gen2.
"""

import functions_framework
from api_server import app

# Create the Cloud Functions handler
@functions_framework.http
def handle_request(request):
    """Handle HTTP requests in Cloud Functions.
    
    This function serves as the entry point for Cloud Functions Gen2.
    It processes incoming HTTP requests using the FastAPI app.
    """
    # Import FastAPI's request handling
    from fastapi import Request
    from fastapi.responses import JSONResponse
    import asyncio
    
    # Create a new event loop for this request
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    try:
        # Convert the Cloud Functions request to FastAPI format
        scope = {
            "type": "http",
            "method": request.method,
            "path": request.path,
            "query_string": request.query_string.encode() if request.query_string else b"",
            "headers": [(k.encode(), v.encode()) for k, v in request.headers.items()],
            "server": ("localhost", 8080),
            "scheme": "https" if request.scheme == "https" else "http",
        }
        
        # Get request body
        body = request.get_data()
        
        # Create async receive callable
        async def receive():
            return {
                "type": "http.request",
                "body": body,
            }
        
        # Store response data
        response_data = {}
        
        # Create async send callable
        async def send(message):
            if message["type"] == "http.response.start":
                response_data["status"] = message["status"]
                response_data["headers"] = message.get("headers", [])
            elif message["type"] == "http.response.body":
                response_data["body"] = message.get("body", b"")
        
        # Run the FastAPI app
        loop.run_until_complete(app(scope, receive, send))
        
        # Build response
        response_body = response_data.get("body", b"").decode("utf-8")
        response_headers = {
            k.decode(): v.decode() 
            for k, v in response_data.get("headers", [])
        }
        
        return (response_body, response_data.get("status", 200), response_headers)
        
    except Exception as e:
        import traceback
        return JSONResponse(
            status_code=500,
            content={"error": str(e), "traceback": traceback.format_exc()}
        )
    finally:
        loop.close()