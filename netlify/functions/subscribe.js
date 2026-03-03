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

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { subscription, timezone, startDate } = body;

  if (!subscription?.endpoint || !timezone) {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Missing subscription or timezone' }) };
  }

  // Use a stable key derived from the subscription endpoint
  const endpointKey = Buffer.from(subscription.endpoint).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(-40);

  try {
    const store = getStore('push-subscriptions');
    await store.setJSON(endpointKey, {
      subscription,
      timezone,      // e.g. "Asia/Kolkata"
      startDate,     // ISO date string — used to pick the right word of the day
      subscribedAt: new Date().toISOString(),
    });

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({ ok: true }),
    };
  } catch (err) {
    console.error('subscribe error:', err);
    return {
      statusCode: 500,
      headers: HEADERS,
      body: JSON.stringify({ error: 'Storage error' }),
    };
  }
};
