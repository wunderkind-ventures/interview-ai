# Option 1: Quick Incognito Test (RECOMMENDED)

pulumi-sa:
    # Set up Google Cloud credentials
    export GOOGLE_APPLICATION_CREDENTIALS="$HOME/pulumi-sa-key.json"
    gcloud auth activate-service-account --key-file=$GOOGLE_APPLICATION_CREDENTIALS

pulumi-up: pulumi-sa
    cd pulumi-gcp-byot-backend && pulumi up

pulumi-down: pulumi-sa
    cd pulumi-gcp-byot-backend && pulumi destroy

pulumi-refresh: pulumi-sa
    cd pulumi-gcp-byot-backend && pulumi refresh

pulumi-stack-output: pulumi-sa
    cd pulumi-gcp-byot-backend && pulumi stack output

pulumi-stack-output-json: pulumi-sa
    cd pulumi-gcp-byot-backend && pulumi stack output --json

pulumi-stack-output-json-pretty: pulumi-sa
    cd pulumi-gcp-byot-backend && pulumi stack output --json | jq .

test-browser:
    # Open Chrome in incognito mode with the local server URL
    open -na "Google Chrome" --args --incognito "http://localhost:9002"

test-browser-profile:
    # Option 2: Use a specific browser profile
    open -a "Google Chrome" --args --profile-directory="Profile 1" "http://localhost:9002"