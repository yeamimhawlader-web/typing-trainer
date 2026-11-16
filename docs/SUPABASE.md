# Accounts: setting up Supabase

Everything in Hover Typing works without an account, and always will: tests,
Golden Nuggets, settings and your own texts are kept in the browser. An account
adds one thing: a copy of your **test history**, **your own texts**, your
**Golden Nuggets** and your **settings**, kept with you — so another browser
signed in as you opens with your theme, your font and your words already there.

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
8. Open `docs/supabase-setup.sql`, copy the whole file, paste it here and
   press **Run** (or Ctrl+Enter).

   It is not reproduced here on purpose: two copies of the same SQL drift, and
   the one you run should be the one the application is actually written
   against. What it makes is four tables, each of them one person's practice:

   | Table         | What it holds                              |
   | ------------- | ------------------------------------------ |
   | `sessions`    | Finished tests                             |
   | `texts`       | Quotes, goals and word lists you wrote     |
   | `nuggets`     | The words that keep costing you mistakes   |
   | `preferences` | Theme, font, sound, caret, practice length |

   Then it switches row-level security on for all four and gives each one the
   same rule: you reach your own rows and nobody else's.

   It should say **Success. No rows returned**. Running it again is safe.

9. Check it landed: **Table Editor** in the sidebar now lists `sessions`,
   `texts`, `nuggets` and `preferences`, all empty.

> **Already had a project before Golden Nuggets and settings were kept with an
> account?** Run the file again. Every statement in it checks whether it has
> already been done, so it adds the two new tables and leaves your existing
> rows exactly as they are.

10. **Prove the lock is on**, which is the part worth doing properly. With your
    project URL and public key in `.env.local`, run:

    ```
    npm run check:supabase
    ```

    It asks your database for everything in it with no account and no password,
    exactly as a stranger would, and says in plain words whether it got
    anything. Nothing is written or deleted. You want to see:

    ```
    VERDICT: safe. A stranger with the public key cannot read or write anything.
    ```

    Anything else tells you what to fix. Run it again whenever the database
    changes — a restore from a backup, a table rebuilt by hand, or an AI
    editing the schema can all switch the lock off without saying so.

## Part 3 — Where the link is allowed to land (about 1 minute)

11. Left sidebar: **Authentication** → **URL Configuration**.
12. **Site URL**: the address the site is actually served from, with no
    trailing slash. Today that is `https://typing-trainer-1bvi.vercel.app`; on
    a custom domain it is that domain instead, and this has to be changed on
    the day the domain goes live or the email link will send people to the old
    address.
13. **Redirect URLs** → **Add URL**, once for each address the site answers on:
    - `<site url>/gg/sign-in`
    - `http://localhost:5173/gg/sign-in` (so it can be tried locally)

    Keeping the old `vercel.app` entry alongside a new domain is fine and
    saves a locked-out afternoon while the domain settles.

The link in the email lands on exactly these, and Supabase refuses any address
not on the list.

That is the whole of the sign-in setup. Email sign-in is on by default in a new
project; there is no provider to switch on.

> Supabase's own mail server sends a handful of these an hour, which is plenty
> for you and your own machines. If this ever has real users, add an SMTP
> provider under **Authentication → Emails**. Nothing in the application changes.

## Part 4 — Give the build the two values (about 3 minutes)

### On Vercel, for the live site

