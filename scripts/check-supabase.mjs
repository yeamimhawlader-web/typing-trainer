/**
 * Asks your database the one question that matters: can a stranger read it?
 *
 * The key in the page is public. Anyone can copy it out of the site and ask
 * your database for everything in it, which is exactly what this does -- with
 * no account, no password, the way a stranger would. If the answer is "no",
 * row-level security is doing its job. If the answer is "yes", every typist's
 * practice is readable by anybody and the fix is to run docs/supabase-setup.sql.
 *
 * Nothing is written, changed or deleted. The insert below is designed to be
 * refused; which refusal comes back is the whole answer:
 *
 *   - refused by the security policy  -> the lock is on
 *   - refused by the "user must exist" rule -> the request got PAST the lock,
 *     which means there is no lock
 *   - "table does not exist" -> the SQL has not been run yet
 *
 * Run it with:  npm run check:supabase
 */

import { readFileSync } from 'node:fs'

const TABLES = ['sessions', 'texts']

/** Reads .env.local the way Vite does, without needing Vite. */
const fromEnvFile = () => {
  const values = {}
  try {
    for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line)
      if (match) values[match[1]] = match[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch {
    // No file: the environment may still carry them.
  }
  return values
}

// A command-line tool talking to the person who ran it: console.log is the
// whole interface, not a stray debug line.
// oxlint-disable-next-line no-console
const say = (...parts) => console.log(...parts)

const main = async () => {
  const env = { ...fromEnvFile(), ...process.env }
  const url = env.VITE_SUPABASE_URL
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? env.VITE_SUPABASE_ANON_KEY

  if (!url || !key) {
    say('No database is set up yet, so there is nothing to check.')
    say('')
    say('When you have one: copy .env.example to .env.local, put your project')
    say('URL and public key in it, run docs/supabase-setup.sql in the Supabase')
    say('SQL Editor, then run this again.')
    return 0
  }

  say(`Asking ${url} what a stranger can see.`)
  say('')

  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
  let locked = 0
  let open = 0
  let missing = 0

  // One table at a time, on purpose: the output reads top to bottom, and two
  // tables are not worth the parallelism.
  /* oxlint-disable no-await-in-loop */
  for (const table of TABLES) {
    // 1. Read, as a stranger. A locked table answers with an empty list.
    const read = await fetch(`${url}/rest/v1/${table}?select=id&limit=5`, { headers })
    const body = await read.text()
    const rows = read.ok ? JSON.parse(body) : null

    if (read.status === 404 || /does not exist/i.test(body)) {
      say(`  ${table}: NOT THERE. The SQL has not been run on this project yet.`)
      missing += 1
      continue
    }

    if (Array.isArray(rows) && rows.length > 0) {
      say(`  ${table}: WIDE OPEN. A stranger just read ${rows.length} row(s) without signing in.`)
      open += 1
      continue
    }

    /*
     * An empty list is not proof on its own -- the table may simply be empty.
     * So ask to write something instead. It is refused either way; which
     * refusal comes back says whether anything is guarding the table.
     */
    const write = await fetch(`${url}/rest/v1/${table}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id: `rls-check-${Date.now()}`,
        user_id: '00000000-0000-0000-0000-000000000000',
        [table === 'sessions' ? 'completed_at' : 'updated_at']: 0,
        data: {},
      }),
    })
    const refusal = await write.text()

    if (write.ok) {
      say(`  ${table}: WIDE OPEN. A stranger was allowed to write to it.`)
      say('    Delete that row in the Table Editor, then run the SQL.')
      open += 1
    } else if (/row-level security/i.test(refusal)) {
      say(`  ${table}: locked. The security policy refused a stranger.`)
      locked += 1
    } else if (/foreign key|violates foreign key/i.test(refusal)) {
      say(`  ${table}: WIDE OPEN. Nothing refused the stranger except the`)
      say('    "that user does not exist" rule, which means no policy is guarding it.')
      open += 1
    } else if (/permission denied/i.test(refusal)) {
      say(`  ${table}: locked (the table is not granted to strangers at all).`)
      locked += 1
    } else {
      say(`  ${table}: unclear. The database said: ${refusal.slice(0, 200)}`)
    }
  }

  /* oxlint-enable no-await-in-loop */

  say('')
  if (missing > 0) {
    say('VERDICT: the tables are not there yet.')
    say('Open Supabase -> SQL Editor -> New query, paste docs/supabase-setup.sql, press Run.')
    return 1
  }
  if (open > 0) {
    say('VERDICT: NOT SAFE TO LAUNCH. Anyone can reach this data without an account.')
    say('Run docs/supabase-setup.sql in the Supabase SQL Editor, then run this again.')
    return 1
  }
  if (locked === TABLES.length) {
    say('VERDICT: safe. A stranger with the public key cannot read or write anything.')
    say('Row-level security is on and doing its job.')
    return 0
  }
  say('VERDICT: could not tell. Read what each table said above.')
  return 1
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error('The check could not finish:', error instanceof Error ? error.message : error)
    console.error('If the project URL is wrong or the project is paused, that would do it.')
    process.exit(1)
  },
)
