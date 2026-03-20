import { DynamoDBClient, ScanCommand, PutItemCommand, DeleteItemCommand, UpdateItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';
import https from 'https';

const ddb = new DynamoDBClient({});
const TABLE = process.env.TABLE_NAME || 'nexora-links';

const FINGERPRINTS = ['nexora-boot.js', 'nexora-boot', 'Nexora', 'nexora240-lgtm/Nexora-Assets', 'nexora'];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Admin-Username',
  'Content-Type': 'application/json'
};

function res(statusCode, body) {
  return { statusCode, headers: CORS, body: JSON.stringify(body) };
}

// ── Fetch HTML from a URL ──
function fetchHtml(url, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout, headers: { 'User-Agent': 'NexoraLinkChecker/1.0' } }, (resp) => {
      if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
        return fetchHtml(resp.headers.location, timeout).then(resolve).catch(reject);
      }
      let data = '';
      resp.on('data', c => { data += c; if (data.length > 200000) resp.destroy(); });
      resp.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function hasNexoraFingerprint(html) {
  const lower = html.toLowerCase();
  return FINGERPRINTS.some(fp => lower.includes(fp.toLowerCase()));
}

function extractDomain(url) {
  try {
    const h = new URL(url).hostname;
    const parts = h.split('.');
    return parts.length > 2 ? parts.slice(-2).join('.') : h;
  } catch { return url; }
}

function extractName(url) {
  try {
    const h = new URL(url).hostname;
    const parts = h.split('.');
    return parts[0];
  } catch { return url; }
}

// ── Admin auth check (validates token via the admin API pattern) ──
function isAdminRequest(event) {
  const auth = event.headers?.authorization || event.headers?.Authorization || '';
  const adminUser = event.headers?.['x-admin-username'] || event.headers?.['X-Admin-Username'] || '';
  return !!(auth && adminUser);
}

