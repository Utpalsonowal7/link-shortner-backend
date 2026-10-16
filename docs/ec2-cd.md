# EC2 continuous deployment (Neon + local Redis)

The backend stays on EC2; the frontend stays on Vercel. This workflow deploys
only successful **push-to-main Backend CI** runs, using their exact commit SHA.
It does not deploy PRs or bypass CI with a manual deploy button.

GitHub obtains temporary AWS credentials with OIDC, then invokes Systems Manager
Run Command. No AWS access keys or SSH private keys are stored in GitHub.
Keep SSH restricted to your IP; no runner SSH ingress is needed.

## One-time AWS setup

Use the existing account administrator session to configure these roles.
The two roles are different: one belongs to EC2 and one to GitHub.

1. Create an IAM role named `lnkshrt-ec2-ssm`, trusted by AWS service **EC2**.
   Attach AWS managed policy **AmazonSSMManagedInstanceCore**.
2. In EC2, select your existing instance → Actions → Security → Modify IAM role.
   Attach `lnkshrt-ec2-ssm`. This does not require creating another instance.
3. Verify/install SSM Agent using AWS's instructions for your Ubuntu version.
   Ubuntu AWS images often include the snap package. Check:
   `sudo snap services amazon-ssm-agent`. If installed but stopped:
   `sudo snap start amazon-ssm-agent`.
   If absent, follow the linked AWS installation instructions.
   Wait until the instance is **Online** in Systems Manager → Fleet Manager.
   The agent needs outbound HTTPS to regional SSM endpoints.
4. In IAM → Identity providers, add OpenID Connect:
   provider URL `https://token.actions.githubusercontent.com`,
   audience `sts.amazonaws.com` (reuse it if already present).
5. Create role `lnkshrt-github-deploy` with the trust policy below.
   Replace `ACCOUNT_ID`. The environment name must be exactly `production`.

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
    },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
        "token.actions.githubusercontent.com:sub": "repo:Utpalsonowal7/link-shortner-backend:environment:production"
      }
    }
  }]
}
```

Attach this inline permissions policy to the GitHub role. Replace `REGION`,
`ACCOUNT_ID`, and `INSTANCE_ID`. It permits remote commands on that instance,
so protect main and the production environment.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "ssm:SendCommand",
      "Resource": [
        "arn:aws:ssm:REGION::document/AWS-RunShellScript",
        "arn:aws:ec2:REGION:ACCOUNT_ID:instance/INSTANCE_ID"
      ]
    },
    {
      "Effect": "Allow",
      "Action": "ssm:GetCommandInvocation",
      "Resource": "*"
    }
  ]
}
```

## GitHub configuration

Repository Settings → Environments → create **production**.
Restrict deployment branches to **main**. Optionally require your approval
before each deployment, if available on your GitHub plan.

Add these environment **variables** (not secrets):

| Variable | Value |
| --- | --- |
| `AWS_REGION` | Your EC2 region, currently `ap-southeast-2` |
| `EC2_INSTANCE_ID` | The instance ID, starting with `i-` (not its IP) |
| `AWS_DEPLOY_ROLE_ARN` | ARN of `lnkshrt-github-deploy` |

Database/OAuth/app credentials remain in the existing server `.env`.
Do not upload that file or your `.pem` key to GitHub.

## Server requirements and first run

- Existing clone at `/home/ubuntu/apps/link-shortner-backend`, owned by ubuntu.
- Existing Docker Engine, Compose, curl, git, flock; ubuntu must be able to use
  `sudo -n docker` (the default Ubuntu EC2 sudo setup supports this).
- A configured `.env` with Neon DATABASE_URL including its TLS parameters.
- Nginx/Certbot already forwarding HTTPS `l.utpx.in` to `127.0.0.1:8080`.
- No tracked local modifications: deployment refuses to overwrite them.
  Untracked `.env` and your manual `compose.aws.yaml` are preserved.

Merge this PR **after setup is complete**. Successful main CI then triggers CD.
If main CI already completed before setup, rerun its full workflow on the latest
main commit; the successful push event's rerun triggers deployment.

The new tracked `compose.ec2.yaml` uses the same `link-shortner-backend`
Compose project name and service names as your manual deployment. That preserves
the existing Redis volume. It does not start PostgreSQL. Do not deploy with both
Compose files together or run the original local-development compose file.

## Deployment and failure behavior

The script serializes deployments with flock and skips commits superseded on
main. It builds before replacing API, starts/verifies Redis, runs
`prisma migrate deploy`, recreates API, and checks local/public health.
Build or migration failures leave the previous API running. A failure while
replacing/starting API may require manual recovery; this is not zero downtime.
Migrations are not automatically rolled back. Use backward-compatible migrations
and create a Neon backup/branch before destructive schema changes.

No image pruning or volume removal is automatic. Monitor disk space with
`df -h /` and `sudo docker system df`. Docker console logs rotate at 10MB × 3
per container; application file logs inside the container follow the application's
own settings and are not made persistent by this change.

Check GitHub Actions → Deploy backend to EC2 for status, and Systems Manager →
Run Command for the command's output. Command output can contain database error
details; inspect privately and redact credentials before sharing.

On EC2:

```bash
cd ~/apps/link-shortner-backend
sudo docker compose -p link-shortner-backend -f compose.ec2.yaml ps -a
sudo docker compose -p link-shortner-backend -f compose.ec2.yaml logs --tail=100 api
cat .git/ec2-last-success
```

For manual API image recovery (schema must remain compatible), use a known
previous successful commit whose image still exists:

```bash
DEPLOY_SHA=PREVIOUS_SUCCESSFUL_SHA sudo -E docker compose \
  -p link-shortner-backend -f compose.ec2.yaml up -d --no-deps api
```

This only changes the API image; it does not revert the schema. Restore or fix
migrations deliberately rather than running migrate reset.

References:
- https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws
- https://docs.aws.amazon.com/systems-manager/latest/userguide/walkthrough-cli.html
- https://docs.aws.amazon.com/systems-manager/latest/userguide/agent-install-ubuntu-64-snap.html
