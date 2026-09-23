# Accounts: setting up Supabase and Google sign-in

Everything in Hover Typing works without an account, and always will: tests,
Golden Nuggets, settings and your own texts are kept in the browser. An account
adds one thing — a copy of your **test history** and **your own texts** kept
with you, so another browser signed in as you has them too.

The application only offers it when this build has been given a Supabase
project. Without the two values below there is no account service, nothing is
sent anywhere, the library behind it is never even downloaded, and the sign-in
page says accounts are not switched on.

It takes about twenty minutes, all of it in two dashboards. Nothing here asks
you to type a password into this application: sign-in goes through Google, and
the only two values that reach the build are public ones.

---

## Part 1 — The Supabase project (about 5 minutes)

1. Go to **[supabase.com](https://supabase.com)** and sign in (with GitHub or
   Google — your choice; this is your account, not the typist's).
2. **New project**. Fill in:
   - **Name**: anything, e.g. `hover-typing`
   - **Database password**: click the generate button. You will not need this
     password for Hover Typing. Save it somewhere anyway — it is the only way
     back into the database directly.
   - **Region**: the one nearest you.
   - Free plan.
3. Press **Create new project** and wait a minute or two while it builds.

### Copy the two values

4. In the left sidebar, open **Project Settings** (the gear at the bottom) →
   **API Keys**.
5. Copy the **Project URL** — `https://something.supabase.co`. It may be under
   **Data API** or on the **Connect** dialog at the top of the dashboard.
6. Copy the **publishable key**. It starts with `sb_publishable_`. On an older
   project this is called the **anon** key instead; either is fine, and the
   application takes both.

> **Never copy the `secret` or `service_role` key.** That one ignores every
> rule below and must never be in a web page. If you ever paste one into a
> browser application by mistake, rotate it in the dashboard immediately.

Keep these two somewhere for Part 3.

## Part 2 — The tables (about 2 minutes)

7. In the left sidebar, open **SQL Editor** → **New query**.
8. Paste all of this in and press **Run** (or Ctrl+Enter):

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

drop policy if exists "own sessions" on public.sessions;
create policy "own sessions" on public.sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own texts" on public.texts;
create policy "own texts" on public.texts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

It should say **Success. No rows returned**. Running it again is safe.

9. Check it landed: **Table Editor** in the sidebar now lists `sessions` and
   `texts`, both empty.

## Part 3 — Google sign-in (about 10 minutes)

This is the fiddly part, because two dashboards have to agree with each other.
Do it in this order and they will.

### First, get the callback address from Supabase

10. In Supabase: **Authentication** (left sidebar) → **Sign In / Providers** →
    **Google**.
11. Switch it on. It shows a **Callback URL (for OAuth)** —
    `https://<your-project>.supabase.co/auth/v1/callback`. **Copy it.** Leave
    this page open; step 18 comes back to it.

### Then set up Google

12. Go to **[console.cloud.google.com](https://console.cloud.google.com)** and
    sign in with the Google account you want to own this.
13. At the top left, open the project picker → **New project** → name it
    (e.g. `hover-typing`) → **Create**. Make sure it is selected afterwards.
14. In the search bar at the top, search for **Google Auth Platform** and open
    it. If it offers **Get started**, take it:
    - **App name**: `Hover Typing`. **User support email**: yours.
    - **Audience**: choose **External**.
    - **Contact information**: your email. Agree and continue.
15. In **Data Access** → **Add or remove scopes**, make sure these three are
    ticked, then **Update** and **Save**:
    - `openid` (you may have to type it in to add it)
    - `.../auth/userinfo.email`
    - `.../auth/userinfo.profile`
16. In **Audience**, while the app is in **Testing**, add your own Google
    address under **Test users**. Without this, Google refuses the sign-in with
    "app has not completed verification". (Publishing the app later removes the
    limit; for your own use, test users is enough.)
17. In **Clients** → **Create client**:
    - **Application type**: **Web application**
    - **Name**: anything, e.g. `Hover Typing web`
    - **Authorised JavaScript origins** — add both:
      - `https://typing-trainer-1bvi.vercel.app`
      - `http://localhost:5173`
    - **Authorised redirect URIs** — add the callback you copied in step 11:
      - `https://<your-project>.supabase.co/auth/v1/callback`
    - **Create**. Google shows a **Client ID** and a **Client secret**. Copy
      both now.

### Then tell Supabase about it

18. Back on the Supabase **Google** provider page: paste the **Client ID** and
    **Client secret**, and **Save**.
19. In Supabase: **Authentication** → **URL Configuration**:
    - **Site URL**: `https://typing-trainer-1bvi.vercel.app`
    - **Redirect URLs** — **Add URL** twice:
      - `https://typing-trainer-1bvi.vercel.app/gg/sign-in`
      - `http://localhost:5173/gg/sign-in`

    Sign-in comes back to exactly these addresses, and Supabase refuses any
    address not on this list.

## Part 4 — Give the build the two values (about 3 minutes)

### On Vercel, for the live site

20. Open the project on **[vercel.com](https://vercel.com)** → **Settings** →
    **Environment Variables**. Add two, ticking **Production**, **Preview** and
    **Development** for each:

    | Name | Value |
    | --- | --- |
    | `VITE_SUPABASE_URL` | `https://<your-project>.supabase.co` |
    | `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` |

    (If your project gave you an `anon` key instead, name the second one
    `VITE_SUPABASE_ANON_KEY`. Either works.)

21. **Deployments** → the most recent one → **⋯** → **Redeploy**. Environment
    variables are read at build time, so the site has to be built again before
    it knows about them.

### Locally, if you want to try it on your own machine

22. Make a file called `.env.local` beside `package.json`:

    ```
    VITE_SUPABASE_URL=https://<your-project>.supabase.co
    VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
    ```

    It is already in `.gitignore`. Restart `npm run dev` afterwards.

Both values are public by design: they are in the page for anyone to read, and
what they may touch is decided by the policies in Part 2.

Set one without the other and the application refuses to start, loudly. That is
deliberate — a half-configured deployment would otherwise look like a working
one until the first sign-in.

## Part 5 — Check it works

23. Open `/gg/sign-in`. **Continue with Google** should now go to Google
    instead of saying accounts are not switched on.
24. Sign in. You should come back to the same page, with the top bar showing
    your first name and the page showing **Your account**.
25. Type a test. Then in Supabase, **Table Editor** → `sessions`: one row.
26. Open the site in another browser (or a private window), sign in as the same
    person, and look at **History** and **Your texts**. Everything is there.

---

## When something goes wrong

| What you see | What it usually is |
| --- | --- |
| "Accounts aren't switched on yet" | The build has no values: they were not set, or the site was not redeployed after setting them (step 21). |
| Google says **redirect_uri_mismatch** | The **Authorised redirect URI** in step 17 is not exactly the callback from step 11. It must be the `supabase.co/auth/v1/callback` address, not the Hover Typing one. |
| Google says the app is **not verified** or blocks you | Your address is not in **Test users** (step 16). |
| Signs in, then bounces back signed out | The address you landed on is not in **Redirect URLs** (step 19). |
| Signed in, but history stays empty | The tables or the policies are missing: run Part 2 again and check **Table Editor**. |
| The page refuses to load at all | Only one of the two values is set. The error in the browser console says which. |

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
  last one ended with, so a test deleted on one browser is deleted on the other
  rather than coming back. For a text edited in two places, the later edit wins.
- **Failure.** A round that cannot get through changes nothing, says so on the
  account page, and is tried again next time.
- **Signing out** leaves everything in the browser exactly as it is, and
  deletes nothing from the account.

## Costs

Well inside the free plan: a test record is roughly half a kilobyte, so a year
of daily practice is a few megabytes. Supabase pauses a free project after a
week with no requests; opening the application wakes it.
