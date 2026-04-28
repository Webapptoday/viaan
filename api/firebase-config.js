// Vercel Serverless Function — /api/firebase-config
// Returns Firebase client config from Vercel environment variables.
// This endpoint is intentionally public; Firebase client config is not secret.
// Security is enforced by Firebase Security Rules on Firestore.

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const config = {
    apiKey:            process.env.FIREBASE_API_KEY            || process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain:        process.env.FIREBASE_AUTH_DOMAIN        || process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId:         process.env.FIREBASE_PROJECT_ID         || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket:     process.env.FIREBASE_STORAGE_BUCKET     || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId:             process.env.FIREBASE_APP_ID             || process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  const missing = Object.entries(config)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length > 0) {
    console.error('[firebase-config] Missing env vars:', missing);
    return res.status(503).json({ error: 'Firebase not configured on server', missing });
  }

  // Cache for 1 hour — config is static
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
  return res.status(200).json(config);
}
