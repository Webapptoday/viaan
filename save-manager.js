// SaveManager: central safe localStorage helpers with basic corruption recovery
// Minimal, dependency-free implementation. Exposes window.SaveManager
(function(){
  const BACKUPS_INDEX_KEY = 'shiftPanic_save_backups';

  function _safeGetRaw(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  }

  function _safeSetRaw(key, val) {
    try { localStorage.setItem(key, String(val)); return true; } catch (e) { console.warn('[SaveManager] write failed', key, e); return false; }
  }

  function _backupRaw(key, raw) {
    try {
      const ts = Date.now();
      const bk = 'shiftPanic_save_backup_' + key + '_' + ts;
      localStorage.setItem(bk, raw);
      // maintain an index (trim if it grows large)
      let idx = null;
      try { idx = JSON.parse(localStorage.getItem(BACKUPS_INDEX_KEY) || '[]'); } catch (_) { idx = []; }
      idx = idx || [];
      idx.push({ key, bk, ts });
      if (idx.length > 64) idx = idx.slice(-64);
      localStorage.setItem(BACKUPS_INDEX_KEY, JSON.stringify(idx));
      return bk;
    } catch (e) { console.warn('[SaveManager] backup failed', e); return null; }
  }

  function _tryParseJson(raw) {
    if (raw == null) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      // Try basic sanitization: remove control chars + trailing commas then parse
      try {
        const sanitized = raw.replace(/\,\s*([}\]])/g, '$1').replace(/[\u0000-\u001F]+/g, '');
        return JSON.parse(sanitized);
      } catch (e2) {
        try {
          const s = raw.indexOf('{'); const t = raw.lastIndexOf('}');
          if (s !== -1 && t !== -1 && t > s) return JSON.parse(raw.slice(s, t + 1));
        } catch (e3) {}
      }
    }
    return null;
  }

  function getJSON(key) {
    try {
      const raw = _safeGetRaw(key);
      if (!raw) return null;
      const parsed = _tryParseJson(raw);
      if (parsed === null) {
        // backup raw but do not overwrite user's stored string
        _backupRaw(key, raw);
        console.warn('[SaveManager] corrupted JSON for', key, '- backed up original');
        return null;
      }
      return parsed;
    } catch (e) { console.error('[SaveManager] getJSON error', e); return null; }
  }

  function setJSON(key, obj, opts) {
    try {
      const toWrite = (obj && typeof obj === 'object' && opts && Number.isFinite(opts.version)) ? Object.assign({}, obj, { __saveVersion: opts.version }) : obj;
      localStorage.setItem(key, JSON.stringify(toWrite));
      return true;
    } catch (e) {
      try { _backupRaw(key, _safeGetRaw(key) || ''); } catch (_) {}
      console.warn('[SaveManager] setJSON failed for', key, e);
      return false;
    }
  }

  function migrateIfNeeded(key, targetVersion, migrateFn) {
    try {
      const cur = getJSON(key);
      if (!cur) return false;
      const curVer = Number.isFinite(Number(cur.__saveVersion)) ? Number(cur.__saveVersion) : 0;
      if (curVer >= targetVersion) return false;
      let next = cur;
      if (typeof migrateFn === 'function') {
        try { next = migrateFn(Object.assign({}, cur)) || next; } catch (e) { console.warn('[SaveManager] migrateFn threw for', key, e); }
      }
      setJSON(key, next, { version: targetVersion });
      return true;
    } catch (e) { console.warn('[SaveManager] migrateIfNeeded error', e); return false; }
  }

  window.SaveManager = {
    getJSON,
    setJSON,
    getRaw: _safeGetRaw,
    setRaw: _safeSetRaw,
    backupRaw: _backupRaw,
    migrateIfNeeded,
    // Remove a key after backing it up. Returns true on success.
    clearKey(key) {
      try {
        const raw = _safeGetRaw(key);
        if (raw != null) _backupRaw(key, raw);
        localStorage.removeItem(key);
        return true;
      } catch (e) { console.warn('[SaveManager] clearKey failed', e); return false; }
    },
    // Return array of backup metadata entries for inspection
    listBackups() {
      try { return JSON.parse(localStorage.getItem(BACKUPS_INDEX_KEY) || '[]'); } catch (_) { return []; }
    },
  };
})();
