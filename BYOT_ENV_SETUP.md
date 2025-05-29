# BYOT Environment Setup Guide

## Frontend Configuration

Add the following to your `.env.local` file in the Next.js root directory:

```bash
# BYOT Backend Configuration (API Gateway URL)
NEXT_PUBLIC_GO_BACKEND_URL=https://byot-gateway-1ntw604r.uc.gateway.dev
```

## Backend Configuration (Already Set via Pulumi)

The following are configured in your Pulumi deployment:

- `GCP_PROJECT_ID`: interviewai-mzf86
- `NEXTJS_BASE_URL`: Configured in Pulumi config
- `DEFAULT_GEMINI_API_KEY`: Configured as Pulumi secret

## Verify Configuration

1. **Check Frontend Environment:**
   ```bash
   grep NEXT_PUBLIC_GO_BACKEND_URL .env.local
   ```

2. **Restart Next.js Dev Server:**
   ```bash
   npm run dev
   ```

3. **Test the Integration:**
   - Open your browser's developer console
   - Navigate to the settings page
   - Check the Network tab for API calls to the correct URL

## Troubleshooting

If you still see "Failed to fetch":

1. **Verify the API Gateway URL:**
   ```bash
   curl https://byot-gateway-1ntw604r.uc.gateway.dev/api/user/api-key-status
   ```
   Should return 401 (authentication required)

2. **Check Firebase Token:**
   Use the `simple-token-getter.html` tool to verify your Firebase token is valid

3. **Verify CORS:**
   The API should return these headers:
   - `Access-Control-Allow-Origin: *`
   - `Access-Control-Allow-Methods: POST, GET, OPTIONS, PUT, DELETE, PATCH`
   - `Access-Control-Allow-Headers: Accept, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization` 