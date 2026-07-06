create extension if not exists pgcrypto;
create extension if not exists citext;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  username citext not null unique,
  password_hash text not null,
  role text not null default 'user' check (role in ('admin', 'user')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  parent_id uuid references public.files(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 255),
  kind text not null check (kind in ('file', 'folder')),
  storage_path text unique,
  mime_type text,
  size bigint not null default 0 check (size >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (kind = 'folder' and storage_path is null) or
    (kind = 'file' and storage_path is not null)
  )
);

create table if not exists public.activity_logs (
  id bigint generated always as identity primary key,
  user_id uuid references public.users(id) on delete set null,
  username text,
  action text not null,
  file_name text,
  file_path text,
  ip_address text,
  user_agent text,
  device_info text,
  success boolean not null default true,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token_hash text not null unique,
  ip_address text,
  user_agent text,
  device_info text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create index if not exists files_owner_parent_idx
  on public.files(owner_id, parent_id);
create index if not exists files_parent_idx
  on public.files(parent_id);
create index if not exists activity_logs_user_created_idx
  on public.activity_logs(user_id, created_at desc);
create index if not exists activity_logs_action_created_idx
  on public.activity_logs(action, created_at desc);
create index if not exists activity_logs_ip_created_idx
  on public.activity_logs(ip_address, created_at desc);
create index if not exists sessions_user_created_idx
  on public.sessions(user_id, created_at desc);
create index if not exists sessions_token_active_idx
  on public.sessions(token_hash, expires_at)
  where revoked_at is null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

drop trigger if exists files_set_updated_at on public.files;
create trigger files_set_updated_at
before update on public.files
for each row execute function public.set_updated_at();

alter table public.users enable row level security;
alter table public.files enable row level security;
alter table public.activity_logs enable row level security;
alter table public.sessions enable row level security;

-- Uygulama yalnızca server-side Service Role Key kullanır.
-- Public/anon erişim politikası bilerek oluşturulmamıştır.

insert into storage.buckets (id, name, public)
values ('personal-files', 'personal-files', false)
on conflict (id) do update set public = false;
