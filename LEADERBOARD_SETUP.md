# Setting up the online leaderboard (free, ~10 minutes)

The game works without this. Follow these steps only when you want **one shared
leaderboard that every player can see**.

- **Cost:** free. Supabase's free plan needs **no credit card**.
- **What players give:** a nickname. **No email, no phone, no password.**

---

## Step 1 — Create the free database

1. Go to **https://supabase.com** and click **Start your project**.
2. Sign in with **GitHub** (the account you already have).
3. Click **New project**:
   - **Name:** `mushak-yatra`
   - **Database password:** it will generate one. You don't need it for the game,
     but save it somewhere just in case.
   - **Region:** pick the one nearest you (e.g. Mumbai / South Asia).
4. Wait about 2 minutes while it sets up.

## Step 2 — Create the table and the rules

In the left sidebar open **SQL Editor** → **New query**, paste all of this, and press **Run**:

```sql
-- One row per player per mode, holding their best run.
create table if not exists public.scores (
  player_id  text not null,
  mode       text not null check (mode in ('yatra', 'endless')),
  nickname   text not null,
  score      integer not null check (score >= 0 and score <= 2000000),
  stars      smallint not null default 0 check (stars between 0 and 3),
  distance   integer not null default 0 check (distance >= 0),
  updated_at timestamptz not null default now(),
  primary key (player_id, mode)
);

-- Everyone may READ the leaderboard...
alter table public.scores enable row level security;

drop policy if exists "read scores" on public.scores;
create policy "read scores" on public.scores for select using (true);

-- ...but nobody can write directly. Writing happens only through the
-- function below, which keeps the player's best score.
create or replace function public.submit_score(
  p_player text, p_nickname text, p_mode text,
  p_score integer, p_stars integer, p_distance integer
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_player !~ '^[0-9a-f]{24}$' then raise exception 'bad player id'; end if;
  if p_mode not in ('yatra','endless') then raise exception 'bad mode'; end if;
  if p_score < 0 or p_score > 2000000 then raise exception 'bad score'; end if;

  insert into public.scores (player_id, mode, nickname, score, stars, distance)
  values (p_player, p_mode, left(btrim(p_nickname), 16),
          p_score, greatest(0, least(3, p_stars)), greatest(0, p_distance))
  on conflict (player_id, mode) do update
    set score      = greatest(public.scores.score, excluded.score),
        stars      = greatest(public.scores.stars, excluded.stars),
        distance   = greatest(public.scores.distance, excluded.distance),
        nickname   = excluded.nickname,
        updated_at = now();
end; $$;

grant execute on function public.submit_score(text, text, text, integer, integer, integer) to anon;
```

## Step 3 — Copy your two keys into the game

1. In Supabase, open **Project Settings** (gear) → **API**.
2. Copy the **Project URL** (looks like `https://abcdefghijkl.supabase.co`).
3. Copy the **anon public** key (a long text starting with `eyJ...`).
   ⚠️ Use the one labelled **anon / public**, never the **service_role** one.
4. Open `src/net/config.js` in this project and paste them in:

```js
export const LEADERBOARD = {
  url: 'https://abcdefghijkl.supabase.co',
  anonKey: 'eyJhbGciOi....your-anon-key....',
};
```

The anon key is designed to be public and safe to commit; it can only do what
the rules above allow (read the leaderboard, and submit a score).

## Step 4 — Publish

```bash
git add -A
```

```bash
git commit -m "Enable online leaderboard"
```

```bash
git push
```

About a minute later the live site has a working leaderboard. Open the game,
enter a nickname on the results screen, and submit a score to test it.

---

## How it works, in plain words

- Each device gets a **random private code** the first time it plays. That code
  owns that player's row, which is how you can improve your own score later.
- The leaderboard shows only **nickname, score, stars and distance**.
- Writing is only possible through `submit_score`, which keeps the **best**
  score and rejects impossible values.
- Players changing phones can type their **recovery code** (shown on the
  leaderboard screen) to keep their entry.

## Honest limitation

Scores are sent by the player's own browser, so a determined cheater could send
a fake score, exactly as in most small web games. The database caps absurd
values, but it cannot prove a run really happened. For a class or contest
leaderboard that is normally fine; if a score looks impossible, you can delete
that row from the Supabase table editor.
