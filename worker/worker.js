// Cloudflare Worker for GitLab CORS Proxy
addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request));
});

// ===== Configuration =====
// Add your allowed GitLab domains here
const ALLOWED_DOMAINS = [
  'gitlab.com',
  // 'gitlab.yourdomain.com',
];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, PRIVATE-TOKEN, X-GitLab-Token',
  'Access-Control-Max-Age': '86400',
};

function isDomainAllowed(url) {
  return ALLOWED_DOMAINS.some((domain) => url.includes(domain));
}

function addCorsHeaders(response) {
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

async function handleRequest(request) {
  const url = new URL(request.url);

  // Handle CORS preflight OPTIONS request
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  // Extract target GitLab URL from the URL path
  // e.g.: https://your-worker.workers.dev/https://gitlab.com/api/v4/user
  const targetUrl = url.pathname.slice(1) + url.search; // Remove leading /

  // Security check: only allow configured domains
  if (!isDomainAllowed(targetUrl)) {
    return new Response('Forbidden: Domain not in allowed list', {
      status: 403,
    });
  }

  try {
    // Clone original request headers
    const headers = new Headers(request.headers);

    // Convert X-GitLab-Token to PRIVATE-TOKEN if present
    if (headers.has('X-GitLab-Token')) {
      headers.set('PRIVATE-TOKEN', headers.get('X-GitLab-Token'));
      headers.delete('X-GitLab-Token');
    }

    // Forward request to GitLab
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: headers,
      body:
        request.method !== 'GET' && request.method !== 'HEAD'
          ? await request.blob()
          : null,
    });

    return addCorsHeaders(new Response(response.body, response));
  } catch (error) {
    return new Response(`Error: ${error.message}`, {
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  }
}
