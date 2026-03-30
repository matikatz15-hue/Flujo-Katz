create extension if not exists "pgcrypto";

create type movement_type as enum ('income','expense','internal_transfer');
create type transaction_status as enum ('draft','confirmed','cancelled');
create type check_type as enum ('issued','received');
create type check_status as enum ('pending','deposited','cleared','bounced','cancelled');

create table branches (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table accounts (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references branches(id),
  name text not null,
  currency_code text not null default 'ARS',
  created_at timestamptz not null default now(),
  unique (branch_id, name)
);

create table payment_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references categories(id),
  name text not null,
  created_at timestamptz not null default now(),
  unique (parent_id, name)
);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  movement_date date not null,
  movement_type movement_type not null,
  branch_id uuid not null references branches(id),
  account_id uuid not null references accounts(id),
  payment_method_id uuid not null references payment_methods(id),
  category_id uuid not null references categories(id),
  description text not null,
  amount numeric(14,2) not null check (amount > 0),
  notes text,
  status transaction_status not null default 'confirmed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table checks (
  id uuid primary key default gen_random_uuid(),
  check_type check_type not null,
  third_party text not null,
  amount numeric(14,2) not null check (amount > 0),
  issue_date date not null,
  due_date date not null,
  status check_status not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (due_date >= issue_date)
);

create index idx_transactions_date on transactions(movement_date);
create index idx_transactions_filters on transactions(branch_id, account_id, payment_method_id, category_id);
create index idx_transactions_type_status on transactions(movement_type, status);
create index idx_checks_due_status on checks(due_date, status);

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_transactions_updated_at
before update on transactions
for each row execute procedure set_updated_at();

create trigger trg_checks_updated_at
before update on checks
for each row execute procedure set_updated_at();

create or replace view v_daily_cash as
with base as (
  select
    movement_date as day,
    sum(case when movement_type = 'income' and status = 'confirmed' then amount else 0 end) as income_total,
    sum(case when movement_type = 'expense' and status = 'confirmed' then amount else 0 end) as expense_total
  from transactions
  where movement_type in ('income','expense')
  group by movement_date
)
select
  day,
  income_total,
  expense_total,
  income_total - expense_total as net_total,
  sum(income_total - expense_total) over (
    partition by date_trunc('month', day)
    order by day
  ) as month_running_net
from base;

create or replace view v_monthly_summary as
with base as (
  select
    date_trunc('month', movement_date)::date as month,
    sum(case when movement_type = 'income' and status = 'confirmed' then amount else 0 end) as income_total,
    sum(case when movement_type = 'expense' and status = 'confirmed' then amount else 0 end) as expense_total
  from transactions
  where movement_type in ('income','expense')
  group by date_trunc('month', movement_date)
),
full_view as (
  select
    month,
    income_total,
    expense_total,
    income_total - expense_total as net_total
  from base
)
select
  month,
  income_total,
  expense_total,
  net_total,
  lag(net_total) over (order by month) as previous_net_total,
  net_total - lag(net_total) over (order by month) as variation_vs_previous
from full_view;

create or replace view v_monthly_by_category as
select
  date_trunc('month', t.movement_date)::date as month,
  c.name as category,
  sum(case when t.movement_type = 'income' and t.status = 'confirmed' then t.amount else 0 end) as income_total,
  sum(case when t.movement_type = 'expense' and t.status = 'confirmed' then t.amount else 0 end) as expense_total
from transactions t
join categories c on c.id = t.category_id
where t.movement_type in ('income','expense')
group by date_trunc('month', t.movement_date), c.name;

create or replace view v_monthly_by_branch as
select
  date_trunc('month', t.movement_date)::date as month,
  b.name as branch,
  sum(case when t.movement_type = 'income' and t.status = 'confirmed' then t.amount else 0 end) as income_total,
  sum(case when t.movement_type = 'expense' and t.status = 'confirmed' then t.amount else 0 end) as expense_total
from transactions t
join branches b on b.id = t.branch_id
where t.movement_type in ('income','expense')
group by date_trunc('month', t.movement_date), b.name;

create or replace view v_monthly_by_account as
select
  date_trunc('month', t.movement_date)::date as month,
  a.name as account,
  sum(case when t.movement_type = 'income' and t.status = 'confirmed' then t.amount else 0 end) as income_total,
  sum(case when t.movement_type = 'expense' and t.status = 'confirmed' then t.amount else 0 end) as expense_total
from transactions t
join accounts a on a.id = t.account_id
where t.movement_type in ('income','expense')
group by date_trunc('month', t.movement_date), a.name;

create or replace view v_monthly_by_payment_method as
select
  date_trunc('month', t.movement_date)::date as month,
  pm.name as payment_method,
  sum(case when t.movement_type = 'income' and t.status = 'confirmed' then t.amount else 0 end) as income_total,
  sum(case when t.movement_type = 'expense' and t.status = 'confirmed' then t.amount else 0 end) as expense_total
from transactions t
join payment_methods pm on pm.id = t.payment_method_id
where t.movement_type in ('income','expense')
group by date_trunc('month', t.movement_date), pm.name;
