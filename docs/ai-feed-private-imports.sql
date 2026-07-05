create table if not exists public.ai_feed_private_imports (
  id text not null,
  owner_email text not null,
  source text not null default 'linkedin',
  source_type text not null check (source_type in ('job', 'post')),
  canonical_url text not null,
  title text not null,
  block jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_email, id)
);

create unique index if not exists ai_feed_private_imports_owner_url_uidx
  on public.ai_feed_private_imports (owner_email, canonical_url);

create index if not exists ai_feed_private_imports_owner_updated_idx
  on public.ai_feed_private_imports (owner_email, updated_at desc);

alter table public.ai_feed_private_imports enable row level security;

drop policy if exists "ai feed imports owner read" on public.ai_feed_private_imports;
create policy "ai feed imports owner read"
  on public.ai_feed_private_imports
  for select
  using (lower(owner_email) = lower(auth.jwt() ->> 'email'));

drop policy if exists "ai feed imports owner insert" on public.ai_feed_private_imports;
create policy "ai feed imports owner insert"
  on public.ai_feed_private_imports
  for insert
  with check (lower(owner_email) = lower(auth.jwt() ->> 'email'));

drop policy if exists "ai feed imports owner update" on public.ai_feed_private_imports;
create policy "ai feed imports owner update"
  on public.ai_feed_private_imports
  for update
  using (lower(owner_email) = lower(auth.jwt() ->> 'email'))
  with check (lower(owner_email) = lower(auth.jwt() ->> 'email'));

drop policy if exists "ai feed imports owner delete" on public.ai_feed_private_imports;
create policy "ai feed imports owner delete"
  on public.ai_feed_private_imports
  for delete
  using (lower(owner_email) = lower(auth.jwt() ->> 'email'));
