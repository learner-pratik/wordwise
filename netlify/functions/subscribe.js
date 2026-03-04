// ─────────────────────────────────────────────────────────────────────────────
//  subscribe.js — Netlify Function
//  POST /api/subscribe  →  stores a push subscription in Netlify Blobs
//  Body: { subscription, timezone, startDate }
// ─────────────────────────────────────────────────────────────────────────────
const { getStore } = require('@netlify/blobs');

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  // Handle CORS pre-flight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // ── Parse body ──────────────────────────────────────────────────────────────
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (err) {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Invalid JSON: ' + err.message }) };
  }

  const { subscription, timezone, startDate } = body;

  if (!subscription?.endpoint) {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Missing subscription.endpoint' }) };
  }
  if (!timezone) {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Missing timezone' }) };
  }

  // ── Stable key for this subscriber ─────────────────────────────────────────
  // We use the last 40 alphanumeric chars of the base64-encoded endpoint URL
  const endpointKey = Buffer.from(subscription.endpoint)
    .toString('base64')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(-40);

  // ── Save to Netlify Blobs ───────────────────────────────────────────────────
  let store;
  try {
    store = getStore('push-subscriptions');
  } catch (err) {
    console.error('[subscribe] getStore failed:', err.name, err.message);
    return {
      statusCode: 500,
      headers: HEADERS,
      body: JSON.stringify({ error: 'getStore failed: ' + err.message }),
    };
  }

  try {
    await store.setJSON(endpointKey, {
      subscription,
      timezone,   // e.g. "Asia/Kolkata"
      startDate,  // YYYY-MM-DD — used to pick the right word of the day
      subscribedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[subscribe] store.setJSON failed:', err.name, err.message);
    return {
      statusCode: 500,
      headers: HEADERS,
      // Return the real error so the frontend can display it
      body: JSON.stringify({ error: 'store.setJSON failed: ' + err.message }),
    };
  }

  console.log('[subscribe] Saved subscription for key', endpointKey, 'tz:', timezone);
  return {
    statusCode: 200,
    headers: HEADERS,
    body: JSON.stringify({ ok: true }),
  };
};
