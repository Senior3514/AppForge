-- Accounts hardening (email verification, password reset, blocking) and per-tenant AI provider keys (BYOK) with usage metering.

alter table users
  add column email_verified_at timestamptz,
  add column blocked boolean not null default false;

-- One-time tokens for email verification and password reset. Like the other auth tables, never granted to app_user.
create table auth_tokens (
  token_hash text primary key,
  user_id uuid not null references users(id) on delete cascade,
  kind text not null check (kind in ('verify','reset')),
  expires_at timestamptz not null
);
create index auth_tokens_user_idx on auth_tokens (user_id, kind);

-- A tenant's own AI provider key. The key is stored encrypted (AES-256-GCM, server secret); only the last 4 chars are ever shown.
create table ai_providers (
  tenant_id uuid primary key references tenants(id) on delete cascade,
  provider text not null check (provider in ('openrouter','anthropic','openai')),
  model text not null,
  key_enc text not null,
  key_last4 text not null,
  last_test_at timestamptz,
  last_test_ok boolean,
  last_test_error text,
  updated_at timestamptz not null default now()
);

create table ai_usage (
  id bigserial primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  at timestamptz not null default now(),
  task text not null,
  source text not null check (source in ('user','platform','mock')),
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  cost_usd numeric(12,6) not null default 0
);
create index ai_usage_idx on ai_usage (tenant_id, at desc);

-- Accounts that predate verification are treated as verified.
update users set email_verified_at = now() where email is not null;

alter table ai_providers enable row level security;
alter table ai_usage enable row level security;
create policy tenant_isolation on ai_providers using (tenant_id = current_tenant()) with check (tenant_id = current_tenant());
create policy tenant_isolation on ai_usage using (tenant_id = current_tenant()) with check (tenant_id = current_tenant());
grant select, insert, update, delete on ai_providers, ai_usage to app_user;
grant usage on sequence ai_usage_id_seq to app_user;
