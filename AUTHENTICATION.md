# Authentication Guide

dot.ai uses Claude Code for AI-powered generation. There are two ways to authenticate.

## Method 1: Claude Max/Pro Plan ⭐ (Recommended)

**Best for:** Individual developers with Claude.ai subscription

### Setup

1. **Subscribe to Claude Max or Pro**
   - Visit: https://claude.ai/settings/subscription
   - Choose Max ($20/month) or Pro plan

2. **Install Claude Code**
   ```bash
   npm install -g @anthropic/claude-code
   ```

3. **Authenticate via browser**
   ```bash
   claude --login
   ```

   This will open your browser to authenticate with your Claude.ai account.

4. **Use dot.ai**
   ```bash
   dot gen
   ```

   No API key needed! Uses your Claude.ai subscription automatically.

### Advantages

- ✅ No API key management
- ✅ Works immediately after login
- ✅ Included in your subscription
- ✅ Browser-based authentication (secure)

## Method 2: API Key

**Best for:** Teams, CI/CD, automated workflows, AWS Bedrock users

### Setup

1. **Get an API key**
   - Console: https://console.anthropic.com/
   - AWS Bedrock: https://console.aws.amazon.com/bedrock/
   - GCP Vertex: https://console.cloud.google.com/

2. **Set environment variable**

   **Linux/macOS:**
   ```bash
   export ANTHROPIC_API_KEY=sk-ant-...
   ```

   **Windows (PowerShell):**
   ```powershell
   $env:ANTHROPIC_API_KEY="sk-ant-..."
   ```

3. **Make it permanent**

   **Linux/macOS (~/.bashrc or ~/.zshrc):**
   ```bash
   echo 'export ANTHROPIC_API_KEY=sk-ant-...' >> ~/.bashrc
   source ~/.bashrc
   ```

   **Windows (System Environment Variables):**
   ```powershell
   [System.Environment]::SetEnvironmentVariable('ANTHROPIC_API_KEY', 'sk-ant-...', 'User')
   ```

4. **Use dot.ai**
   ```bash
   dot gen
   ```

### Advantages

- ✅ Works in CI/CD pipelines
- ✅ Team sharing (separate API keys per member)
- ✅ Works with AWS Bedrock and GCP Vertex
- ✅ Programmatic usage

### For CI/CD

GitHub Actions example:
```yaml
- name: Generate from .ai files
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  run: |
    npm install -g @dean0x/dot
    dot gen
```

GitLab CI example:
```yaml
generate:
  script:
    - npm install -g @dean0x/dot
    - dot gen
  variables:
    ANTHROPIC_API_KEY: $ANTHROPIC_API_KEY
```

## Verification

Check if you're authenticated:

```bash
# Test claude-code directly
claude -p "hello"

# If authenticated, you'll get a response
# If not authenticated, you'll see an error
```

## Troubleshooting

### "Not authenticated"

**If using Max/Pro plan:**
```bash
claude --login
```

**If using API key:**
```bash
# Check if set
echo $ANTHROPIC_API_KEY

# Should output: sk-ant-...
# If empty, set it again
```

### "API key not found"

Make sure you're using the correct environment variable name:
- ✅ `ANTHROPIC_API_KEY`
- ❌ `CLAUDE_API_KEY`
- ❌ `API_KEY`

### "Rate limit exceeded"

You're making too many requests. Wait a few minutes and try again.

For API key users: Check your usage at https://console.anthropic.com/

## Cost

### Claude Max/Pro Plan
- **Fixed cost:** $20/month (Max) or Pro pricing
- **Unlimited usage** within fair use limits
- **No per-request billing**

### API Key
- **Pay per use:** Based on tokens
- **Typical costs:**
  - Simple function: ~$0.01-0.05
  - Complex component: ~$0.10-0.50
  - Full project: ~$0.50-2.00
- **Check pricing:** https://www.anthropic.com/pricing

## Security Best Practices

### API Keys

1. **Never commit API keys to git**
   ```bash
   # Add to .gitignore
   echo '.env' >> .gitignore
   ```

2. **Use environment variables**
   ```bash
   # Don't hardcode
   ANTHROPIC_API_KEY=sk-ant-...  # ❌ Bad

   # Use env vars
   export ANTHROPIC_API_KEY=sk-ant-...  # ✅ Good
   ```

3. **Rotate keys regularly**
   - Generate new keys monthly
   - Revoke old keys

4. **Use separate keys for dev/prod**
   - Development: One key
   - Production: Different key

### Claude Max/Pro

1. **Use browser authentication**
   - More secure than API keys
   - Automatic session management

2. **Don't share credentials**
   - Each team member should have their own account

## Which Method Should I Use?

| Scenario | Recommended |
|----------|-------------|
| Individual developer | **Max/Pro Plan** |
| Team collaboration | **API Keys** (one per member) |
| CI/CD pipeline | **API Key** |
| Open source project | **API Key** (from secrets) |
| Quick prototype | **Max/Pro Plan** |
| Production system | **API Key** |

## Support

- Claude Code docs: https://docs.claude.com/en/docs/claude-code
- API documentation: https://docs.anthropic.com/
- dot.ai issues: https://github.com/dean0x/dot.ai/issues
