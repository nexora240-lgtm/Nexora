import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, PutCommand, UpdateCommand, DeleteCommand, GetCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.LINKS_TABLE || 'nexora-linkfinder';
const USERS_TABLE = process.env.USERS_TABLE || 'NexoraUsers';
const ADMIN_USERNAMES = (process.env.ADMIN_USERNAMES || '')
  .split(',')
  .map(u => u.trim().toLowerCase())
  .filter(Boolean);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://thenexoraproject.xyz')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

const KNOWN_BLOCKERS = [
  'fortiguard', 'lightspeed', 'palo alto', 'blocksi web', 'blocksi ai',
  'linewize', 'cisco umbrella', 'securly', 'goguardian', 'lanschool',
  'contentkeeper', 'aristotlek12', 'senso cloud', 'deledao', 'iboss',
  'sophos', 'barracuda', 'qustodio', 'dns filter',
];

const HOSTING_TYPES = ['cdn', 'firebase', 'cloudflare', 'vercel', 'netlify', 'github', 'subdomain', 'freedns', 'custom'];

const BULK_LIMIT = 500;

function readHeader(event, name) {
  const h = event.headers || {};
  return h[name] || h[name.toLowerCase()] || h[name.toUpperCase()] || '';
}

function pickOrigin(reqOrigin) {
  if (ALLOWED_ORIGINS.includes('*')) return reqOrigin || '*';
  if (reqOrigin && ALLOWED_ORIGINS.includes(reqOrigin)) return reqOrigin;
  return ALLOWED_ORIGINS[0];
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': pickOrigin(origin),
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Username',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Vary': 'Origin',
  };
}

function respond(statusCode, body, origin) {
  return { statusCode, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }, body: JSON.stringify(body) };
}

function originAllowed(origin) {
  if (ALLOWED_ORIGINS.includes('*')) return true;
  return !!origin && ALLOWED_ORIGINS.includes(origin);
}

function extractToken(event) {
  const raw = readHeader(event, 'Authorization');
  if (!raw) return '';
  const m = String(raw).match(/^Bearer\s+(\S+)$/i);
  return m ? m[1] : String(raw).trim();
}

async function authorizeAdmin(event) {
  const username = String(readHeader(event, 'X-Admin-Username') || '').trim().toLowerCase();
  const token = extractToken(event);
  if (!username || !token) return { ok: false, reason: 'Missing credentials' };
  if (ADMIN_USERNAMES.length && !ADMIN_USERNAMES.includes(username)) return { ok: false, reason: 'Not an admin' };
  const user = await ddb.send(new GetCommand({ TableName: USERS_TABLE, Key: { username } }));
  const record = user.Item;
  if (!record) return { ok: false, reason: 'User not found' };
  if (record.sessionToken !== token) return { ok: false, reason: 'Invalid session' };
  if (record.tokenExpiresAt && Number(record.tokenExpiresAt) < Date.now()) return { ok: false, reason: 'Session expired' };
  return { ok: true, username };
}

function normalizeUrl(input) {
  let raw = String(input || '').trim();
  if (!raw) return null;
  raw = raw.replace(/^["'`<]+|[>"'`]+$/g, '');
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = 'https://' + raw.replace(/^\/+/, '');
  let u;
  try { u = new URL(raw); } catch { return null; }
  if (!['http:', 'https:'].includes(u.protocol)) return null;
  u.protocol = 'https:';
  let host = u.hostname.toLowerCase().replace(/\.$/, '');
  if (host.startsWith('www.')) host = host.slice(4);
  if (!host || host === 'localhost' || host.endsWith('.local') || !host.includes('.')) return null;
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return null;
  u.hostname = host;
  u.username = '';
  u.password = '';
  u.hash = '';
  const path = u.pathname && u.pathname !== '/' ? u.pathname.replace(/\/+$/, '') : '';
  const search = u.search || '';
  return `${u.protocol}//${u.hostname}${path}${search}`;
}

function deriveName(url) {
  try {
    const host = new URL(url).hostname;
    const label = host.split('.').slice(0, -1).join('.') || host;
    return label.slice(0, 80);
  } catch { return String(url).slice(0, 80); }
}

function heuristicHosting(host) {
  const h = String(host || '').toLowerCase();
  if (h.endsWith('.b-cdn.net') || h.endsWith('.cloudfront.net') || h.includes('.fastly.') || h.endsWith('.jsdelivr.net')) return 'cdn';
  if (h.endsWith('.firebaseapp.com') || h.endsWith('.web.app')) return 'firebase';
  if (h.endsWith('.pages.dev') || h.endsWith('.workers.dev') || h.endsWith('.r2.dev')) return 'cloudflare';
  if (h.endsWith('.vercel.app')) return 'vercel';
  if (h.endsWith('.netlify.app')) return 'netlify';
  if (h.endsWith('.github.io')) return 'github';
  if (h.endsWith('.js.org') || h.endsWith('.eu.org') || h.endsWith('.fleek.app')) return 'subdomain';
  return 'custom';
}

function coerceBlockers(raw) {
  if (!Array.isArray(raw)) return [];
  const set = new Set();
  for (const item of raw) {
    const v = String(item || '').toLowerCase().trim();
    if (!v) continue;
    if (KNOWN_BLOCKERS.includes(v)) set.add(v);
  }
  return [...set];
}

function clampInt(value, lo, hi, fallback) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, n));
}

