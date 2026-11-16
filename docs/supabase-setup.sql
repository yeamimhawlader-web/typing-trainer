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
--
-- This, and not the secrecy of the key in the page, is what keeps them apart.
-- The key in the page is meant to be public; anyone can read it and ask this
-- database a question. These two lines are what decide the answer. Without
-- them, one question returns everybody's practice.
alter table public.sessions enable row level security;
alter table public.texts enable row level security;

drop policy if exists "own sessions" on public.sessions;
create policy "own sessions" on public.sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own texts" on public.texts;
create policy "own texts" on public.texts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
