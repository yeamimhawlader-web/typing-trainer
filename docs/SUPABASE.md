# Accounts: setting up Supabase and Google sign-in

Everything in Hover Typing works without an account, and always will: tests,
Golden Nuggets, settings and your own texts are kept in the browser. An account
adds one thing — a copy of your **test history** and **your own texts** kept
with you, so another browser signed in as you has them too.

The application only offers it when this build has been given a Supabase
project. Without the two variables below there is no account service, nothing
is sent anywhere, and the sign-in page says so.

Nothing in this file needs a password to be typed into the application. Sign-in
goes through Google, and the only two values that reach the build are public
ones.

---

## 1. Make the project

1. Sign in at [supabase.com](https://supabase.com) and create a project. Any
   region near you; the free plan is far more than this needs.
2. Open **Project Settings → API** and copy:
   - **Project URL** — `https://<something>.supabase.co`
   - the **anon / publishable** key (the long one marked `anon` / `public`)

Copy the `anon` key, never the `service_role` key. The `service_role` key
ignores every rule below; it must never be in a web page.

## 2. Make the tables

Open **SQL Editor** in Supabase, paste all of this, and run it.

```sql
-- Finished tests. Written once and never edited, so the id is the whole story.
create table if not exists public.sessions (
  id           text primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  completed_at bigint not null,
  data         jsonb not null,
  synced_at    timestamptz not null default now()
);

-- Your own texts: quotes, goals, word lists. Edited, so the time matters.
create table if not exists public.texts (
  id         text primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  updated_at bigint not null,
  data       jsonb not null,
  synced_at  timestamptz not null default now()
);

create index if not exists sessions_user_idx on public.sessions (user_id, completed_at desc);
create index if not exists texts_user_idx on public.texts (user_id, updated_at desc);

-- Row-level security: each person reaches their own rows and nobody else's.
-- This, not the secrecy of the key in the page, is what keeps them apart.
alter table public.sessions enable row level security;
alter table public.texts enable row level security;

create policy "own sessions" on public.sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own texts" on public.texts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

Run it a second time and nothing breaks, except that the two `create policy`
lines will say the policies already exist. That is fine.

## 3. Switch on Google

In **Google Cloud Console** ([console.cloud.google.com](https://console.cloud.google.com)):

1. **APIs & Services → OAuth consent screen**: set it up as **External**, give
   it the application name and your email. While it is in testing, add your own
   Google account under **Test users**.
2. **APIs & Services → Credentials → Create credentials → OAuth client ID**,
   type **Web application**.
3. Under **Authorised redirect URIs**, add exactly this, with your own project
   reference:

   ```
   https://<your-project>.supabase.co/auth/v1/callback
   ```

4. Copy the **Client ID** and **Client secret**.

Then in Supabase, **Authentication → Providers → Google**: switch it on, paste
the client id and secret, and save.

Finally, **Authentication → URL Configuration**:

- **Site URL**: `https://typing-trainer-1bvi.vercel.app`
- **Redirect URLs**: add both
  - `https://typing-trainer-1bvi.vercel.app/gg/sign-in`
  - `http://localhost:5173/gg/sign-in` (so it can be tried locally)

## 4. Give the build the two values

Locally, in `.env.local`:

```
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<the anon key>
```

On Vercel: **Project → Settings → Environment Variables**, the same two names
and values, for Production and Preview, then redeploy.

Both are public by design: they are in the page for anyone to read, and what
they may touch is decided by the policies in step 2.

Set one without the other and the application refuses to start, loudly. That is
deliberate — a half-configured deployment would otherwise look like a working
one until the first sign-in.

## 5. Check it

1. Open `/gg/sign-in`. With the variables set, **Continue with Google** goes to
   Google; without them, the page says accounts are not switched on.
2. Sign in. The top bar says your name, and the page becomes your account.
3. Type a test. Open **Table Editor → sessions** in Supabase: a row.
4. Sign in on another browser. The history and the texts are there.

---

## What is kept, and what is not

| | Where |
| --- | --- |
| Test history | This browser **and** your account |
| Your own texts | This browser **and** your account |
| Keystroke detail behind the statistics | This browser only |
| Settings, themes, sound | This browser only |
| Golden Nuggets | This browser only |

Keystroke detail is by far the largest thing stored and is only ever read by
the analyses on the machine that recorded it; the session records carry every
number the history and statistics pages show.

## How syncing behaves

- **Local first.** Every test is written to this browser as it is finished.
  Syncing happens afterwards and never delays typing.
- **When.** On signing in, on coming back to the tab, and after each saved test.
- **Merging.** The first round after signing in merges: everything on either
  side ends up on both. After that, each round is compared against what the
  last one ended with, so a test deleted on one browser is deleted on the
  other rather than coming back. For a text edited in two places, the later
  edit wins.
- **Failure.** A round that cannot get through changes nothing, says so on the
  account page, and is tried again next time.
- **Signing out** leaves everything in the browser exactly as it is, and
  deletes nothing from the account.

## Costs and limits

Well inside the free plan: a test record is roughly half a kilobyte, so a year
of daily practice is a few megabytes. Supabase pauses a free project after a
week with no requests; opening the application wakes it.
