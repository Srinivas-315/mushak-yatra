import { LEADERBOARD } from './config.js';

// Shared online leaderboard — nickname only.
//
// No email, no phone number, no password. Each device gets a random private
// id so a player can keep updating their own entry; that id never leaves the
// device except as the owner of their row. The only thing other players see
// is the nickname and the score.

const PLAYER_KEY = 'my-player';

function randomId() {
  const a = new Uint8Array(12);
  (crypto || window.crypto).getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function enabled() {
  return Boolean(LEADERBOARD.url && LEADERBOARD.anonKey);
}

// { id, nickname } — created on first use and kept on this device.
export function getPlayer() {
  let p;
  try { p = JSON.parse(localStorage.getItem(PLAYER_KEY) || 'null'); } catch { p = null; }
  if (!p || !p.id) {
    p = { id: randomId(), nickname: '' };
    savePlayer(p);
  }
  return p;
}

export function savePlayer(p) {
  try { localStorage.setItem(PLAYER_KEY, JSON.stringify(p)); } catch { /* private mode */ }
}

export function setNickname(name) {
  const p = getPlayer();
  p.nickname = cleanNickname(name);
  savePlayer(p);
  return p.nickname;
}

// Keep nicknames short, plain and safe to display.
export function cleanNickname(name) {
  return String(name || '')
    .replace(/[<>&"'\\/\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 16);
}

// Players can move to a new phone by typing their recovery code (their id).
export function restorePlayer(code) {
  const id = String(code || '').trim().toLowerCase();
  if (!/^[0-9a-f]{24}$/.test(id)) return false;
  const p = getPlayer();
  savePlayer({ id, nickname: p.nickname });
  return true;
}

async function api(path, { method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(`${LEADERBOARD.url}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: LEADERBOARD.anonKey,
      Authorization: `Bearer ${LEADERBOARD.anonKey}`,
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Leaderboard ${res.status}`);
  return res;
}

// Sends a finished run. The database keeps only each player's best score per
// mode, so sending a worse score changes nothing.
export async function submit({ mode, score, stars = 0, distance = 0 }) {
  if (!enabled()) return null;
  const p = getPlayer();
  if (!p.nickname) throw new Error('Pick a nickname first');
  const res = await api('rpc/submit_score', {
    method: 'POST',
    body: {
      p_player: p.id,
      p_nickname: p.nickname,
      p_mode: mode,
      p_score: Math.max(0, Math.round(score)),
      p_stars: Math.max(0, Math.min(3, Math.round(stars))),
      p_distance: Math.max(0, Math.round(distance)),
    },
  });
  return res.json().catch(() => null);
}

// Top entries for a mode: [{ nickname, score, stars, distance }]
export async function top(mode, limit = 20) {
  if (!enabled()) return [];
  const res = await api(
    `scores?select=nickname,score,stars,distance,player_id&mode=eq.${encodeURIComponent(mode)}` +
    `&order=score.desc&limit=${limit}`,
  );
  return res.json();
}

// How many players scored higher, so rank = that + 1.
export async function rankOf(mode, score) {
  if (!enabled()) return null;
  const res = await api(
    `scores?select=player_id&mode=eq.${encodeURIComponent(mode)}&score=gt.${Math.round(score)}`,
    { method: 'HEAD', headers: { Prefer: 'count=exact', Range: '0-0' } },
  );
  const range = res.headers.get('content-range') || '';
  const total = parseInt(range.split('/')[1], 10);
  return Number.isFinite(total) ? total + 1 : null;
}
