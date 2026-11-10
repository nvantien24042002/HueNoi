create role hue_catalog_editor nologin inherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;

create table public.content_sources (
  id uuid primary key default gen_random_uuid(),
  title text not null check (btrim(title) <> '' and octet_length(title) <= 512),
  locator text not null check (btrim(locator) <> '' and octet_length(locator) <= 1536),
  rights_note text,
  status text not null default 'draft' check (status in ('draft', 'published', 'withdrawn')),
  reviewed_by uuid references auth.users (id) on delete restrict,
  reviewed_at timestamptz,
  unique (title, locator),
  constraint source_publication_requires_review check (
    status <> 'published' or (
      rights_note is not null and btrim(rights_note) <> ''
      and reviewed_by is not null and reviewed_at is not null
    )
  )
);

create table public.learning_entries (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.content_sources (id) on delete restrict,
  kind text not null check (kind in ('vocabulary', 'sentence')),
  text text not null check (btrim(text) <> ''),
  meaning text not null check (btrim(meaning) <> ''),
  context text,
  example text,
  source_locator text not null check (btrim(source_locator) <> ''),
  status text not null default 'draft' check (status in ('draft', 'published', 'withdrawn'))
);

create index content_sources_reviewed_by_idx on public.content_sources (reviewed_by);
create index learning_entries_source_id_idx on public.learning_entries (source_id);
create index learning_entries_kind_status_id_idx on public.learning_entries (kind, status, id);

alter table public.content_sources enable row level security;
alter table public.learning_entries enable row level security;

revoke all on public.content_sources, public.learning_entries
  from public, anon, authenticated, service_role;

grant select (id, title, locator, status) on public.content_sources to anon, authenticated;
grant select on public.learning_entries to anon, authenticated;

grant usage on schema public to hue_catalog_editor;
grant select, insert, update on public.content_sources, public.learning_entries to hue_catalog_editor;

create policy source_public_read on public.content_sources
  for select to anon, authenticated
  using (status = 'published');

create policy entry_public_read on public.learning_entries
  for select to anon, authenticated
  using (
    status = 'published' and exists (
      select 1
      from public.content_sources as source
      where source.id = learning_entries.source_id and source.status = 'published'
    )
  );

create policy source_editor_read on public.content_sources
  for select to hue_catalog_editor using (true);
create policy source_editor_insert on public.content_sources
  for insert to hue_catalog_editor with check (true);
create policy source_editor_update on public.content_sources
  for update to hue_catalog_editor using (true) with check (true);

create policy entry_editor_read on public.learning_entries
  for select to hue_catalog_editor using (true);
create policy entry_editor_insert on public.learning_entries
  for insert to hue_catalog_editor with check (true);
create policy entry_editor_update on public.learning_entries
  for update to hue_catalog_editor using (true) with check (true);
