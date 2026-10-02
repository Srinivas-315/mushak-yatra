// Online leaderboard settings.
//
// Leave these empty and the game works exactly as before, with scores saved
// only on each player's own device. Fill them in to switch the shared
// leaderboard on. Step-by-step instructions: see LEADERBOARD_SETUP.md
//
// The "anon" key below is Supabase's PUBLIC key. It is meant to be shipped
// inside web pages and is safe to commit. Never put the "service_role" key
// here: that one is secret.

export const LEADERBOARD = {
  url: '',      // e.g. 'https://abcdefghijkl.supabase.co'
  anonKey: '',  // the public anon key from Supabase → Project Settings → API
};
