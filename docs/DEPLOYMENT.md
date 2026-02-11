# Deployment Guide

This guide explains how to deploy the React Gantt application to GitHub Pages or other static hosting platforms.

## Table of Contents

- [Deployment Options](#deployment-options)
- [GitHub Pages](#github-pages)
- [CORS Issues and Solutions](#cors-issues-and-solutions)

---

## Deployment Options

### GitHub Pages

**Advantages:**

- Free hosting on GitHub
- Custom domain support

**Limitations:**

- CORS issues when accessing external APIs from a different domain
- Requires CORS proxy for cross-origin API calls

**Deployment Steps:**

1. Push your code to GitHub repository:

   ```bash
   git push origin main
   ```

2. Enable GitHub Pages:
   - Go to: Repository Settings > Pages
   - Source: Select "GitHub Actions"

3. GitHub Actions will automatically build and deploy (`.github/workflows/deploy-github-pages.yml`)

4. Your site will be available at:
   ```
   https://<username>.github.io/<repository-name>/
   ```

### Other Static Hosting

You can deploy the built demo to any static hosting provider (Vercel, Netlify, Cloudflare Pages, etc.):

1. Build the demo:

   ```bash
   npm run build:pages
   ```

2. Upload the `dist-demos/` directory to your hosting provider.

---

## CORS Issues and Solutions

### What is CORS?

Cross-Origin Resource Sharing (CORS) is a browser security feature that blocks requests from one domain to another unless explicitly allowed by the server.

### The Problem

When your app is hosted on one domain but tries to access a data source API on a different domain, the browser blocks these requests due to CORS policy.

### Solutions

#### Solution 1: Use CORS Proxy

A CORS proxy acts as a middleman between your app and the data source API.

**Setup Steps:**

1. Choose a CORS proxy option:

   **Option A: Public CORS Proxy (Testing Only)**
   - Not recommended for production
   - Example: `https://cors-anywhere.herokuapp.com`

   **Option B: Deploy Your Own CORS Proxy**
   - Recommended for production
   - See instructions below

2. Configure environment variable:

   Create `.env.production` file:

   ```env
   VITE_CORS_PROXY=https://your-cors-proxy.com
   ```

3. Update GitHub Actions workflow:

   Edit `.github/workflows/deploy-github-pages.yml`:

   ```yaml
   - name: Build
     run: npm run build:pages
     env:
       VITE_BASE_PATH: /react-gantt-gitlab/
       VITE_CORS_PROXY: ${{ secrets.CORS_PROXY_URL }}
   ```

4. Add secret to GitHub:
   - Go to: Repository Settings > Secrets and variables > Actions
   - New repository secret: `CORS_PROXY_URL`
   - Value: Your CORS proxy URL

#### Solution 2: Deploy Your Own CORS Proxy

**Using Cloudflare Workers (Free Tier Available):**

```javascript
// worker.js
addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const targetUrl = url.pathname.slice(1); // Remove leading slash

  // Only allow requests to your data source
  if (!targetUrl.startsWith('https://your-api-domain.com')) {
    return new Response('Forbidden', { status: 403 });
  }

  // Forward the request
  const response = await fetch(targetUrl, {
    method: request.method,
    headers: request.headers,
    body: request.body,
  });

  // Add CORS headers
  const newResponse = new Response(response.body, response);
  newResponse.headers.set('Access-Control-Allow-Origin', '*');
  newResponse.headers.set(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, OPTIONS',
  );
  newResponse.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization',
  );

  return newResponse;
}
```

**Using Vercel Serverless Functions:**

```javascript
// api/proxy.js
export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  try {
    const response = await fetch(url, {
      method: req.method,
      headers: {
        Authorization: req.headers['authorization'] || '',
        'Content-Type': 'application/json',
      },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
    });

    const data = await response.json();

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, OPTIONS',
    );
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization',
    );

    res.status(response.status).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
```

---

## Build Commands

### Local Development

```bash
npm run dev
```

### Build for Production

```bash
# Build demo/pages version
npm run build:pages

# Build library version
npm run build

# Build full CSS
npm run build:full-css
```

### Preview Production Build

```bash
npm run build:pages
npm run preview
```

---

## Environment Variables

Create `.env.local` for local development:

```env
# Data Source Configuration
VITE_DATA_SOURCE_URL=https://your-api-domain.com
VITE_DATA_SOURCE_TOKEN=your-token-here
VITE_DATA_SOURCE_PROJECT_ID=your-project-id

# Optional: CORS Proxy (for production on different domain)
# VITE_CORS_PROXY=https://your-cors-proxy.com
```

**Note:** Never commit `.env.local` or real tokens to git!

---

## Troubleshooting

### Issue: CORS Error on GitHub Pages

**Symptoms:**

```
Access to fetch at 'https://api.example.com/...' has been blocked by CORS policy
```

**Solution:** Use one of the CORS solutions above.

### Issue: 404 on GitHub Pages

**Cause:** Incorrect base path

**Solution:** Check `VITE_BASE_PATH` in GitHub Actions workflow matches your repository name:

```yaml
env:
  VITE_BASE_PATH: /your-repo-name/
```

### Issue: Assets Not Loading

**Cause:** Relative paths not working

**Solution:** Ensure `vite.config.js` has correct base configuration:

```javascript
base: process.env.VITE_BASE_PATH || './';
```

---

## Security Notes

1. **Never commit access tokens** to the repository
2. Use GitHub Secrets for sensitive environment variables
3. If using a CORS proxy, **whitelist only your data source domain**
4. Consider using short-lived tokens or OAuth for production

---

## Additional Resources

- [Vite Deployment Guide](https://vitejs.dev/guide/static-deploy.html)
- [GitHub Pages Documentation](https://docs.github.com/en/pages)
- [CORS MDN Documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