14. Open the project on **[vercel.com](https://vercel.com)** → **Settings** →
    **Environment Variables**. Add two, ticking **Production**, **Preview** and
    **Development** for each:

    | Name                            | Value                                |
    | ------------------------------- | ------------------------------------ |
    | `VITE_SUPABASE_URL`             | `https://<your-project>.supabase.co` |
    | `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…`                   |

    (If your project gave you an `anon` key instead, name the second one
    `VITE_SUPABASE_ANON_KEY`. Either works.)

15. **Deployments** → the most recent → **⋯** → **Redeploy**. The values are
    read when the site is built, so it has to be built again to know about them.

### Locally, if you want to try it on your own machine

16. Make a file called `.env.local` beside `package.json`:

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

17. Open `/gg/sign-in`. It should show an address field and **Email me a link**,
    rather than saying accounts are not switched on.
18. Type your address and press it. The page says the link is on its way.
19. Open the link from your inbox. You land back on the same page, the top bar
    shows your name, and the page shows **Your account**.
20. Type a test. In Supabase, **Table Editor** → `sessions`: one row.
21. Open the site in another browser, sign in the same way, and look at
    **History** and **Your texts**. Everything is there.
22. Still in that second browser: the theme, font and practice length you set
    in the first one should already be applied, and **Golden Nuggets** should
    list the same words. That is the settings and the nuggets arriving.

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
   - **Authorised JavaScript origins**: every address the site answers on, so
     `https://typing-trainer-1bvi.vercel.app` today, the custom domain as well
     once there is one, and `http://localhost:5173`
   - **Authorised redirect URIs**: the callback from step 1. It is the
     **supabase.co** address, not the Hover Typing one. This is the single most
     common mistake.
   - **Create**, then copy the **Client ID** and **Client secret**.
7. Back on the Supabase Google page: paste both, **Save**. Google can take a
   few minutes to notice a change to a client; a `redirect_uri_mismatch` that
   appears right after saving is worth one retry before hunting for it.
8. **Last step, and the button will not appear without it.** Add one more
   environment variable in Vercel, the same way you added the other two
   (Settings -> Environment Variables), then redeploy:

   | Name                   | Value  |
   | ---------------------- | ------ |
   | `VITE_SUPABASE_GOOGLE` | `true` |

The redirect URLs from Part 3 already cover where Google sends people back to.

### Before anyone but you uses it

While the Google app is in **Testing**, only the addresses under **Test users**
can sign in — everyone else is turned away — and there is a hard limit of 100 of
them. So publish it: **Google Auth Platform → Audience → Publish app**.

The reassuring part: this application asks only for `openid`, `email` and
`profile`, which Google treats as non-sensitive. Publishing with only those
takes effect immediately and needs no review, no demonstration video and no
privacy-policy audit. The verification process people warn about is for the
sensitive scopes — reading someone's mail or their files — and none of them are
asked for here.

If a sign-in ever fails, the page now says why in plain words rather than
returning you to an empty form; `src/core/accounts/sign-in-return.ts` holds the
sentences, and anything it has not met gets a sensible fallback.

**Why the extra variable.** Until you have done the seven steps above, your
project has no Google client, and Supabase answers anyone who presses the
button with "provider is not enabled" — a dead end on the one page that leads
to an account. So the button is drawn only where this says Google is ready. Set
it and the button appears; leave it unset and the email link is the way in,
which is the way in that needs none of this.

---

## When something goes wrong

| What you see                                                        | What it usually is                                                                                                          |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| "Accounts aren't switched on yet"                                   | The build has no values: not set, or the site was not redeployed after setting them (step 15).                              |
| The link never arrives                                              | Check spam. Then **Authentication → Logs** in Supabase: its own mail server allows a handful an hour and says so there.     |
| The link opens, then you are signed out again                       | The address it landed on is not in **Redirect URLs** (Part 3).                                                              |
| Signed in, but history stays empty                                  | The tables or the policies are missing. Run Part 2 again and check **Table Editor**.                                        |
| History syncs, but nuggets or settings do not                       | `nuggets` and `preferences` came later. Run `docs/supabase-setup.sql` again; it adds them and leaves everything else alone. |
| Signing in replaced the settings on this browser                    | Working as intended: settings follow the person. Change them here and they go back up.                                      |
| A sign-in that fails now says why                                   | It always should. If a failed sign-in ever lands on a silent form again, that is a bug, not a setting.                      |
| Google says **redirect_uri_mismatch**                               | The redirect URI is not exactly the Supabase callback. It ends `/auth/v1/callback`.                                         |
| Google says the app is **not verified**                             | Your address is not in **Test users**, or the app is still in Testing and should be published.                              |
| There is no **Continue with Google** button                         | `VITE_SUPABASE_GOOGLE` is not set to `true`, or the site was not redeployed after setting it (step 8).                      |
| Google sign-in fails with nothing in the page but a blocked request | The project has a custom auth domain that `connect-src` in `vercel.json` does not name. See DEPLOY.md.                      |
| The page refuses to load at all                                     | Only one of the two values is set. The browser console names which.                                                         |

## What is kept, and what is not

|                                        | Where                             |
| -------------------------------------- | --------------------------------- |
| Test history                           | This browser **and** your account |
| Your own texts                         | This browser **and** your account |
| Golden Nuggets                         | This browser **and** your account |
| Settings, themes, sound                | This browser **and** your account |
| Keystroke detail behind the statistics | This browser only                 |

Keystroke detail is by far the largest thing stored and is only ever read by the
analyses on the machine that recorded it; the session records carry every number
the history and statistics pages show.

Settings follow the person rather than the machine, which is what a typist
signing in on a laptop expects and what Monkeytype does. The one consequence
worth knowing: sign in on a browser you had set up differently and the
account's settings replace that browser's. They are not merged — there is no
sensible way to merge two themes.

## How syncing behaves

- **Local first.** Every test is written to this browser as it is finished.
  Syncing happens afterwards and never delays typing.
- **When.** On signing in, on coming back to the tab, and after each saved test.
- **Merging.** The first round after signing in merges: everything on either
  side ends up on both. After that, each round is compared against what the last
  one ended with, so a test deleted on one browser is deleted on the other
  rather than coming back. For a text edited in two places, the later edit wins,
  and for settings chosen in two places the later choice wins.
- **Golden Nuggets are added up, not replaced.** A nugget is a tally, so where
  both sides have the same word the two records are joined: the larger of each
  count, the earlier first sighting, the later last one. Taking the newer record
  whole would throw away the other side's counting. It is still not a perfect
  total — practise the same word on two machines between syncs and you end on
  the larger count rather than the sum — which is a deliberate trade, and
  nothing is ever lost by it.
- **Failure.** A round that cannot get through changes nothing, says so on the
  account page, and is tried again next time.
- **Signing out** leaves everything in the browser exactly as it is, and deletes
  nothing from the account.

### Two people on one browser

If a **second person** signs in on a browser where someone else's account has
already synced, the first person's history is **not** sent to the second
person's account. It stays on the browser, untouched — their keystroke detail
lives only there — and if they sign back in, it is still theirs. The second
person's own history comes down as usual.

The same holds for the two things an account carries besides history:

- **Golden Nuggets.** The first person's words are not sent up, and — the part
  that takes care — they are not merged into the second person's record of the
  same word either. Two typists both struggling with `because` is the ordinary
  case, not a coincidence, so the second person's own record is taken whole
  rather than added to. Their count stays their count.
- **Settings.** The first person's theme, font and sound are not sent up, and
  do not replace the second person's. Where the second person's account has
  settings, those are taken, however much older; being older than a stranger's
  is no reason to be replaced by them. Where the account has none, nothing
  happens and the browser goes on looking as it did — and goes on not sending
  them, round after round, until the second person changes something. The
  moment they do, the settings are theirs and go up like anyone's.

Practice typed on a browser before _anyone_ has signed in on it still goes up
with the first sign-in, which is how your practice from before you signed up
reaches your account.

What is not separated: while the second person is signed in, the History page
on that browser still _shows_ the first person's tests, because everything is
kept in the browser first. That is no more than it showed before anyone signed
in; it is never uploaded to the wrong account.

## Costs

Comfortably inside the free plan. A stored test measures about 650 bytes, so the
500 MB free database holds roughly 800,000 of them: two hundred years at ten
tests a day. The nuggets and the settings do not move that figure — a few dozen
short records and one row per person between them. Free projects pause after a week with no requests, and opening the
application wakes it.