async function scanAllUrls() {
  const urls = new Set();
  let lastKey;
  do {
    const params = {
      TableName: TABLE,
      ProjectionExpression: '#u',
      ExpressionAttributeNames: { '#u': 'url' },
    };
    if (lastKey) params.ExclusiveStartKey = lastKey;
    const out = await ddb.send(new ScanCommand(params));
    for (const it of out.Items || []) {
      if (typeof it.url === 'string' && it.url) urls.add(it.url);
    }
    lastKey = out.LastEvaluatedKey;
  } while (lastKey);
  return urls;
}

async function listLinks() {
  const items = [];
  let lastKey;
  do {
    const params = { TableName: TABLE };
    if (lastKey) params.ExclusiveStartKey = lastKey;
    const result = await ddb.send(new ScanCommand(params));
    items.push(...(result.Items || []));
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  const links = items
    .filter(item => item && typeof item.url === 'string' && item.url)
    .sort((a, b) => {
      const at = Number(a.addedAt || 0) || Date.parse(a.addedDate || 0) || 0;
      const bt = Number(b.addedAt || 0) || Date.parse(b.addedDate || 0) || 0;
      return bt - at;
    });
  return { links };
}

function buildLinkItem(url, adminUsername, overrides) {
  const host = new URL(url).hostname;
  const now = Date.now();
  const item = {
    linkId: 'link#' + now + '#' + randomUUID().slice(0, 8),
    url,
    domain: host,
    name: (String(overrides?.name || '').trim() || deriveName(url)).slice(0, 120),
    hostingType: HOSTING_TYPES.includes(String(overrides?.hostingType || '').toLowerCase().trim())
      ? String(overrides.hostingType).toLowerCase().trim()
      : heuristicHosting(host),
    strictnessMin: 1,
    strictnessMax: 10,
    blockers: coerceBlockers(overrides?.blockers),
    status: 'active',
    failCount: 0,
    source: `owner:${adminUsername}`,
    addedAt: now,
    addedDate: new Date(now).toISOString(),
    lastChecked: new Date(now).toISOString(),
  };
  if (overrides?.strictness !== undefined) item.strictness = clampInt(overrides.strictness, 1, 10, 4);
  return item;
}

async function addLinks(body, adminUsername) {
  const rawInputs = Array.isArray(body.urls) && body.urls.length
    ? body.urls
    : body.url ? [body.url] : [];
  if (!rawInputs.length) throw new Error('urls (or url) is required');
  if (rawInputs.length > BULK_LIMIT) throw new Error(`Too many URLs at once (max ${BULK_LIMIT})`);

  const seen = new Set();
  const invalid = [];
  const candidates = [];
  for (const raw of rawInputs) {
    const url = normalizeUrl(raw);
    if (!url) { invalid.push({ input: String(raw || '').slice(0, 200), error: 'invalid url' }); continue; }
    if (seen.has(url)) continue;
    seen.add(url);
    candidates.push({ url, raw });
  }

  const existingUrls = await scanAllUrls();
  const added = [];
  const duplicates = [];
  const toWrite = [];

  const overrides = {
    name: body.name,
    hostingType: body.hostingType,
    strictness: body.strictness,
    blockers: body.blockers,
  };
  const overridesActive = rawInputs.length === 1 && (overrides.name || overrides.hostingType || overrides.strictness !== undefined || overrides.blockers);

  for (const { url } of candidates) {
    if (existingUrls.has(url)) {
      duplicates.push({ url, reason: 'already exists' });
      continue;
    }
    const item = buildLinkItem(url, adminUsername, overridesActive ? overrides : null);
    existingUrls.add(url);
    toWrite.push(item);
    added.push(item);
  }

  for (let i = 0; i < toWrite.length; i += 25) {
    const batch = toWrite.slice(i, i + 25);
    await ddb.send(new BatchWriteCommand({
      RequestItems: { [TABLE]: batch.map(item => ({ PutRequest: { Item: item } })) },
    }));
  }

  return {
    total: rawInputs.length,
    added,
    addedCount: added.length,
    duplicates,
    duplicateCount: duplicates.length,
    invalid,
    invalidCount: invalid.length,
    link: added[0] || null,
  };
}

async function updateLink(body) {
  const linkId = String(body.linkId || '').trim();
  if (!linkId) throw new Error('linkId is required');
  const existing = await ddb.send(new GetCommand({ TableName: TABLE, Key: { linkId } }));
  if (!existing.Item) throw new Error('Link not found');

  const names = {};
  const values = {};
  const setExpr = [];
  let targetUrl = existing.Item.url;

  if (body.url !== undefined) {
    const url = normalizeUrl(body.url);
    if (!url) throw new Error('A valid URL is required');
    if (url !== existing.Item.url) {
      const existingUrls = await scanAllUrls();
      if (existingUrls.has(url)) throw new Error('Another link with that URL already exists');
    }
    targetUrl = url;
    setExpr.push('#u = :u');
    setExpr.push('#d = :d');
    names['#u'] = 'url';
    names['#d'] = 'domain';
    values[':u'] = url;
    values[':d'] = new URL(url).hostname;
  }

  if (body.name !== undefined) {
    setExpr.push('#n = :n');
    names['#n'] = 'name';
    values[':n'] = (String(body.name || '').trim().slice(0, 120)) || deriveName(targetUrl);
  }

  if (body.hostingType !== undefined) {
    const v = String(body.hostingType || '').toLowerCase().trim();
    setExpr.push('hostingType = :ht');
    values[':ht'] = HOSTING_TYPES.includes(v) ? v : 'custom';
  }

  if (body.strictness !== undefined) {
    setExpr.push('strictness = :s');
    values[':s'] = clampInt(body.strictness, 1, 10, existing.Item.strictness || 4);
  }

  if (body.blockers !== undefined) {
    setExpr.push('blockers = :bl');
    values[':bl'] = coerceBlockers(body.blockers);
  }

  if (body.status !== undefined) {
    const status = String(body.status || 'active').toLowerCase().trim();
    setExpr.push('#s = :st');
    names['#s'] = 'status';
    values[':st'] = ['active', 'inactive', 'failing'].includes(status) ? status : 'active';
  }

  if (!setExpr.length) throw new Error('No fields to update');
  setExpr.push('lastChecked = :lc');
  values[':lc'] = new Date().toISOString();

  await ddb.send(new UpdateCommand({
    TableName: TABLE,
    Key: { linkId },
    UpdateExpression: 'SET ' + setExpr.join(', '),
    ExpressionAttributeNames: Object.keys(names).length ? names : undefined,
    ExpressionAttributeValues: values,
  }));
  return { updated: linkId };
}

async function deleteLinkItem(body) {
  const linkId = String(body.linkId || '').trim();
  if (!linkId) throw new Error('linkId is required');
  await ddb.send(new DeleteCommand({ TableName: TABLE, Key: { linkId } }));
  return { deleted: linkId };
}

export async function handler(event) {
  const origin = readHeader(event, 'Origin') || readHeader(event, 'origin');
  const method = event.requestContext?.http?.method || event.httpMethod || 'GET';
  if (method === 'OPTIONS') {
    if (!originAllowed(origin)) return { statusCode: 403, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Origin not allowed' }) };
    return respond(200, {}, origin);
  }
  if (!originAllowed(origin)) return respond(403, { error: 'Origin not allowed' }, origin);

  const auth = await authorizeAdmin(event);
  if (!auth.ok) return respond(403, { error: 'Forbidden: ' + auth.reason }, origin);

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    switch (method) {
      case 'GET':
        return respond(200, await listLinks(), origin);
      case 'POST':
        return respond(201, await addLinks(body, auth.username), origin);
      case 'PUT':
        return respond(200, await updateLink(body), origin);
      case 'DELETE':
        return respond(200, await deleteLinkItem(body), origin);
      default:
        return respond(405, { error: 'Method not allowed' }, origin);
    }
  } catch (err) {
    console.error('link-admin error:', err);
    const status = /required|not found|no fields|already exists|too many/i.test(err.message) ? 400 : 500;
    return respond(status, { error: err.message }, origin);
  }
}
