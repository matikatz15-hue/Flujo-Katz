insert into branches (name) values ('Casa Central'), ('Sucursal Norte')
on conflict do nothing;

insert into payment_methods (name) values ('Efectivo'), ('Transferencia'), ('Tarjeta')
on conflict do nothing;

insert into categories (parent_id, name)
select null, x.name
from (values ('Ventas'), ('Compras'), ('Servicios'), ('Impuestos'), ('Transferencias'), ('Proveedores')) as x(name)
on conflict do nothing;

insert into accounts (branch_id, name)
select b.id, x.name
from branches b
cross join (values ('Caja principal'), ('Banco Galicia')) as x(name)
on conflict do nothing;

with refs as (
  select
    (select id from branches where name = 'Casa Central' limit 1) as branch_id,
    (select id from accounts where name = 'Caja principal' limit 1) as account_id,
    (select id from payment_methods where name = 'Efectivo' limit 1) as pm_cash,
    (select id from payment_methods where name = 'Transferencia' limit 1) as pm_transfer,
    (select id from categories where name = 'Ventas' limit 1) as cat_sales,
    (select id from categories where name = 'Compras' limit 1) as cat_purchases,
    (select id from categories where name = 'Transferencias' limit 1) as cat_transfers
)
insert into transactions (movement_date, movement_type, branch_id, account_id, payment_method_id, category_id, description, amount, notes)
select * from (
  select current_date - 2, 'income'::movement_type, branch_id, account_id, pm_cash, cat_sales, 'Cobro mostrador', 150000::numeric, 'Seed' from refs
  union all
  select current_date - 2, 'expense'::movement_type, branch_id, account_id, pm_transfer, cat_purchases, 'Pago proveedores', 64000::numeric, 'Seed' from refs
  union all
  select current_date - 1, 'internal_transfer'::movement_type, branch_id, account_id, pm_transfer, cat_transfers, 'Pase interno de caja a banco', 30000::numeric, 'No computa en gerencial' from refs
) t;

insert into checks (check_type, third_party, amount, issue_date, due_date, status, notes)
values
('issued', 'Proveedor A', 42000, current_date - 1, current_date + 7, 'pending', 'Cheque diferido'),
('received', 'Cliente B', 68000, current_date - 5, current_date + 5, 'pending', 'Cobro post-fechado');

insert into concepts (category_id, name)
select c.id, x.name
from categories c
join (values
  ('Impuestos', 'I.V.A. BASE'),
  ('Impuestos', 'RETEN. I.V.A. RG.2408'),
  ('Proveedores', 'DIELFE SRL'),
  ('Servicios', 'Comision Paquete')
) as x(category_name, name) on c.name = x.category_name
on conflict do nothing;

insert into monthly_financial_targets (month, billing_total_with_vat, billing_services_with_vat, billing_products_with_vat, usd_rate)
values
(date_trunc('month', current_date)::date, 13124659.61, 5500000.00, 7624659.61, 1418.50)
on conflict (month) do update
set billing_total_with_vat = excluded.billing_total_with_vat,
    billing_services_with_vat = excluded.billing_services_with_vat,
    billing_products_with_vat = excluded.billing_products_with_vat,
    usd_rate = excluded.usd_rate;
