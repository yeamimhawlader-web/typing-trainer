-- Hover Typing: the whole database, in one file.
--
-- Open your Supabase project, go to SQL Editor -> New query, paste all of
-- this, and press Run. It should say "Success. No rows returned". Running it
-- again is safe: every statement here says "if not exists" or "drop ... if
-- exists" first, so it cannot do anything twice.
--
-- Afterwards, prove it worked:  npm run check:supabase
--
-- The long version of this, with screenshots of where each button is, is in
-- docs/SUPABASE.md. This file is the same SQL with nothing in between.

-- Four tables, and every one of them is one person's practice: finished tests,
-- the texts they wrote, the words that keep costing them mistakes, and the
-- settings they type under. Nothing here is public, and nothing is shared
-- between people.

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

-- Golden Nuggets: the words that keep costing mistakes.
--
-- The key here is the PAIR of columns, not the id, and that is not a detail.
-- A nugget's id is "language:word", so every typist who struggles with
-- "because" has a row whose id is "en:because". Keyed on the id alone, the
-- second typist to meet that word would be writing over the first one's row --
-- which the policy below rightly refuses, and that refusal would then break
-- every round of syncing for them, not just the one word.
create table if not exists public.nuggets (
  id           text not null,
  user_id      uuid not null references auth.users (id) on delete cascade,
  last_seen_at bigint not null,
  data         jsonb not null,
  synced_at    timestamptz not null default now(),
  primary key (user_id, id)
);

-- Settings: theme, font, sound, caret, practice length. One row per person,
-- holding all of them together, because they are chosen and read as one set.
create table if not exists public.preferences (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  updated_at bigint not null,
  data       jsonb not null,
  synced_at  timestamptz not null default now()
);

create index if not exists sessions_user_idx on public.sessions (user_id, completed_at desc);
create index if not exists texts_user_idx on public.texts (user_id, updated_at desc);
-- The nuggets and preferences need none: their primary keys already begin with
-- user_id, which is the only thing either is ever looked up by.

-- Row-level security: each person reaches their own rows and nobody else's.
--
-- This, and not the secrecy of the key in the page, is what keeps them apart.
-- The key in the page is meant to be public; anyone can read it and ask this
-- database a question. What follows is what decides the answer. Without it,
-- one question returns everybody's practice.
alter table public.sessions enable row level security;
alter table public.texts enable row level security;
alter table public.nuggets enable row level security;
alter table public.preferences enable row level security;

drop policy if exists "own sessions" on public.sessions;
create policy "own sessions" on public.sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own texts" on public.texts;
create policy "own texts" on public.texts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own nuggets" on public.nuggets;
create policy "own nuggets" on public.nuggets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own preferences" on public.preferences;
create policy "own preferences" on public.preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
