// Online leaderboard settings.
//
// Leave these empty and the game still works, with scores saved only on each
// player's own device. Filled in, the shared leaderboard switches on.
// Setup steps: see LEADERBOARD_SETUP.md
//
// The key below is Supabase's PUBLISHABLE key. Supabase states these are safe
// to share publicly: it ships inside this web page anyway, and the database
// rules only allow reading the leaderboard and submitting a score.
// Never put a "secret" / "service_role" key here.

export const LEADERBOARD = {
  url: 'https://xwlvkuctetendwxhiegu.supabase.co',
  anonKey: 'sb_publishable_1xIAiD0NVjkzxzyLF-cpqg_8X9_0Dbe',
};
