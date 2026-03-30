# Flujo Katz MVP

Sistema web interno para reemplazar la planilla mensual de flujo de caja con **React + TypeScript + Supabase**.

## 1) Arquitectura elegida

- **Frontend (React + Vite + TS):** UI simple con 5 pantallas (Dashboard, Movimientos, Cheques, Caja diaria, Resumen mensual).
- **Backend de datos (Supabase/PostgreSQL):** tablas normalizadas + vistas SQL para cálculos críticos.
- **Fuente de verdad:** todos los totales gerenciales salen de SQL (`v_daily_cash`, `v_monthly_summary`, vistas de agrupación).
- **Regla clave:** `internal_transfer` queda almacenado para auditoría, pero excluido de ingresos/egresos reales.

## 2) Estructura del proyecto

```text
.
├── src/
│   ├── app/App.tsx
│   ├── components/
│   ├── lib/
│   ├── pages/
│   ├── types/
│   └── styles.css
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   └── seed.sql
├── .env.example
└── README.md
```

## 3) Modelo de datos y reportes

Tablas principales:
- `branches`
- `accounts`
- `payment_methods`
- `categories` (con `parent_id` para subcategorías)
- `transactions`
- `checks`

Vistas de reportes:
- `v_daily_cash`
- `v_monthly_summary`
- `v_monthly_by_category`
- `v_monthly_by_branch`
- `v_monthly_by_account`
- `v_monthly_by_payment_method`

## 4) Instalación

### Frontend

```bash
cp .env.example .env
npm install
npm run dev
```

### Supabase local (opcional)

Requiere Supabase CLI instalado.

```bash
supabase start
supabase db reset
```

`supabase db reset` aplica migraciones y `supabase/seed.sql`.

## 5) Funcionalidades MVP implementadas

- **CRUD Movimientos:** alta, edición, listado y filtro por mes.
- **CRUD Cheques:** alta, edición y listado.
- **Caja diaria:** ingresos/egresos/neto diario + acumulado mensual.
- **Resumen mensual:** ingresos, egresos, neto, variación vs mes anterior.
- **Dashboard:** KPIs diarios + próximos compromisos (`checks` pendientes).

## 6) Validación recomendada

1. Cargar ingreso, egreso y transferencia interna el mismo día.
2. Verificar que la transferencia no impacte `v_daily_cash` ni `v_monthly_summary`.
3. Confirmar que el neto mensual = ingresos - egresos (solo movimientos `confirmed`).
4. Cargar cheque pendiente y verificar que aparezca en Dashboard.

## 7) Decisiones técnicas importantes

- `amount` siempre positivo; el signo lógico lo define `movement_type`.
- Estado en `transactions` (`draft`, `confirmed`, `cancelled`) para trazabilidad.
- Índices por fecha y filtros más usados para performance inicial.
- Triggers `updated_at` para auditabilidad básica.

