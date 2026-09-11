-- ============================================================================
-- Monteclaro Tattoo & Piercing Studio — CRM schema
-- Run this once in the Supabase SQL editor (or via `supabase db push`).
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE where possible.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. PROFILES  (extends auth.users with role + display info)
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text not null default '',
  role        text not null default 'empleado' check (role in ('admin', 'empleado')),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- If the table already existed from an earlier version of this schema, add the column.
alter table public.profiles add column if not exists email text;

comment on table public.profiles is 'One row per app user, extends auth.users with role (admin/empleado).';

-- Helper: is the current JWT user an admin? SECURITY DEFINER avoids RLS recursion.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.active
  );
$$;

-- Auto-create a profile row whenever a new auth user signs up.
-- First user should be promoted to admin manually (see README).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'empleado')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 2. PAYMENT METHODS
-- ----------------------------------------------------------------------------
create table if not exists public.payment_methods (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  is_active   boolean not null default true,
  sort_order  int not null default 0
);

insert into public.payment_methods (name, sort_order) values
  ('Efectivo', 1),
  ('Tarjeta débito/crédito', 2),
  ('Transferencia bancaria', 3),
  ('Nequi / Daviplata', 4)
on conflict (name) do nothing;

-- ----------------------------------------------------------------------------
-- 3. PRODUCTS (inventario)
-- ----------------------------------------------------------------------------
create table if not exists public.products (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  sku             text unique,
  category        text not null default 'General',
  unit            text not null default 'unidad',
  stock_quantity  numeric not null default 0 check (stock_quantity >= 0),
  min_stock       numeric not null default 0,
  cost_price      numeric not null default 0,
  sale_price      numeric not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 4. CLIENTS
-- ----------------------------------------------------------------------------
create table if not exists public.clients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text,
  email       text,
  notes       text,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 5. SERVICES (catálogo: perforaciones, tatuajes, otros)
-- ----------------------------------------------------------------------------
create table if not exists public.services (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  type        text not null check (type in ('perforacion', 'tatuaje', 'joyeria', 'otro')),
  base_price  numeric not null default 0,
  is_active   boolean not null default true
);

-- ----------------------------------------------------------------------------
-- 6. TRANSACTIONS (cuadre diario: ingresos y egresos)
-- ----------------------------------------------------------------------------
create table if not exists public.transactions (
  id                 uuid primary key default gen_random_uuid(),
  type               text not null check (type in ('ingreso', 'egreso')),
  amount             numeric not null check (amount >= 0),
  payment_method_id  uuid references public.payment_methods (id),
  category           text,
  description        text,
  client_id          uuid references public.clients (id),
  service_id         uuid references public.services (id),
  transaction_date   date not null default current_date,
  created_by         uuid references public.profiles (id),
  created_at         timestamptz not null default now()
);

create index if not exists idx_transactions_date on public.transactions (transaction_date);
create index if not exists idx_transactions_type on public.transactions (type);

-- ----------------------------------------------------------------------------
-- 7. TRANSACTION ITEMS (productos consumidos manualmente, ej. en una perforación)
-- ----------------------------------------------------------------------------
create table if not exists public.transaction_items (
  id               uuid primary key default gen_random_uuid(),
  transaction_id   uuid not null references public.transactions (id) on delete cascade,
  product_id       uuid not null references public.products (id),
  quantity         numeric not null check (quantity > 0),
  unit_cost        numeric not null default 0,
  created_at       timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 8. INVENTORY MOVEMENTS (audit trail of every stock change)
-- ----------------------------------------------------------------------------
create table if not exists public.inventory_movements (
  id                       uuid primary key default gen_random_uuid(),
  product_id               uuid not null references public.products (id),
  quantity_change          numeric not null, -- negative = salida, positive = entrada
  reason                   text not null check (reason in ('venta', 'compra', 'ajuste', 'perforacion', 'joyeria', 'egreso_inicial')),
  reference_transaction_id uuid references public.transactions (id),
  notes                    text,
  created_by               uuid references public.profiles (id),
  created_at               timestamptz not null default now()
);

-- Auto-decrement stock + log movement whenever a product is consumed on a transaction
-- (this is how "una vez se haga una perforación le descuenta del inventario" is implemented).
create or replace function public.apply_transaction_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reason text;
  v_service_type text;
begin
  select s.type into v_service_type
  from public.transactions t
  left join public.services s on s.id = t.service_id
  where t.id = new.transaction_id;

  v_reason := case
    when v_service_type = 'perforacion' then 'perforacion'
    when v_service_type = 'joyeria' then 'joyeria'
    else 'venta'
  end;

  update public.products
  set stock_quantity = stock_quantity - new.quantity
  where id = new.product_id;

  insert into public.inventory_movements (product_id, quantity_change, reason, reference_transaction_id, created_by)
  values (new.product_id, -new.quantity, v_reason, new.transaction_id, (
    select created_by from public.transactions where id = new.transaction_id
  ));

  return new;
end;
$$;

drop trigger if exists on_transaction_item_insert on public.transaction_items;
create trigger on_transaction_item_insert
  after insert on public.transaction_items
  for each row execute function public.apply_transaction_item();

-- Reverse the stock movement if a transaction item is deleted (correction).
create or replace function public.reverse_transaction_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.products
  set stock_quantity = stock_quantity + old.quantity
  where id = old.product_id;

  insert into public.inventory_movements (product_id, quantity_change, reason, reference_transaction_id, notes)
  values (old.product_id, old.quantity, 'ajuste', old.transaction_id, 'Reversión por eliminación de ítem');

  return old;
end;
$$;

drop trigger if exists on_transaction_item_delete on public.transaction_items;
create trigger on_transaction_item_delete
  after delete on public.transaction_items
  for each row execute function public.reverse_transaction_item();

-- ----------------------------------------------------------------------------
-- 9. DAILY CLOSURES (cuadre diario)
-- ----------------------------------------------------------------------------
create table if not exists public.daily_closures (
  id                       uuid primary key default gen_random_uuid(),
  closure_date             date not null unique default current_date,
  opened_by                uuid references public.profiles (id),
  closed_by                uuid references public.profiles (id),
  total_ingresos           numeric not null default 0,
  total_egresos            numeric not null default 0,
  totals_by_payment_method jsonb not null default '{}'::jsonb,
  status                   text not null default 'abierto' check (status in ('abierto', 'cerrado')),
  notes                    text,
  opened_at                timestamptz not null default now(),
  closed_at                timestamptz
);

-- ----------------------------------------------------------------------------
-- 10. GOOGLE CALENDAR CONNECTION (single studio-wide connection)
-- ----------------------------------------------------------------------------
create table if not exists public.google_calendar_connection (
  id             int primary key default 1 check (id = 1), -- singleton row
  calendar_id    text not null default 'primary',
  access_token   text,
  refresh_token  text,
  token_expiry   timestamptz,
  scope          text,
  connected_by   uuid references public.profiles (id),
  updated_at     timestamptz not null default now()
);

drop trigger if exists calendar_set_updated_at on public.google_calendar_connection;
create trigger calendar_set_updated_at
  before update on public.google_calendar_connection
  for each row execute function public.set_updated_at();

-- A safe view: exposes only whether a calendar is connected, never the tokens.
create or replace view public.google_calendar_status as
  select id, calendar_id, (refresh_token is not null) as connected, updated_at
  from public.google_calendar_connection;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.payment_methods enable row level security;
alter table public.products enable row level security;
alter table public.clients enable row level security;
alter table public.services enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_items enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.daily_closures enable row level security;
alter table public.google_calendar_connection enable row level security;

-- profiles: everyone can read their own row + admins read/write all
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin" on public.profiles
  for update using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_admin_insert" on public.profiles;
create policy "profiles_admin_insert" on public.profiles
  for insert with check (public.is_admin() or auth.uid() = id);

drop policy if exists "profiles_admin_delete" on public.profiles;
create policy "profiles_admin_delete" on public.profiles
  for delete using (public.is_admin());

-- payment_methods: any authenticated user reads; only admin writes
drop policy if exists "payment_methods_select" on public.payment_methods;
create policy "payment_methods_select" on public.payment_methods
  for select using (auth.role() = 'authenticated');

drop policy if exists "payment_methods_admin_write" on public.payment_methods;
create policy "payment_methods_admin_write" on public.payment_methods
  for all using (public.is_admin()) with check (public.is_admin());

-- products: authenticated read/write (both roles manage inventory); admin-only delete
drop policy if exists "products_select" on public.products;
create policy "products_select" on public.products
  for select using (auth.role() = 'authenticated');

drop policy if exists "products_insert" on public.products;
create policy "products_insert" on public.products
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "products_update" on public.products;
create policy "products_update" on public.products
  for update using (auth.role() = 'authenticated');

drop policy if exists "products_admin_delete" on public.products;
create policy "products_admin_delete" on public.products
  for delete using (public.is_admin());

-- clients: authenticated read/write
drop policy if exists "clients_all_authenticated" on public.clients;
create policy "clients_all_authenticated" on public.clients
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- services: authenticated read; admin write
drop policy if exists "services_select" on public.services;
create policy "services_select" on public.services
  for select using (auth.role() = 'authenticated');

drop policy if exists "services_admin_write" on public.services;
create policy "services_admin_write" on public.services
  for all using (public.is_admin()) with check (public.is_admin());

-- transactions: authenticated read + insert; only admin can update/delete (integridad del cuadre)
drop policy if exists "transactions_select" on public.transactions;
create policy "transactions_select" on public.transactions
  for select using (auth.role() = 'authenticated');

drop policy if exists "transactions_insert" on public.transactions;
create policy "transactions_insert" on public.transactions
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "transactions_admin_update" on public.transactions;
create policy "transactions_admin_update" on public.transactions
  for update using (public.is_admin());

drop policy if exists "transactions_admin_delete" on public.transactions;
create policy "transactions_admin_delete" on public.transactions
  for delete using (public.is_admin());

-- transaction_items: authenticated read + insert; admin-only delete (reversa stock)
drop policy if exists "transaction_items_select" on public.transaction_items;
create policy "transaction_items_select" on public.transaction_items
  for select using (auth.role() = 'authenticated');

drop policy if exists "transaction_items_insert" on public.transaction_items;
create policy "transaction_items_insert" on public.transaction_items
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "transaction_items_admin_delete" on public.transaction_items;
create policy "transaction_items_admin_delete" on public.transaction_items
  for delete using (public.is_admin());

-- inventory_movements: authenticated read only (writes happen via trigger, security definer)
drop policy if exists "inventory_movements_select" on public.inventory_movements;
create policy "inventory_movements_select" on public.inventory_movements
  for select using (auth.role() = 'authenticated');

drop policy if exists "inventory_movements_insert_admin" on public.inventory_movements;
create policy "inventory_movements_insert_admin" on public.inventory_movements
  for insert with check (public.is_admin());

-- daily_closures: authenticated read/insert/update; only admin deletes
drop policy if exists "daily_closures_select" on public.daily_closures;
create policy "daily_closures_select" on public.daily_closures
  for select using (auth.role() = 'authenticated');

drop policy if exists "daily_closures_insert" on public.daily_closures;
create policy "daily_closures_insert" on public.daily_closures
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "daily_closures_update" on public.daily_closures;
create policy "daily_closures_update" on public.daily_closures
  for update using (auth.role() = 'authenticated');

drop policy if exists "daily_closures_admin_delete" on public.daily_closures;
create policy "daily_closures_admin_delete" on public.daily_closures
  for delete using (public.is_admin());

-- google_calendar_connection: locked down; the app talks to it via the service-role key only
drop policy if exists "google_calendar_admin_only" on public.google_calendar_connection;
create policy "google_calendar_admin_only" on public.google_calendar_connection
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- Done. Next steps (see README.md):
--   1. Create your Supabase project, run this file in the SQL editor.
--   2. Sign up the first user from /login, then promote it manually:
--        update public.profiles set role = 'admin' where id = '<uuid-del-usuario>';
-- ============================================================================
