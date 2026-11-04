# Security Policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Use GitHub's private vulnerability reporting:

<https://github.com/ChasePassion/parlasoul-frontend/security/advisories/new>

Include a description, impact, affected commit or route, and reproduction
steps. You will receive an acknowledgment after the report is reviewed.

## Scope

In scope:

- authentication and session handling flaws
- authorization bypasses in BFF routes
- cross-site scripting, request forgery, and open redirects
- exposure of secrets, tokens, or personal data
- payment or entitlement manipulation from the client

Out of scope:

- issues in third-party providers (report them upstream)
- issues that require a compromised local environment
- scanner output without a demonstrated impact

## Supported versions

Security fixes are applied to the default branch. Older commits and forks are
not maintained.

## Handling secrets

The repository is public. Never commit API keys, session secrets, database
credentials, production hostnames, or customer data. Use `.env.local` locally and
repository secrets in CI. If a secret is committed by accident, rotate it first,
then remove it from history.
