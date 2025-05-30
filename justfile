# Option 1: Quick Incognito Test (RECOMMENDED)

# Set up Google Cloud credentials
export GOOGLE_APPLICATION_CREDENTIALS="$HOME/pulumi-sa-key.json"
gcloud auth activate-service-account --key-file=$GOOGLE_APPLICATION_CREDENTIALS

# Open Chrome in incognito mode with the local server URL
open -na "Google Chrome" --args --incognito "http://localhost:9002"

# Option 2: Use a specific browser profile
# open -a "Google Chrome" --args --profile-directory="Profile 1" "http://localhost:9002"