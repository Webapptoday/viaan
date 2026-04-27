// ============================================================
// FIREBASE CLIENT — SHIFTPANIC  (v2 — cross-device sync)
// ============================================================
//
// KEY CHANGE: playerId is now a persistent localStorage UUID,
// NOT the Firebase Anonymous Auth UID. This enables cross-device
// score tracking when a player copies their Player ID.
// Firebase Anonymous Auth is still required for write authorization.
//
// ── REQUIRED FIRESTORE SECURITY RULES ────────────────────────
// Deploy in Firebase Console → Firestore → Rules:
//
//   rules_version = '2';
//   service cloud.firestore {
//     match /databases/{database}/documents {
//       match /leaderboard/{docId} {
//         allow read: if true;
//         allow create, update: if request.auth != null
//           && request.resource.data.playerId is string
//           && request.resource.data.playerId == docId
//           && request.resource.data.score is int
//           && request.resource.data.score >= 0
//           && request.resource.data.score <= 9999999
//           && request.resource.data.playerName is string
//           && request.resource.data.playerName.size() >= 1
//           && request.resource.data.playerName.size() <= 12;
//         allow delete: if false;
//       }
//     }
//   }
//
// ── REQUIRED FIRESTORE COMPOSITE INDEXES ─────────────────────
// Firebase Console → Firestore → Indexes → Add composite index:
//   Collection: leaderboard | weekId ASC, weeklyScore DESC  (Weekly tab)
//   Collection: leaderboard | dayId ASC,  dailyScore DESC   (Daily tab)
// When the weekly/daily tabs first load, Firestore logs an error
// with a direct link — click it to auto-create the index (~1 min).
//
// ── Environment variables / config values to fill in ────────
// Replace the placeholder strings below with values from:
//   Firebase Console → Your Project → Project Settings → Your Apps → Web app
//
//   apiKey            — starts with "AIza..."
//   authDomain        — <project-id>.firebaseapp.com
//   projectId         — your Firebase project ID
//   storageBucket     — <project-id>.appspot.com
//   messagingSenderId — numeric sender ID
//   appId             — "1:...:web:..."
//
// ── Firebase Console setup steps ────────────────────────────
//   1. Go to https://console.firebase.google.com
//   2. Create a project (or use an existing one)
//   3. Enable Anonymous Authentication:
//        Authentication → Sign-in method → Anonymous → Enable
//   4. Enable Cloud Firestore:
//        Firestore Database → Create database (test mode first, then deploy rules above)
//   5. Deploy the Firestore Security Rules shown at the top of this file.
//   6. Create the two Composite Indexes shown at the top of this file.
//   7. Set Vercel env vars:
//        FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_PROJECT_ID,
//        FIREBASE_STORAGE_BUCKET, FIREBASE_MESSAGING_SENDER_ID, FIREBASE_APP_ID
//
// ============================================================

(function () {
  // ── Stub public API immediately so script.js never sees undefined ──
  window._fbDb          = null;
  window._fbAuth        = null;
  window._fbPlayerId    = null;  // persistent localStorage UUID (cross-device playerId)
  window._fbGetUserId   = function () { return window._fbPlayerId; };
  window._fbWaitForAuth = function () { return Promise.resolve(null); };

  // _fbReady resolves once Firebase is initialised (or fails).
  var _resolve;
  window._fbReady = new Promise(function (r) { _resolve = r; });

  // ── Generate / retrieve stable playerId ──────────────────────
  // This UUID is stored in localStorage and used as the Firestore
  // document ID for this player across all leaderboard collections.
  // Different browsers/devices generate different IDs (unless the
  // player manually copies their ID to link devices).
  function _getOrCreatePlayerId() {
    var key = 'shiftpanic_pid';
    var id;
    try { id = localStorage.getItem(key); } catch (_) {}
    if (!id || !/^[a-z0-9_]{8,}$/.test(id)) {
      // compact UUID: 'p' + base36(timestamp) + base36(random)
      id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      try { localStorage.setItem(key, id); } catch (_) {}
    }
    return id;
  }

  window._fbPlayerId  = _getOrCreatePlayerId();
  window._fbGetUserId = function () { return window._fbPlayerId; };

  function _initFirebase(config) {
    try {
      if (!firebase.apps.length) firebase.initializeApp(config);

      var auth = firebase.auth();
      var db   = firebase.firestore();

      // Offline persistence — non-fatal if unavailable (private browsing, multi-tab)
      db.enablePersistence({ synchronizeTabs: true }).catch(function (err) {
        if (err.code !== 'failed-precondition' && err.code !== 'unimplemented') {
          console.warn('[Firebase] Persistence error:', err.code);
        }
      });

      // Anonymous sign-in — used for write authorization only (not for identity)
      var authReady = auth.signInAnonymously()
        .then(function (cred) { return cred.user; })
        .catch(function (err) {
          console.warn('[Firebase] Anonymous sign-in failed:', err.code, err.message);
          return null;
        });

      window._fbDb   = db;
      window._fbAuth = auth;
      window._fbWaitForAuth = function () { return authReady; };

      // Signal ready after auth resolves
      authReady.then(function () { _resolve(true); });
    } catch (err) {
      console.warn('[Firebase] Init error:', err.message);
      _resolve(false);
    }
  }

  // Fetch config from Vercel serverless function (/api/firebase-config)
  fetch('/api/firebase-config')
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (config) {
      if (!config || !config.apiKey) throw new Error('Empty config');
      _initFirebase(config);
    })
    .catch(function (err) {
      console.info('[Firebase] Config fetch failed — leaderboard offline.', err.message);
      _resolve(false);
    });
})();

