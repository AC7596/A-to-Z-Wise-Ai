const storageKey = 'atozMemberSession';
export function getMemberToken() {
  try { return sessionStorage.getItem(storageKey) || ''; } catch { return ''; }
}
export function setMemberToken(token) {
  try { sessionStorage.setItem(storageKey, token); return true; } catch { return false; }
}
export function clearMemberToken() {
  try { sessionStorage.removeItem(storageKey); } catch { /* browser storage unavailable */ }
}
