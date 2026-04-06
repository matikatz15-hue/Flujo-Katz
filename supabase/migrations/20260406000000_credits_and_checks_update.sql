-- Add 'paid' status to check_status enum
alter type check_status add value if not exists 'paid';

-- Add fund/category columns to checks for full integration
alter table checks add column if not exists branch_id uuid references branches(id);
alter table checks add column if not exists account_id uuid references accounts(id);
alter table checks add column if not exists payment_method_id uuid references payment_methods(id);
alter table checks add column if not exists category_id uuid references categories(id);
alter table checks add column if not exists description text not null default '';

-- Create credit_type enum
do $$ begin
  create type credit_type as enum ('unpaid_payment', 'taken_credit');
exception when duplicate_object then null; end $$;

-- Create credits table
create table if not exists credits (
  id uuid primary key default gen_random_uuid(),
  credit_type credit_type not null,
  category_id uuid not null references categories(id),
  description text not null default '',
  notes text,
  amount numeric(14,2) not null check (amount > 0),
  installments integer not null default 1 check (installments >= 1),
  first_payment_date date not null,
  paid_amount numeric(14,2) not null default 0 check (paid_amount >= 0),
  paid_installments integer not null default 0 check (paid_installments >= 0),
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_credits_updated_at
before update on credits
for each row execute procedure set_updated_at();

-- Add 'Créditos' root category (used as Rubro for credits)
insert into categories (parent_id, name) values (null, 'Créditos') on conflict do nothing;
-- Sub-categories for credits
insert into categories (parent_id, name)
select c.id, x.name
from categories c
cross join (values ('Préstamo bancario'), ('Crédito proveedor'), ('Cuota maquinaria'), ('Tarjeta de crédito'), ('Otro')) as x(name)
where c.name = 'Créditos' and c.parent_id is null
on conflict do nothing;

-- Add 'Proveedores' root category for checks
insert into categories (parent_id, name) values (null, 'Proveedores') on conflict do nothing;
