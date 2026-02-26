# Cloudflare Worker — GitLab CORS Proxy

## When Do You Need This?

When hosting the Gantt app on a **different domain** from your GitLab instance (e.g. GitHub Pages → GitLab API), the browser blocks API requests due to [CORS policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS). This worker acts as a reverse proxy that forwards requests to GitLab and adds the necessary CORS headers.

**You do NOT need this if** you deploy to GitLab Pages on the same domain as your GitLab instance — same-origin requests have no CORS issues.

| Hosting                             | GitLab Instance | CORS Proxy Needed? |
| ----------------------------------- | --------------- | ------------------ |
| GitLab Pages (`gitlab.com`)         | `gitlab.com`    | No                 |
| GitHub Pages (`username.github.io`) | `gitlab.com`    | **Yes**            |
| Any other domain                    | Any GitLab      | **Yes**            |

## How It Works

```
Browser → Cloudflare Worker (CORS Proxy) → GitLab API
                  ↓
        Adds CORS headers to response
```

The worker receives a request like:

```
https://your-worker.workers.dev/https://gitlab.com/api/v4/projects
```

It strips the leading `/`, forwards the request to the real GitLab URL, and returns the response with `Access-Control-Allow-Origin: *` headers.

## Setup

### 1. Configure Allowed Domains

Edit `worker.js` and add your GitLab domain to the `ALLOWED_DOMAINS` array:

```js
const ALLOWED_DOMAINS = [
  'gitlab.com',
  // Add more domains if needed
];
```

### 2. Deploy to Cloudflare Workers

**Option A: Wrangler CLI (Recommended)**

```bash
# Install wrangler
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Initialize (run from this directory)
wrangler init gitlab-cors-proxy

# Deploy
wrangler deploy worker.js --name gitlab-cors-proxy
```

**Option B: Cloudflare Dashboard**

1. Go to [Cloudflare Dashboard → Workers](https://dash.cloudflare.com/?to=/:account/workers)
2. Click **Create a Service**
3. Name it (e.g. `gitlab-cors-proxy`)
4. Paste the contents of `worker.js` into the editor
5. Click **Save and Deploy**

### 3. Configure the Gantt App

Set the `VITE_CORS_PROXY` environment variable to point to your deployed worker:

```env
# .env.production
VITE_CORS_PROXY=https://gitlab-cors-proxy.your-account.workers.dev
```

For GitHub Actions deployment, add it as a repository secret (`CORS_PROXY_URL`) and reference it in the workflow:

```yaml
env:
  VITE_CORS_PROXY: ${{ secrets.CORS_PROXY_URL }}
```

## Security Notes

- The `ALLOWED_DOMAINS` whitelist prevents the proxy from being abused as an open proxy.
- The `X-GitLab-Token` header is converted to `PRIVATE-TOKEN` server-side, so tokens are never exposed in URL parameters.
- Consider restricting `Access-Control-Allow-Origin` to your specific deployment domain instead of `*` for production use.

## Cloudflare Workers Free Tier

- 100,000 requests/day
- No credit card required
- See [Cloudflare Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/) for details
