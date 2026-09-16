/** Minimal Web Push (RFC 8291/8292) for Cloudflare Workers — VAPID + aes128gcm. */

function b64urlToBytes(str) {
  const pad = "=".repeat((4 - (str.length % 4)) % 4);
  const b64 = (str + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function bytesToB64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function concatBytes(...parts) {
  const len = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(len);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

export function urlBase64ToUint8Array(base64String) {
  return b64urlToBytes(base64String);
}

export async function importVapidKeys(publicKeyB64, privateKeyB64) {
  const publicKey = await crypto.subtle.importKey(
    "raw",
    b64urlToBytes(publicKeyB64),
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["verify"]
  );
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    b64urlToBytes(privateKeyB64),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
  return { publicKey, privateKey, publicKeyB64 };
}

async function createVapidJwt(audience, subject, privateKey) {
  const header = bytesToB64url(new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = bytesToB64url(
    new TextEncoder().encode(
      JSON.stringify({ aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })
    )
  );
  const unsigned = `${header}.${payload}`;
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    new TextEncoder().encode(unsigned)
  );
  const sigBytes = new Uint8Array(sig);
  const r = sigBytes.slice(0, 32);
  const s = sigBytes.slice(32, 64);
  const raw = concatBytes(r, s);
  return `${unsigned}.${bytesToB64url(raw)}`;
}

async function hkdf(salt, ikm, info, len) {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(
    await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, len * 8)
  );
}

async function encryptPayload(subscription, payloadText) {
  const userPublicKey = b64urlToBytes(subscription.keys.p256dh);
  const userAuth = b64urlToBytes(subscription.keys.auth);
  const localKeys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const localPublic = new Uint8Array(await crypto.subtle.exportKey("raw", localKeys.publicKey));
  const shared = await crypto.subtle.deriveBits(
    { name: "ECDH", public: await crypto.subtle.importKey("raw", userPublicKey, { name: "ECDH", namedCurve: "P-256" }, true, []) },
    localKeys.privateKey,
    256
  );
  const sharedBytes = new Uint8Array(shared);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hkdf(userAuth, sharedBytes, new TextEncoder().encode("Content-Encoding: auth\0"), 32);
  const cek = await hkdf(salt, prk, buildInfo("aesgcm", userPublicKey, localPublic), 16);
  const nonce = await hkdf(salt, prk, buildInfo("nonce", userPublicKey, localPublic), 12);
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const padded = concatBytes(new TextEncoder().encode(payloadText), new Uint8Array([2]));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, padded));
  const record = concatBytes(new Uint8Array([0]), salt, new Uint8Array([localPublic.length]), localPublic, ciphertext);
  return record;
}

function buildInfo(type, userPublicKey, localPublic) {
  const enc = new TextEncoder();
  return concatBytes(
    enc.encode(`Content-Encoding: ${type}\0`),
    new Uint8Array([0, userPublicKey.length]),
    userPublicKey,
    new Uint8Array([0, localPublic.length]),
    localPublic
  );
}

export async function sendWebPush(subscription, payload, vapid) {
  const endpoint = subscription.endpoint;
  if (!endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    return { ok: false, error: "invalid subscription" };
  }
  const url = new URL(endpoint);
  const jwt = await createVapidJwt(`${url.protocol}//${url.host}`, vapid.subject, vapid.privateKey);
  const body = await encryptPayload(subscription, typeof payload === "string" ? payload : JSON.stringify(payload));
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${jwt}, k=${vapid.publicKeyB64}`,
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      TTL: "86400",
      Urgency: "high",
    },
    body,
  });
  return { ok: res.ok, status: res.status, expired: res.status === 404 || res.status === 410 };
}
