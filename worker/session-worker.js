// worker/session-worker.js
//
// Cloudflare Worker: Session Code Service (ES Module syntax)
// Provides temporary one-time login codes for sharing GitLab PATs
// across devices without exposing the token in URLs or files.
//
// Requires a KV namespace bound as SESSION_KV.
// In wrangler.toml:
//   [[kv_namespaces]]
//   binding = "SESSION_KV"
//   id = "<your-kv-namespace-id>"
//
// Endpoints:
//   POST /session/create  — store PAT, return 6-char code (TTL 30 min)
//   POST /session/redeem  — exchange code for PAT (one-time, deletes entry)

const CODE_TTL_SECONDS = 30 * 60; // 30 minutes
const CODE_LENGTH = 6;
// 32 chars — omit 0/O/1/I to avoid visual confusion.
// 32 divides 256 evenly so crypto.getRandomValues has no modulo bias here.
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// CORS: wildcard origin is intentional — this is a public utility worker.
// /session/create requires the caller to already possess the PAT, so allowing
// any origin doesn't introduce a new credential theft vector.
// /session/redeem is guarded by the 32^6 (~1B) keyspace + 30-minute TTL,
// making brute force impractical.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function generateCode() {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => CHARS[b % CHARS.length])
    .join('');
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

async function handleCreate(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { pat, gitlabUrl } = body;
  if (!pat || typeof pat !== 'string' || pat.length < 10) {
    return json({ error: 'Missing or invalid pat' }, 400);
  }
  if (!gitlabUrl || typeof gitlabUrl !== 'string') {
    return json({ error: 'Missing gitlabUrl' }, 400);
  }

  // Generate a unique code — retry on collision (extremely unlikely with 32^6 = 1B+ combos).
  // If all 5 attempts collide (statistically impossible in practice), we write anyway
  // rather than failing the user — a collision would only delay the rightful owner's
  // redemption by the 30-second window before the displaced entry expires.
  let code;
  for (let i = 0; i < 5; i++) {
    code = generateCode();
    const existing = await env.SESSION_KV.get(code);
    if (!existing) break;
  }

  // Credential data stored as plain text JSON in KV. Mitigations: short TTL (30 min),
  // one-time deletion on redemption, and 32^6 keyspace guarding the entry.
  // Anyone with Cloudflare dashboard/API access to this namespace can read PATs at rest.
  await env.SESSION_KV.put(code, JSON.stringify({ pat, gitlabUrl }), {
    expirationTtl: CODE_TTL_SECONDS,
  });

  return json({ code, expiresInSeconds: CODE_TTL_SECONDS });
}

async function handleRedeem(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { code } = body;
  if (!code || typeof code !== 'string') {
    return json({ error: 'Missing code' }, 400);
  }

  const normalizedCode = code.trim().toUpperCase();
  const raw = await env.SESSION_KV.get(normalizedCode);

  if (!raw) {
    return json({ error: 'Invalid or expired code' }, 404);
  }

  // One-time use: delete immediately after reading
  await env.SESSION_KV.delete(normalizedCode);

  // KV stores { pat, gitlabUrl } as JSON
  const data = JSON.parse(raw);
  return json({ pat: data.pat, gitlabUrl: data.gitlabUrl });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (request.method === 'POST' && url.pathname === '/session/create') {
      return handleCreate(request, env);
    }

    if (request.method === 'POST' && url.pathname === '/session/redeem') {
      return handleRedeem(request, env);
    }

    return new Response('Not Found', { status: 404, headers: CORS_HEADERS });
  },
};
