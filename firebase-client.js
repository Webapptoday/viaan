// ============================================================
// FIREBASE CLIENT — SHIFTPANIC  (v3)
// ============================================================
//
// ARCHITECTURE:
//   playerId = localStorage UUID (key: shiftPanicPlayerId)
//   Anonymous Auth for write authorization only.
//   All leaderboard data lives in Firebase only.
//
// FIRESTORE STRUCTURE:
//   leaderboards/global/scores/{playerId}
//   leaderboards/weekly/{weekId}/scores/{playerId}
//   leaderboards/daily/{dayId}/scores/{playerId}
//   leaderboards/_meta  (seed tracking)
//
// REQUIRED SECURITY RULES (Firebase Console -> Firestore -> Rules):
//
//   rules_version = "2";
//   service cloud.firestore {
//     match /databases/{database}/documents {
//       match /leaderboards/{path=**} {
//         allow read: if true;
//         allow write: if true;
//       }
//     }
//   }
//
// NO COMPOSITE INDEXES NEEDED.
// VERCEL ENV VARS: FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_PROJECT_ID,
//   FIREBASE_STORAGE_BUCKET, FIREBASE_MESSAGING_SENDER_ID, FIREBASE_APP_ID
// ============================================================

(function () {
  window._fbDb          = null;
  window._fbAuth        = null;
  window._fbPlayerId    = null;
  window._fbGetUserId   = function () { return window._fbPlayerId; };
  window._fbWaitForAuth = function () { return Promise.resolve(null); };

  var _resolve;
  window._fbReady = new Promise(function (r) { _resolve = r; });

  function _getOrCreatePlayerId() {
    var KEY = "shiftPanicPlayerId";
    var id;
    try { id = localStorage.getItem(KEY); } catch (_) {}
    if (!id) {
      try {
        var old = localStorage.getItem("shiftpanic_pid");
        if (old && /^[a-z0-9]{8,}$/.test(old)) { id = old; localStorage.setItem(KEY, id); }
      } catch (_) {}
    }
    if (!id || !/^[a-z0-9]{8,}$/.test(id)) {
      id = "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      try { localStorage.setItem(KEY, id); } catch (_) {}
    }
    return id;
  }

  window._fbPlayerId  = _getOrCreatePlayerId();
  window._fbGetUserId = function () { return window._fbPlayerId; };
  console.log("[ShiftPanic] Firebase client init. playerId:", window._fbPlayerId);

  function _initFirebase(config) {
    try {
      if (!firebase.apps.length) firebase.initializeApp(config);
      console.log("[ShiftPanic] Firebase initialized.");
      var auth = firebase.auth();
      var db   = firebase.firestore();
      db.enablePersistence({ synchronizeTabs: true }).catch(function (err) {
        if (err.code !== "failed-precondition" && err.code !== "unimplemented") {
          console.warn("[Firebase] Persistence error:", err.code);
        }
      });
      var authReady = auth.signInAnonymously()
        .then(function (cred) {
          console.log("[ShiftPanic] Signed in anonymously. uid:", cred.user.uid);
          return cred.user;
        })
        .catch(function (err) {
          console.warn("[Firebase] Anonymous sign-in failed:", err.code, err.message);
          return null;
        });
      var rtdb              = firebase.database();
      window._fbDb          = db;
      window._fbRtdb        = rtdb;
      window._fbAuth        = auth;
      window._fbWaitForAuth = function () { return authReady; };

      // ── Realtime Database: monitor connection state ──────────────────
      rtdb.ref('.info/connected').on('value', function (snap) {
        if (snap.val() === true) {
          console.log('[ShiftPanic] Realtime Database CONNECTED ✓');
        } else {
          console.log('[ShiftPanic] Realtime Database disconnected / waiting...');
        }
      });

      // ── Exposed test function (call window._fbRtdbTest() in console) ─
      window._fbRtdbTest = function () {
        console.log('[RTDB Test] Starting write to testConnection/status …');
        var ref = rtdb.ref('testConnection/status');
        return ref.set({ connected: true, source: 'Shift Panic', timestamp: Date.now() })
          .then(function () {
            console.log('[RTDB Test] ✓ Write SUCCESS');
            return ref.once('value');
          })
          .then(function (snap) {
            console.log('[RTDB Test] ✓ Read SUCCESS — data:', snap.val());
            return snap.val();
          })
          .catch(function (err) {
            console.error('[RTDB Test] ✗ FAILED —', err.code, ':', err.message);
            if (err.code === 'PERMISSION_DENIED') {
              console.error(
                '[RTDB Test] Your Realtime Database rules are blocking writes.\n' +
                'Go to Firebase Console → Realtime Database → Rules and set:\n\n' +
                '{\n  "rules": {\n    ".read": "auth != null",\n    ".write": "auth != null"\n  }\n}\n\n' +
                '(Or use true/true for testing — tighten before production.)'
              );
            }
          });
      };

      // Run test automatically after auth succeeds
      authReady.then(function (user) {
        _resolve(true);
        if (user) {
          console.log('[ShiftPanic] Running RTDB connection test (uid:', user.uid + ') …');
          window._fbRtdbTest();
        } else {
          console.warn('[ShiftPanic] Skipping RTDB test — anonymous auth did not return a user.');
        }
      });
    } catch (err) {
      console.warn("[Firebase] Init error:", err.message);
      _resolve(false);
    }
  }

  // Firebase client config is public by design — security is enforced by Firestore rules.
  _initFirebase({
    apiKey:            "AIzaSyCNGoXm2VaRILMjQtorMaIcUMDlGQpVZ9w",
    authDomain:        "shiftpanic-1ee68.firebaseapp.com",
    projectId:         "shiftpanic-1ee68",
    storageBucket:     "shiftpanic-1ee68.firebasestorage.app",
    messagingSenderId: "790226285352",
    appId:             "1:790226285352:web:0773b3ff7678a4959fd61d",
    databaseURL:       "https://shiftpanic-1ee68-default-rtdb.firebaseio.com",
  });
})();
