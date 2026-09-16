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

## What friends should know

- Their results are stored in **their own browser**. Clearing site data clears
  their history; a different browser or device starts empty. Nothing is
  uploaded, and there is no account.
- Sound is off until they choose a keyboard in the toolbar.
- It needs a physical keyboard: on-screen keyboards are not supported, and the
  screen says so on a touch device.
