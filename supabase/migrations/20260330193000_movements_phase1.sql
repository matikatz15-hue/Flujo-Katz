create table if not exists concepts (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (category_id, name)
);

alter table transactions
  add column if not exists concept_id uuid references concepts(id),
  add column if not exists amount_with_vat numeric(14,2),
  add column if not exists vat_amount numeric(14,2) generated always as (
    case
      when amount_with_vat is null then null
      else amount_with_vat - amount
    end
  ) stored;

create table if not exists monthly_financial_targets (
  id uuid primary key default gen_random_uuid(),
  month date not null unique,
  billing_total_with_vat numeric(14,2) not null default 0,
  billing_services_with_vat numeric(14,2) not null default 0,
  billing_products_with_vat numeric(14,2) not null default 0,
  usd_rate numeric(14,6),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (date_trunc('month', month)::date = month)
);

create trigger trg_monthly_financial_targets_updated_at
before update on monthly_financial_targets
for each row execute procedure set_updated_at();

create index if not exists idx_concepts_category on concepts(category_id);
create index if not exists idx_transactions_concept on transactions(concept_id);
create index if not exists idx_monthly_financial_targets_month on monthly_financial_targets(month);

create or replace view v_movements_monthly_expense_by_concept as
select
  date_trunc('month', t.movement_date)::date as month,
  c.name as rubro,
  coalesce(cp.name, t.description) as concept,
  sum(t.amount) as expense_total
from transactions t
join categories c on c.id = t.category_id
left join concepts cp on cp.id = t.concept_id
where t.movement_type = 'expense'
  and t.status = 'confirmed'
group by date_trunc('month', t.movement_date)::date, c.name, coalesce(cp.name, t.description);

create or replace view v_movements_monthly_income_by_fund as
select
  date_trunc('month', t.movement_date)::date as month,
  a.name as fund,
  sum(t.amount) as income_total
from transactions t
join accounts a on a.id = t.account_id
where t.movement_type = 'income'
  and t.status = 'confirmed'
group by date_trunc('month', t.movement_date)::date, a.name;

create or replace view v_movements_monthly_totals as
with month_totals as (
  select
    date_trunc('month', t.movement_date)::date as month,
    sum(case when t.movement_type = 'income' and t.status = 'confirmed' then t.amount else 0 end) as income_total,
    sum(case when t.movement_type = 'expense' and t.status = 'confirmed' then t.amount else 0 end) as expense_total
  from transactions t
  where t.movement_type in ('income', 'expense')
  group by date_trunc('month', t.movement_date)::date
)
select
  mt.month,
  mt.income_total,
  mt.expense_total,
  mt.income_total - mt.expense_total as diff_income_expense,
  mft.billing_total_with_vat,
  mft.billing_services_with_vat,
  mft.billing_products_with_vat,
  lag(mft.billing_total_with_vat) over (order by mt.month) as previous_billing_total_with_vat,
  case
    when lag(mft.billing_total_with_vat) over (order by mt.month) is null
      or lag(mft.billing_total_with_vat) over (order by mt.month) = 0 then null
    else ((mft.billing_total_with_vat - lag(mft.billing_total_with_vat) over (order by mt.month))
      / lag(mft.billing_total_with_vat) over (order by mt.month)) * 100
  end as billing_growth_pct,
  mft.billing_total_with_vat - mt.expense_total as diff_billing_expense,
  case
    when mft.usd_rate is null or mft.usd_rate = 0 then null
    else (mt.income_total - mt.expense_total) / mft.usd_rate
  end as diff_income_expense_usd
from month_totals mt
left join monthly_financial_targets mft on mft.month = mt.month;
