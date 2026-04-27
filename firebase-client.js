// ============================================================
// FIREBASE CLIENT — SHIFTPANIC
// ============================================================
//
// Firebase packages used (loaded via CDN in index.html):
//   firebase-app-compat      — core SDK initialization
//   firebase-auth-compat     — Anonymous Authentication
//   firebase-firestore-compat — Cloud Firestore real-time DB
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
//        Firestore Database → Create database
//        Start in "test mode", then deploy the security rules below
//   5. Deploy these Firestore Security Rules:
//
//        rules_version = '2';
//        service cloud.firestore {
//          match /databases/{database}/documents {
//            match /leaderboard_scores/{doc} {
//              // Anyone can read leaderboard data
//              allow read: if true;
//
//              // Only authenticated users can write their own scores
//              // Anti-cheat: score bounds enforced server-side here.
//              // For deeper validation (e.g. session token checks),
//              // add a Firebase Cloud Function trigger on this collection.
//              allow create, update: if request.auth != null
//                && request.auth.uid == request.resource.data.playerId
//                && request.resource.data.score is int
//                && request.resource.data.score >= 0
//                && request.resource.data.score <= 9999999
//                && request.resource.data.playerName is string
//                && request.resource.data.playerName.size() >= 1
//                && request.resource.data.playerName.size() <= 12;
//
//              allow delete: if false;
//            }
//          }
//        }
//
//   6. Create Firestore composite indexes (Firestore will also
//      auto-prompt you with a link the first time a query runs):
//        Collection: leaderboard_scores
//        Index A: boardType ASC, score DESC          (for all_time board)
//        Index B: boardType ASC, periodKey ASC, score DESC  (for daily/weekly)
//
// ============================================================

(function () {
  // ── Stub public API immediately so script.js never sees undefined ──
  window._fbDb          = null;
  window._fbAuth        = null;
  window._fbGetUserId   = function () { return null; };
  window._fbWaitForAuth = function () { return Promise.resolve(null); };

  // _fbReady resolves once Firebase is initialised (or fails).
  // LeaderboardService awaits this before attaching Firestore listeners.
  var _resolve;
  window._fbReady = new Promise(function (r) { _resolve = r; });

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

      // Anonymous sign-in — Firebase persists the UID in localStorage across reloads
      var authReady = auth.signInAnonymously()
        .then(function (cred) { return cred.user; })
        .catch(function (err) {
          console.warn('[Firebase] Anonymous sign-in failed:', err.code, err.message);
          return null;
        });

      window._fbDb   = db;
      window._fbAuth = auth;
      window._fbGetUserId   = function () { var u = auth.currentUser; return u ? u.uid : null; };
      window._fbWaitForAuth = function () { return authReady; };

      // Signal ready after auth resolves so listeners can write as authenticated user
      authReady.then(function () { _resolve(true); });
    } catch (err) {
      console.warn('[Firebase] Init error:', err.message);
      _resolve(false);
    }
  }

  // Fetch config from Vercel serverless function (/api/firebase-config)
  // This keeps all secrets server-side while still exposing the (public) client config.
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

