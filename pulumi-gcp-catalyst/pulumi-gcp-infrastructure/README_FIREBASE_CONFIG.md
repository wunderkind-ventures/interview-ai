# Firebase Configuration Notes

## Pulumi API Changes

The Pulumi GCP provider v7.38.0 has made some changes to the Firebase resources:

1. **Service API Enablement**: Changed from `serviceusage.NewService` to `projects.NewService`
2. **Firebase Database**: Removed `LocationId` field from `DatabaseInstanceArgs`
3. **Firebase Storage**: Removed `Location` field from `StorageBucketArgs`
4. **Firebase WebApp**: Some fields like `ApiKey`, `MessagingSenderId`, and `MeasurementId` are no longer directly exposed

## Manual Configuration Required

Due to Pulumi provider limitations, some Firebase configuration values need to be set manually:

1. **Firebase API Key**: Get from Firebase Console > Project Settings > Web App
2. **Messaging Sender ID**: Get from Firebase Console > Project Settings > Cloud Messaging
3. **Measurement ID**: Get from Firebase Console > Project Settings > Web App (Google Analytics)

## Setting Configuration Values

After deploying the infrastructure stack, you'll need to:

1. Go to the [Firebase Console](https://console.firebase.google.com)
2. Select your project (e.g., `wkv-interviewai-dev`)
3. Navigate to Project Settings
4. Find your Web App configuration
5. Update the Pulumi configuration with the actual values:

```bash
pulumi config set --secret firebaseApiKey "your-actual-api-key"
pulumi config set --secret firebaseMessagingSenderId "your-sender-id"
pulumi config set --secret firebaseMeasurementId "your-measurement-id"
```

Then update the `firebase.go` file to use these configuration values instead of empty strings.

## Alternative Approach

Consider using the Firebase Admin SDK or gcloud CLI to fetch these values programmatically after the Firebase project is created. This would make the setup fully automated.