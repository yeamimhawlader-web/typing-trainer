# Accounts: setting up Supabase

Everything in Hover Typing works without an account, and always will: tests,
Golden Nuggets, settings and your own texts are kept in the browser. An account
adds one thing: a copy of your **test history** and **your own texts** kept with
you, so another browser signed in as you has them too.

The application only offers it when this build has been given a Supabase
project. Without the two values below there is no account service, nothing is
sent anywhere, the library behind it is never even downloaded, and the sign-in
page says accounts are not switched on.

**About seven minutes, all of it in one dashboard.** Signing in is a link sent
to your address: you type your email, you get a link, you click it, you are in.
That needs nothing registered anywhere else, which is why it is the path below.

Google sign-in works too, and it is one click rather than an email, but it costs
a Google Cloud project and an OAuth client. It is at the end, and it is
optional. Nothing here asks you to type a password into this application, which
holds none.

---

## Part 1 — The project, and the two values (about 5 minutes)

1. Go to **[supabase.com](https://supabase.com)** and sign in (GitHub or Google,
   your choice; this is your account, not the typist's).
2. **New project**:
   - **Name**: anything, e.g. `hover-typing`
   - **Database password**: press generate. You will not need it for Hover
     Typing; save it anyway, it is the only way back into the database directly.
   - **Region**: the one nearest you. **Free** plan.
3. **Create new project**, and wait a minute or two while it builds.
4. In the left sidebar: **Project Settings** (the gear, at the bottom) →
   **API Keys**.
5. Copy the **Project URL**, `https://something.supabase.co`. It may be under
   **Data API**, or in the **Connect** dialog at the top of the dashboard.
6. Copy the **publishable key**. It starts with `sb_publishable_`. An older
   project calls this the **anon** key instead; either is fine, the application
   takes both.

> **Never copy the `secret` or `service_role` key.** That one ignores every rule
> below and must never be in a web page. If one ever lands in a browser
> application by mistake, rotate it in the dashboard immediately.

Keep those two for Part 4.

## Part 2 — The tables (about 2 minutes)

7. Left sidebar: **SQL Editor** → **New query**.
8. Paste all of this and press **Run** (or Ctrl+Enter):

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

## Part 3 — Where the link is allowed to land (about 1 minute)

10. Left sidebar: **Authentication** → **URL Configuration**.
11. **Site URL**: `https://typing-trainer-1bvi.vercel.app`
12. **Redirect URLs** → **Add URL**, twice:
    - `https://typing-trainer-1bvi.vercel.app/gg/sign-in`
    - `http://localhost:5173/gg/sign-in` (so it can be tried locally)

The link in the email lands on exactly these, and Supabase refuses any address
not on the list.

That is the whole of the sign-in setup. Email sign-in is on by default in a new
project; there is no provider to switch on.

> Supabase's own mail server sends a handful of these an hour, which is plenty
> for you and your own machines. If this ever has real users, add an SMTP
> provider under **Authentication → Emails**. Nothing in the application changes.

## Part 4 — Give the build the two values (about 3 minutes)

### On Vercel, for the live site

13. Open the project on **[vercel.com](https://vercel.com)** → **Settings** →
    **Environment Variables**. Add two, ticking **Production**, **Preview** and
    **Development** for each:

    | Name | Value |
    | --- | --- |
    | `VITE_SUPABASE_URL` | `https://<your-project>.supabase.co` |
    | `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` |

    (If your project gave you an `anon` key instead, name the second one
    `VITE_SUPABASE_ANON_KEY`. Either works.)

14. **Deployments** → the most recent → **⋯** → **Redeploy**. The values are
    read when the site is built, so it has to be built again to know about them.

### Locally, if you want to try it on your own machine

15. Make a file called `.env.local` beside `package.json`:

    ```
    VITE_SUPABASE_URL=https://<your-project>.supabase.co
    VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
    ```

    It is already ignored by git. Restart `npm run dev` afterwards.

Both values are public by design: they are in the page for anyone to read, and
what they may touch is decided by the policies in Part 2.

Set one without the other and the application refuses to start, loudly. That is
deliberate: a half-configured deployment would otherwise look like a working one
until the first sign-in.

## Part 5 — Check it works

16. Open `/gg/sign-in`. It should show an address field and **Email me a link**,
    rather than saying accounts are not switched on.
17. Type your address and press it. The page says the link is on its way.
18. Open the link from your inbox. You land back on the same page, the top bar
    shows your name, and the page shows **Your account**.
19. Type a test. In Supabase, **Table Editor** → `sessions`: one row.
20. Open the site in another browser, sign in the same way, and look at
    **History** and **Your texts**. Everything is there.

---

## Optional: Google sign-in (about 10 minutes)

Only if you want the one-click button. Email links already work without any of
this, and the two dashboards below have to agree with each other exactly.

1. In Supabase: **Authentication** → **Sign In / Providers** → **Google**.
   Switch it on, and **copy the Callback URL** it shows,
   `https://<your-project>.supabase.co/auth/v1/callback`. Leave the page open.
2. Go to **[console.cloud.google.com](https://console.cloud.google.com)**. Top
   left, project picker → **New project** → name it → **Create**, and make sure
   it is selected.
3. Search the top bar for **Google Auth Platform** and open it. Take **Get
   started**: app name `Hover Typing`, your email as support contact,
   **Audience: External**, your email again as contact.
4. **Data Access** → **Add or remove scopes**: tick `openid` (you may have to
   type it to add it), `.../auth/userinfo.email`, `.../auth/userinfo.profile`.
   **Update**, then **Save**.
5. **Audience** → while the app is in **Testing**, add your own Google address
   under **Test users**. Without it Google refuses with "app has not completed
   verification".
6. **Clients** → **Create client** → **Web application**:
   - **Authorised JavaScript origins**: `https://typing-trainer-1bvi.vercel.app`
     and `http://localhost:5173`
   - **Authorised redirect URIs**: the callback from step 1. It is the
     **supabase.co** address, not the Hover Typing one. This is the single most
     common mistake.
   - **Create**, then copy the **Client ID** and **Client secret**.
7. Back on the Supabase Google page: paste both, **Save**.

The redirect URLs from Part 3 already cover where Google sends people back to.

---

## When something goes wrong

| What you see | What it usually is |
| --- | --- |
| "Accounts aren't switched on yet" | The build has no values: not set, or the site was not redeployed after setting them (step 14). |
| The link never arrives | Check spam. Then **Authentication → Logs** in Supabase: its own mail server allows a handful an hour and says so there. |
| The link opens, then you are signed out again | The address it landed on is not in **Redirect URLs** (Part 3). |
| Signed in, but history stays empty | The tables or the policies are missing. Run Part 2 again and check **Table Editor**. |
| Google says **redirect_uri_mismatch** | The redirect URI is not exactly the Supabase callback. It ends `/auth/v1/callback`. |
| Google says the app is **not verified** | Your address is not in **Test users**. |
| The page refuses to load at all | Only one of the two values is set. The browser console names which. |

## What is kept, and what is not

| | Where |
| --- | --- |
| Test history | This browser **and** your account |
| Your own texts | This browser **and** your account |
| Keystroke detail behind the statistics | This browser only |
| Settings, themes, sound | This browser only |
| Golden Nuggets | This browser only |

Keystroke detail is by far the largest thing stored and is only ever read by the
analyses on the machine that recorded it; the session records carry every number
the history and statistics pages show.

## How syncing behaves

- **Local first.** Every test is written to this browser as it is finished.
  Syncing happens afterwards and never delays typing.
- **When.** On signing in, on coming back to the tab, and after each saved test.
- **Merging.** The first round after signing in merges: everything on either
  side ends up on both. After that, each round is compared against what the last
  one ended with, so a test deleted on one browser is deleted on the other
  rather than coming back. For a text edited in two places, the later edit wins.
- **Failure.** A round that cannot get through changes nothing, says so on the
  account page, and is tried again next time.
- **Signing out** leaves everything in the browser exactly as it is, and deletes
  nothing from the account.

### One known rough edge

If a **second person** signs in on a browser someone else has already used, the
history already on that browser is merged into the second person's account. On a
machine one person uses, which is the normal case, this is exactly right: it is
how your practice from before you signed up reaches your account. On a shared
machine it is wrong, and it is not fixed yet. Ask, and it will be.

## Costs

Comfortably inside the free plan. A stored test measures about 650 bytes, so the
500 MB free database holds roughly 800,000 of them: two hundred years at ten
tests a day. Free projects pause after a week with no requests, and opening the
application wakes it.
