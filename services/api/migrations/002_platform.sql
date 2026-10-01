-- Platform tables: auth, sharing/publishing, end-user data, analytics, push, payments, builds.
-- Auth tables (users, sessions, magic_links) are NOT tenant-scoped and are never granted to app_user:
-- they are only reachable through the privileged connection used by the auth layer.

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'app_user') then create role app_user nologin; end if;
end $$;
-- The connecting user drops to app_user per request (SET LOCAL ROLE); that requires membership, even for non-superuser owners.
do $$ begin execute format('grant app_user to %I', current_user); end $$;

alter table tenants
  add column stripe_customer_id text,
  add column stripe_account_id text,
  add column trial_ends_at timestamptz,
  add column plan_status text not null default 'active' check (plan_status in ('active','trialing','past_due','canceled'));

create table users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  email text unique,
  password_hash text,
  anonymous boolean not null default false,
  created_at timestamptz not null default now(),
  check (anonymous or (email is not null))
);
create index users_tenant_idx on users (tenant_id);

create table sessions (
  token_hash text primary key,
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null
);

create table magic_links (
  token_hash text primary key,
  email text not null,
  expires_at timestamptz not null
);

alter table apps
  add column preview_token text unique,
  add column published_spec jsonb,
  add column published_at timestamptz,
  add column branding jsonb,
  add column rev_cursor int not null default 0,
  add column updated_at timestamptz not null default now();

alter table app_revisions add column seq int not null default 0;
create unique index app_revisions_seq_idx on app_revisions (app_id, seq);

create table app_data (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  app_id uuid not null references apps(id) on delete cascade,
  collection text not null,
  data jsonb not null,
  created_at timestamptz not null default now()
);
create index app_data_idx on app_data (app_id, collection, created_at desc);

create table events (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  app_id uuid not null references apps(id) on delete cascade,
  name text not null,
  screen text,
  device_id text not null,
  at timestamptz not null default now()
);
create index events_idx on events (app_id, at);

create table push_devices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  app_id uuid not null references apps(id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios','android','web')),
  created_at timestamptz not null default now(),
  unique (app_id, token)
);

create table push_campaigns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  app_id uuid not null references apps(id) on delete cascade,
  title text not null,
  body text not null,
  send_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled','sending','sent','failed')),
  sent_count int not null default 0,
  error text,
  created_at timestamptz not null default now()
);
create index push_campaigns_due_idx on push_campaigns (status, send_at);

create table orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  app_id uuid not null references apps(id) on delete cascade,
  items jsonb not null,
  total_cents int not null check (total_cents >= 0),
  currency text not null,
  status text not null default 'pending' check (status in ('pending','paid','failed','refunded')),
  provider text not null,
  provider_ref text,
  created_at timestamptz not null default now()
);
create index orders_idx on orders (app_id, created_at desc);
create unique index orders_provider_ref_idx on orders (provider, provider_ref) where provider_ref is not null;

create table builds (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  app_id uuid not null references apps(id) on delete cascade,
  platform text not null check (platform in ('ios','android')),
  status text not null default 'queued' check (status in ('queued','building','submitted','failed')),
  bundle_id text not null,
  log text not null default '',
  provider text not null,
  created_at timestamptz not null default now()
);
create index builds_idx on builds (app_id, created_at desc);

do $$
declare t text;
begin
  foreach t in array array['app_data','events','push_devices','push_campaigns','orders','builds'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I using (tenant_id = current_tenant()) with check (tenant_id = current_tenant())', t || '_isolation', t);
  end loop;
end $$;

grant usage on schema public to app_user;
grant select, insert, update, delete on tenants, apps, app_revisions, app_data, events, push_devices, push_campaigns, orders, builds to app_user;
grant usage on all sequences in schema public to app_user;
grant execute on function current_tenant() to app_user;
