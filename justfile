# Option 1: Quick Incognito Test (RECOMMENDED)

ngrok-stop:
    ngrok http --url=interview-ai.ngrok.app 9002

ngrok-start:
    ngrok http --url=interview-ai.ngrok.app 9002

ngrok-status:
    ngrok status

ngrok-logs:
    ngrok logs

ngrok-config:
    curl ifconfig.me >> ngrok-config.txt
    ssh -R 9002:localhost:9002 ubuntu@138.201.134.10

git-clean:
    git branch --merged | grep -Ev "(^\*|^\+|master|main|dev)" | xargs --no-run-if-empty git branch -d

pulumi-sa:
    # Set up Google Cloud credentials
    export GOOGLE_APPLICATION_CREDENTIALS="$HOME/pulumi-sa-key.json" && gcloud auth activate-service-account --key-file=$GOOGLE_APPLICATION_CREDENTIALS

pulumi-deployer:
    export GOOGLE_APPLICATION_CREDENTIALS="$HOME/pulumi-deployer-key.json"
    gcloud auth activate-service-account --key-file=$GOOGLE_APPLICATION_CREDENTIALS

pulumi-up: pulumi-sa
    cd pulumi-gcp-catalyst-backend && pulumi up

pulumi-down: pulumi-sa
    cd pulumi-gcp-catalyst-backend && pulumi destroy

pulumi-refresh: pulumi-sa
    cd pulumi-gcp-catalyst-backend && pulumi refresh

pulumi-stack-output: pulumi-sa
    cd pulumi-gcp-catalyst-backend && pulumi stack output

pulumi-stack-output-json: pulumi-sa
    cd pulumi-gcp-catalyst-backend && pulumi stack output --json

pulumi-stack-output-json-pretty: pulumi-sa
    cd pulumi-gcp-catalyst-backend && pulumi stack output --json | jq .

test-browser:
    # Open Chrome in incognito mode with the local server URL
    open -na "Google Chrome" --args --incognito "http://localhost:9002"

test-browser-profile:
    # Option 2: Use a specific browser profile
    open -a "Google Chrome" --args --profile-directory="Profile 1" "http://localhost:9002"

add-pulumi-encryption-key:
    ENCRYPTION_KEY=$(openssl rand -base64 32) && pulumi config set --secret ENCRYPTION_KEY "$ENCRYPTION_KEY"

# === Pulumi lifecycle ===
init:
	pulumi login
	pulumi stack init $(STACK) || echo "Stack already exists"
	pulumi config set gcp:project $(shell pulumi config get gcp:project)
	pulumi config set gcp:region us-central1
	pulumi config set environment $(STACK)

generate-ssh-key:
	ssh-keygen -t rsa -b 4096 -f ~/.ssh/tunnel_rsa -N "" || echo "Key already exists"
	@echo "Public key:" && cat ~/.ssh/tunnel_rsa.pub

configure-ssh-key:
	pulumi config set --path sshKey "$(shell cat ~/.ssh/tunnel_rsa.pub)"

preview:
	pulumi preview

up:
	pulumi up --yes

destroy:
	pulumi destroy --yes

refresh:
	pulumi refresh --yes

outputs:
	pulumi stack output

# === Build & format ===
build:
	go build ./...

format:
	go fmt ./...

# === Tunnel commands ===
tunnel-ip:
	pulumi stack output instanceIP

start-tunnel:
	ssh -i ~/.ssh/tunnel_rsa -R 9000:localhost:3000 tunneladmin@$(just 9-tunnel-ip)
