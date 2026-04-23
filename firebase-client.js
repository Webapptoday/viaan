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
  // ── Firebase config — replace ALL placeholder values ───────
  var FIREBASE_CONFIG = {
    apiKey:            "YOUR_API_KEY",
    authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
    projectId:         "YOUR_PROJECT_ID",
    storageBucket:     "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId:             "YOUR_APP_ID",
  };
  // ───────────────────────────────────────────────────────────

  // Detect placeholder config — skip Firebase init until configured
  if (FIREBASE_CONFIG.apiKey === "YOUR_API_KEY") {
    console.info(
      '[Firebase] Config not set. Leaderboard running in offline/mock mode.\n' +
      'Fill in FIREBASE_CONFIG in firebase-client.js to enable the real leaderboard.'
    );
    window._fbDb          = null;
    window._fbAuth        = null;
    window._fbGetUserId   = function () { return null; };
    window._fbWaitForAuth = function () { return Promise.resolve(null); };
    return;
  }

  // Guard against double-init (hot reload / script re-execution)
  if (!firebase.apps.length) {
    firebase.initializeApp(FIREBASE_CONFIG);
  }

  var _auth = firebase.auth();
  var _db   = firebase.firestore();

  // Enable offline persistence so scores survive connectivity loss
  _db.enablePersistence({ synchronizeTabs: true }).catch(function (err) {
    // Persistence may fail in private browsing or if another tab has it — non-fatal
    if (err.code !== 'failed-precondition' && err.code !== 'unimplemented') {
      console.warn('[Firebase] Persistence error:', err.code);
    }
  });

  // Sign in anonymously on page load.
  // Firebase persists the anonymous session in localStorage automatically,
  // so the same UID is reused across page reloads.
  // To upgrade to a real account later, call firebase.auth().currentUser.linkWith*()
  var _authReady = _auth.signInAnonymously()
    .then(function (cred) { return cred.user; })
    .catch(function (err) {
      console.warn('[Firebase] Anonymous sign-in failed:', err.code, err.message);
      return null;
    });

  // ── Public API exposed on window ─────────────────────────
  window._fbDb   = _db;
  window._fbAuth = _auth;

  /** Returns the current anonymous UID, or null if auth not yet complete. */
  window._fbGetUserId = function () {
    var user = _auth.currentUser;
    return user ? user.uid : null;
  };

  /** Promise that resolves to the firebase.User once auth is confirmed. */
  window._fbWaitForAuth = function () {
    return _authReady;
  };
})();
