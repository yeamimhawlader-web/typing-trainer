# Deploying

The application is a static site: HTML, CSS, one JavaScript bundle. There is no
server, no database and no API — every session, preference and Golden Nugget
lives in the typist's own browser. So "deploying" is publishing a folder, and
any static host will do; these are the steps for Vercel, which rebuilds on
every push.

## The chain

```
commit → push to GitHub → Vercel builds → friends open the link
```

## Once, to set it up

1. **Make the GitHub repository.** Empty, no README or licence — this repository
   already has its own history.
2. **Point this checkout at it and push:**

   ```bash
   git remote add origin https://github.com/<you>/typing-trainer.git
   git push -u origin main
   ```

3. **Import it on Vercel** (vercel.com → Add New → Project → the repository).
   Everything it asks for is already answered by `vercel.json`: Vite, `npm run
build`, `dist`. Nothing needs an environment variable, because nothing here
   talks to anything.

## After that

Every push to `main` is a new build at the project's URL — that link is what to
send. Every other branch and pull request gets its own preview URL, which is the
safer thing to hand to friends mid-change: the main link keeps working while a
preview is being looked at.

To check what they will get before pushing:

```bash
npm run verify   # typecheck, lint, the whole suite
npm run build    # the production bundle
npm run preview  # serves dist/ exactly as the host will
```

## Why `vercel.json` exists

The routes are client-side: `/gg/hover`, `/gg/hover/nuggets`, `/gg/syllables`, `/gg/nuggets`,
`/history/<id>`. A static host asked for `/gg/nuggets` looks for a file of that
name, finds none and answers 404 — so the rewrite hands every path that is not a
real file to `index.html`, and the application reads the path itself. The headers
cache the hashed bundles forever and the HTML not at all, so a new build reaches
people on their next visit rather than whenever their browser gives up on a stale
copy.

Every response also carries security headers. The Content-Security-Policy names
exactly what the page may load: its own files, Google profile pictures, and
Supabase for accounts. Anything new from another address (an analytics script, a
font service, another image host) is refused until it is added there. The
photographs are served from `public/photos`, so no image host is named at all.

One thing to know before changing it: `connect-src` names
`https://*.supabase.co`, which is where a Supabase project answers. Give the
project a **custom auth domain** in Supabase and that stops matching, so
sign-in fails with a blocked request and no obvious cause. Add the new host
there at the same time. The one inline script, which sets the theme before first paint, is
allowed by its hash; `src/styles/first-paint-csp.test.ts` fails with the new hash
if that script changes.

## Moving to a custom domain

A browser treats two addresses as two unrelated places, so everything saved
under the `vercel.app` address stays there: every visitor, the author included,
arrives at the new domain with an empty history. There is no way around that
from the server. What there is, is **Settings → Your data** — save a copy on
the old address, restore it on the new one.

Three things to do on the day, none of them in this repository:

1. Point the old address at the new one (Vercel → Domains → Redirect), or both
   stay live as two separate sites, each with its own saved data.
2. If sign-in is connected, add the new domain in Supabase (Site URL and
   Redirect URLs) and in Google's OAuth client, or the email link will send
   people back to the old address. See `docs/SUPABASE.md`.
3. Nothing in `vercel.json` names the domain, so the headers follow by
   themselves.

## What friends should know

- Their results are stored in **their own browser**. Clearing site data clears
  their history, and a different browser or device starts empty — unless they
  sign in, which is optional and off entirely until a Supabase project is
  configured. Signed in, their history, their texts, their Golden Nuggets and
  their settings are kept with the account and follow them between browsers;
  the keystroke detail behind the statistics never leaves the machine that
  recorded it.
- **Settings → Your data** saves all of it to one file and puts it back, which
  is how a typist moves to another computer -- or follows the site to a new
  address. Restoring replaces whatever is in that browser rather than merging.
- Sound is off until they choose a keyboard in the toolbar.
- It needs a physical keyboard: on-screen keyboards are not supported, and the
  screen says so on a touch device.
