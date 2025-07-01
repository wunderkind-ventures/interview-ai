set unstable

set script-interpreter := ['uv', 'run', '--script']

hello:
  #!/usr/bin/env uv run --script
  print("Hello from Python!")

# === Ngrok ===
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

# === GCP ===
gcp-auth ENV:
    gcloud auth application-default login
    gcloud auth application-default set-quota-project wkv-interviewai-{{ENV}} 
# gcloud auth activate-service-account --key-file=$GOOGLE_APPLICATION_CREDENTIALS


# === Test Browser ===
# Open Chrome in incognito mode with the local server URL
test-browser:
    open -na "Google Chrome" --args --incognito "http://localhost:9002"

# Option 2: Use a specific browser profile
test-browser-profile:
    open -a "Google Chrome" --args --profile-directory="Profile 1" "http://localhost:9002"

# === Git ===
git-clean:
    git branch --merged | grep -Ev "(^\*|^\+|master|main|dev)" | xargs --no-run-if-empty git branch -d

# === Pulumi ===
gcloud-auth gcloud-auth-key="$HOME/.config/gcp/keys/catalyst-infra-key.json":
    export GOOGLE_APPLICATION_CREDENTIALS={{gcloud-auth-key}}
    gcloud auth activate-service-account --key-file=$GOOGLE_APPLICATION_CREDENTIALS

pulumi-up:
    cd pulumi-gcp-catalyst-backend && pulumi up

pulumi-down:
    cd pulumi-gcp-catalyst-backend && pulumi destroy

pulumi-refresh:
    cd pulumi-gcp-catalyst-backend && pulumi refresh

pulumi-stack-output:
    cd pulumi-gcp-catalyst-backend && pulumi stack output

pulumi-stack-output-json:
    cd pulumi-gcp-catalyst-backend && pulumi stack output --json

pulumi-stack-output-json-pretty:
    cd pulumi-gcp-catalyst-backend && pulumi stack output --json | jq .

pulumi-stack-output-json-pretty-dev:
    cd pulumi-gcp-catalyst-backend && pulumi stack output --json | jq .dev

pulumi-stack-output-json-pretty-staging:
    cd pulumi-gcp-catalyst-backend && pulumi stack output --json | jq .staging

pulumi-dev-configue:
    pulumi stack output dev_service_account_key > dev-service-account-key.json
    ENCRYPTION_KEY=$(openssl rand -base64 32) && pulumi config set --secret ENCRYPTION_KEY "$ENCRYPTION_KEY"
    pulumi config set --secret --path catalyst-gcp-infra:sshPrivateKey < ~/.ssh/pulumi-tunnel

pulumi-staging-configure:
    pulumi stack output staging_service_account_key > staging-service-account-key.json

# # === Pulumi lifecycle ===
# init:
# 	pulumi login
# 	pulumi stack init $(STACK) || echo "Stack already exists"
# 	pulumi config set gcp:project $(shell pulumi config get gcp:project)
# 	pulumi config set gcp:region us-central1
# 	pulumi config set environment $(STACK)

generate-ssh-key:
	ssh-keygen -t rsa -b 4096 -f ~/.ssh/tunnel_rsa -N "" || echo "Key already exists"
	@echo "Public key:" && cat ~/.ssh/tunnel_rsa.pub

configure-ssh-key:
	pulumi config set --secret --path sshKey "$(cat ~/.ssh/tunnel_rsa.pub)"

set-gemini-api-key:
	pulumi config set --secret --path catalyst-gcp-infra:defaultGeminiApiKey "$GEMINI_API_KEY"

pulumi-dev-configure:
    pulumi stack output dev_service_account_key > dev-service-account-key.json
    ENCRYPTION_KEY=$(openssl rand -base64 32) && pulumi config set --secret ENCRYPTION_KEY "$ENCRYPTION_KEY"
    pulumi config set --secret --path catalyst-gcp-infra:sshPrivateKey < ~/.ssh/pulumi-tunnel

# === Pulumi lifecycle ===
init:
	pulumi login && \
	pulumi stack init catalyst-/$(ENV) || echo "Stack already exists" && \
	pulumi config set gcp:project $(shell pulumi config get gcp:project) && \
	pulumi config set gcp:region us-central1 && \
	pulumi config set catalyst:environment $(ENV) && \
	pulumi config set tunnelDomain $(DEV_TUNNEL_DOMAIN) && \
	pulumi config set --secret sshPrivateKey "$(cat ~/.ssh/id_rsa)"

