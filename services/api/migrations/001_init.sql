-- Multi-tenant core. Every tenant-owned table carries tenant_id and is protected by RLS.
-- The request's tenant is set per transaction: SELECT set_config('app.tenant_id', '<uuid>', true);
-- Tenant requests run as the unprivileged app_user role (not the table owner), so RLS applies to them. The owner connection is the
-- privileged path used only for auth and app->tenant lookups.

create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan text not null default 'free' check (plan in ('free','starter','pro','business')),
  created_at timestamptz not null default now()
);

create table apps (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  spec jsonb not null,
  created_at timestamptz not null default now()
);
create index apps_tenant_idx on apps (tenant_id);

create table app_revisions (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  app_id uuid not null references apps(id) on delete cascade,
  label text not null,
  source text not null check (source in ('ai','manual','system')),
  patch jsonb not null,
  inverse jsonb not null,
  created_at timestamptz not null default now()
);
create index app_revisions_app_idx on app_revisions (app_id, id);

create function current_tenant() returns uuid language sql stable as
  $$ select nullif(current_setting('app.tenant_id', true), '')::uuid $$;

alter table tenants enable row level security;
alter table apps enable row level security;
alter table app_revisions enable row level security;

create policy tenant_self on tenants using (id = current_tenant());
create policy apps_isolation on apps
  using (tenant_id = current_tenant()) with check (tenant_id = current_tenant());
create policy revisions_isolation on app_revisions
  using (tenant_id = current_tenant()) with check (tenant_id = current_tenant());
