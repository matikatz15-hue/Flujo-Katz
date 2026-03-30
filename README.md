# Flujo Katz MVP

MVP de gestión financiera interna con 4 módulos:
1. Movimientos
2. Caja
3. Cheques
4. Proyecciones

## Estado actual

Se rediseñó la base para arrancar por **Movimientos + Caja** con UX más directa al flujo de Excel:
- Caja carga operaciones diarias (ingresos/egresos) y permite crear **fondos**, **rubros** y **conceptos** reusable.
- Movimientos consolida por mes: egresos por rubro/concepto + ingresos por fondo + KPIs.
- Cheques y Proyecciones quedan operativos como módulos separados.

## Run local

```bash
git clone https://github.com/matikatz15-hue/Flujo-Katz.git
cd Flujo-Katz
cp .env.example .env
npm install
npm run dev
```

## Configuración Supabase

1. Crear proyecto en Supabase.
2. Correr migraciones en SQL Editor:
   - `supabase/migrations/20260330183000_init.sql`
   - `supabase/migrations/20260330193000_movements_phase1.sql`
3. Correr seed `supabase/seed.sql`.
4. Completar `.env` con URL y publishable key.

## Modelo agregado para fase Movimientos

- `concepts` (catálogo de conceptos por rubro).
- `monthly_financial_targets` (facturación con IVA, split servicios/productos, USD rate manual).
- Vistas:
  - `v_movements_monthly_expense_by_concept`
  - `v_movements_monthly_income_by_fund`
  - `v_movements_monthly_totals`

Esto permite resolver en SQL: diferencia ingreso-egreso, diferencia facturado-egreso y conversión base a USD.