ngrok-dev:
    ngrok http --url=settled-merry-jaguar.ngrok-free.app 9002


# === CI/CD style automation ===
preview ENV:
	pulumi stack select catalyst-/$(ENV) && pulumi preview

deploy ENV:
	pulumi stack select catalyst-/$(ENV) && pulumi up --yes

destroy ENV:
	pulumi stack select catalyst-/$(ENV) && pulumi destroy --yes

outputs ENV:
	pulumi stack select catalyst-/$(ENV) && pulumi stack output

# === Build & format ===
build:
	go build ./...

format:
	go fmt ./...

# === Tunnel commands ===
tunnel-ip:
	pulumi stack output instanceIP

start-tunnel:
	ssh -i ~/.ssh/tunnel_rsa -R 9000:localhost:3000 tunneladmin@$(tunnel-ip)

# === Service Account Creation ===
create-service-account:
    gcloud iam service-accounts create catalyst-infra-service-account --display-name="Catalyst Infra Service Account"

add-service-account-to-project project-name service-account-name=`catalyst-infra` role-name=`roles/iam.serviceAccountUser`:
    gcloud projects add-iam-policy-binding {{project-name}} --member="serviceAccount:{{service-account-name}}-service-account@{{project-name}}.iam.gserviceaccount.com" --role="roles/{{role-name}}"

remove-service-account-from-project project-name service-account-name=`catalyst-infra` role-name=`roles/iam.serviceAccountUser`:
    gcloud projects remove-iam-policy-binding {{project-name}} --member="serviceAccount:{{service-account-name}}-service-account@{{project-name}}.iam.gserviceaccount.com" --role="roles/{{role-name}}"

# === Service Account Key Creation ===
check-service-account-creds:
    gcloud 

# === API Access ===
check-enabled-apis project-name="interviewai-mzf86":
    gcloud services list --enabled --project={{project-name}} --format="value(name)" | sed 's|projects/[0-9]*/services/||' 
# > /tmp/enabled_apis.txt && echo "Found $(wc -l < /tmp/enabled_apis.txt) APIs to replicate"

create-service-account-key:
    gcloud iam service-accounts keys create catalyst-infra-key.json --iam-account=catalyst-infra-service-account@interviewai-mzf86.iam.gserviceaccount.com

enable-apis:
    #!/usr/bin/env bash
    batch_count=0
    for batch_file in /tmp/enabled_apis.txt; do
        ((batch_count++))
        echo "Processing batch $batch_count..."

        # Convert newlines to spaces for the API list
        apis=$(tr '\n' ' ' < "$batch_file")

        # Enable the batch of APIs
        gcloud services enable --project="$PROJECT_ID" $apis

        if [ $? -eq 0 ]; then
            echo "✅ Batch $batch_count completed successfully"
        else
            echo "❌ Batch $batch_count failed"
        fi

        # Clean up batch file
        rm "$batch_file"
    done
# gcloud services enable --project=interviewai-mzf86 $(cat /tmp/enabled_apis.txt)

#  === API Access ====
add-api-access project-name service-account-name=`catalyst-infra` role-name=`roles/aiplatform.user` :
	gcloud projects add-iam-policy-binding {{project-name}} --member="serviceAccount:{{service-account-name}}-service-account@{{project-name}}.iam.gserviceaccount.com" --role="roles/{{role-name}}"

remove-api-access project-name service-account-name=`catalyst-infra` role-name=`roles/aiplatform.user` :
	gcloud projects remove-iam-policy-binding {{project-name}} --member="serviceAccount:{{service-account-name}}-service-account@{{project-name}}.iam.gserviceaccount.com" --role="roles/{{role-name}}"

# === Service Account Roles ===
get-service-account-roles project-name="interviewai-mzf86" service-account-name="catalyst-infra":
	gcloud projects get-iam-policy {{project-name}} --flatten="bindings[].members" --format="table(bindings.role)" --filter="bindings.members:{{service-account-name}}-service-account@{{project-name}}.iam.gserviceaccount.com"