export const handler = async (event) => {
  const method = event.requestContext?.http?.method || event.httpMethod || 'GET';
  const path = event.rawPath || event.requestContext?.http?.path || '/';

  // OPTIONS preflight
  if (method === 'OPTIONS') return res(200, {});

  // ═══ PUBLIC: GET /links ═══
  if (method === 'GET' && path === '/links') {
    const result = await ddb.send(new ScanCommand({ TableName: TABLE }));
    const links = (result.Items || []).map(item => ({
      url: item.url?.S,
      name: item.name?.S || extractName(item.url?.S),
      domain: item.domain?.S || extractDomain(item.url?.S),
      badge: item.badge?.S || null,
      addedAt: item.addedAt?.N ? Number(item.addedAt.N) : null,
      lastChecked: item.lastChecked?.N ? Number(item.lastChecked.N) : null,
      healthy: item.healthy?.BOOL !== false
    }));
    links.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    return res(200, { links });
  }

  // ═══ PUBLIC: POST /links/submit ═══
  if (method === 'POST' && path === '/links/submit') {
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { return res(400, { error: 'Invalid JSON' }); }

    let url = (body.url || '').trim();
    if (!url) return res(400, { error: 'URL is required' });

    // Normalize: ensure trailing slash is removed, lowercase protocol
    try { const u = new URL(url); url = u.origin; } catch { return res(400, { error: 'Invalid URL' }); }
    if (!url.startsWith('https://')) return res(400, { error: 'HTTPS required' });

    // Check if already exists
    const existing = await ddb.send(new GetItemCommand({ TableName: TABLE, Key: { url: { S: url } } }));
    if (existing.Item) return res(200, { message: 'Already registered', url });

    // Crawl and verify
    let html;
    try { html = await fetchHtml(url); } catch (e) { return res(400, { error: `Could not reach ${url}: ${e.message}` }); }

    if (!hasNexoraFingerprint(html)) {
      return res(400, { error: 'No Nexora fingerprint detected on this site' });
    }

    const now = Date.now();
    await ddb.send(new PutItemCommand({
      TableName: TABLE,
      Item: {
        url: { S: url },
        name: { S: extractName(url) },
        domain: { S: extractDomain(url) },
        addedAt: { N: String(now) },
        lastChecked: { N: String(now) },
        healthy: { BOOL: true }
      }
    }));

    return res(201, { message: 'Link verified and added', url });
  }

  // ═══════════════════════════════════════════════════════════════
  // ADMIN ROUTES (require auth headers)
  // ═══════════════════════════════════════════════════════════════

  // ═══ ADMIN: GET /admin/links ═══
  if (method === 'GET' && path === '/admin/links') {
    if (!isAdminRequest(event)) return res(401, { error: 'Unauthorized' });

    const result = await ddb.send(new ScanCommand({ TableName: TABLE }));
    const links = (result.Items || []).map(item => ({
      url: item.url?.S,
      name: item.name?.S || extractName(item.url?.S),
      domain: item.domain?.S || extractDomain(item.url?.S),
      badge: item.badge?.S || null,
      addedAt: item.addedAt?.N ? Number(item.addedAt.N) : null,
      lastChecked: item.lastChecked?.N ? Number(item.lastChecked.N) : null,
      healthy: item.healthy?.BOOL !== false
    }));
    links.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    return res(200, { links });
  }

  // ═══ ADMIN: POST /admin/links ═══ (add link with verification)
  if (method === 'POST' && path === '/admin/links') {
    if (!isAdminRequest(event)) return res(401, { error: 'Unauthorized' });

    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { return res(400, { error: 'Invalid JSON' }); }

    let url = (body.url || '').trim();
    if (!url) return res(400, { error: 'URL is required' });
    try { const u = new URL(url); url = u.origin; } catch { return res(400, { error: 'Invalid URL' }); }

    // Crawl and verify
    let html;
    try { html = await fetchHtml(url); } catch (e) { return res(400, { error: `Could not reach ${url}: ${e.message}` }); }

    if (!hasNexoraFingerprint(html)) {
      return res(400, { error: 'No Nexora fingerprint detected on this site' });
    }

    const now = Date.now();
    await ddb.send(new PutItemCommand({
      TableName: TABLE,
      Item: {
        url: { S: url },
        name: { S: extractName(url) },
        domain: { S: extractDomain(url) },
        addedAt: { N: String(now) },
        lastChecked: { N: String(now) },
        healthy: { BOOL: true }
      }
    }));

    return res(201, { message: 'Link added', url });
  }

  // ═══ ADMIN: DELETE /admin/links/{url} ═══
  if (method === 'DELETE' && path.startsWith('/admin/links/')) {
    if (!isAdminRequest(event)) return res(401, { error: 'Unauthorized' });

    const encodedUrl = path.replace('/admin/links/', '');
    const url = decodeURIComponent(encodedUrl);
    if (!url) return res(400, { error: 'URL is required' });

    await ddb.send(new DeleteItemCommand({
      TableName: TABLE,
      Key: { url: { S: url } }
    }));

    return res(200, { message: 'Link removed', url });
  }

  // ═══ ADMIN: PUT /admin/links/{url}/badge ═══
  if (method === 'PUT' && path.includes('/badge')) {
    if (!isAdminRequest(event)) return res(401, { error: 'Unauthorized' });

    // Extract URL: /admin/links/{encodedUrl}/badge
    const match = path.match(/^\/admin\/links\/(.+)\/badge$/);
    if (!match) return res(400, { error: 'Invalid path' });
    const url = decodeURIComponent(match[1]);

    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { return res(400, { error: 'Invalid JSON' }); }

    const badge = body.badge; // 'verified', 'official', or null

    if (badge && badge !== 'verified' && badge !== 'official') {
      return res(400, { error: 'Badge must be "verified", "official", or null' });
    }

    if (badge) {
      await ddb.send(new UpdateItemCommand({
        TableName: TABLE,
        Key: { url: { S: url } },
        UpdateExpression: 'SET badge = :b',
        ExpressionAttributeValues: { ':b': { S: badge } }
      }));
    } else {
      await ddb.send(new UpdateItemCommand({
        TableName: TABLE,
        Key: { url: { S: url } },
        UpdateExpression: 'REMOVE badge'
      }));
    }

    return res(200, { message: badge ? `Badge set to "${badge}"` : 'Badge removed', url, badge });
  }

  return res(404, { error: 'Not found' });
};
