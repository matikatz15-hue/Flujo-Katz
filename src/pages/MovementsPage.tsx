import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { SectionHeader } from '../components/SectionHeader';
import { ErrorMessage } from '../components/ErrorMessage';
import { formatCurrency } from '../lib/format';
import { KpiCard } from '../components/KpiCard';

interface ExpenseConceptRow {
  month: string;
  rubro: string;
  concept: string;
  expense_total: number;
}

interface IncomeFundRow {
  month: string;
  fund: string;
  income_total: number;
}

interface MonthlyTotals {
  month: string;
  income_total: number;
  expense_total: number;
  diff_income_expense: number;
  billing_total_with_vat: number | null;
  billing_growth_pct: number | null;
  diff_billing_expense: number | null;
  diff_income_expense_usd: number | null;
}

export function MovementsPage() {
  const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7));
  const [expenseRows, setExpenseRows] = useState<ExpenseConceptRow[]>([]);
  const [incomeRows, setIncomeRows] = useState<IncomeFundRow[]>([]);
  const [totals, setTotals] = useState<MonthlyTotals | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const monthDate = `${monthFilter}-01`;
      const [{ data: expenseData, error: expenseError }, { data: incomeData, error: incomeError }, { data: totalData, error: totalError }] =
        await Promise.all([
          supabase.from('v_movements_monthly_expense_by_concept').select('*').eq('month', monthDate).order('rubro').order('concept'),
          supabase.from('v_movements_monthly_income_by_fund').select('*').eq('month', monthDate).order('fund'),
          supabase.from('v_movements_monthly_totals').select('*').eq('month', monthDate).maybeSingle()
        ]);

      if (expenseError || incomeError || totalError) {
        setError(expenseError?.message ?? incomeError?.message ?? totalError?.message ?? 'Error cargando movimientos');
        return;
      }

      setExpenseRows((expenseData ?? []) as ExpenseConceptRow[]);
      setIncomeRows((incomeData ?? []) as IncomeFundRow[]);
      setTotals((totalData as MonthlyTotals | null) ?? null);
    };

    void load();
  }, [monthFilter]);

  const expenseByRubro = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of expenseRows) map.set(row.rubro, (map.get(row.rubro) ?? 0) + row.expense_total);
    return Array.from(map.entries()).map(([rubro, total]) => ({ rubro, total }));
  }, [expenseRows]);

  return (
    <section>
      <SectionHeader
        title="Módulo 1 · Movimientos"
        subtitle="Egresos mensuales por rubro/concepto + ingresos por fondo + métricas rápidas"
      />
      {error && <ErrorMessage message={error} />}

      <div className="toolbar">
        <label>
          Mes
          <input type="month" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} />
        </label>
      </div>

      <div className="kpi-grid">
        <KpiCard title="Egresos del mes" value={totals?.expense_total ?? 0} />
        <KpiCard title="Ingresos del mes" value={totals?.income_total ?? 0} />
        <KpiCard title="Dif. Ingreso - Egreso" value={totals?.diff_income_expense ?? 0} />
        <KpiCard title="Dif. Facturado - Egreso" value={totals?.diff_billing_expense ?? 0} />
      </div>

      <div className="two-column">
        <div>
          <h3>Egresos por concepto</h3>
          <table>
            <thead>
              <tr>
                <th>Rubro</th>
                <th>Concepto</th>
                <th>Total mes</th>
              </tr>
            </thead>
            <tbody>
              {expenseRows.map((row) => (
                <tr key={`${row.rubro}-${row.concept}`}>
                  <td>{row.rubro}</td>
                  <td>{row.concept}</td>
                  <td>{formatCurrency(row.expense_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <h3>Ingresos por fondo</h3>
          <table>
            <thead>
              <tr>
                <th>Fondo</th>
                <th>Total mes</th>
              </tr>
            </thead>
            <tbody>
              {incomeRows.map((row) => (
                <tr key={row.fund}>
                  <td>{row.fund}</td>
                  <td>{formatCurrency(row.income_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3>Totales por rubro (dinámico)</h3>
          <div className="tag-grid">
            {expenseByRubro.map((item) => (
              <article className="card" key={item.rubro}>
                <p>{item.rubro}</p>
                <strong>{formatCurrency(item.total)}</strong>
              </article>
            ))}
          </div>
        </div>
      </div>

      <h3>Indicadores extendidos</h3>
      <table>
        <tbody>
          <tr>
            <td>Facturación con IVA</td>
            <td>{formatCurrency(totals?.billing_total_with_vat ?? 0)}</td>
          </tr>
          <tr>
            <td>Crecimiento facturación vs mes anterior</td>
            <td>{totals?.billing_growth_pct == null ? '-' : `${totals.billing_growth_pct.toFixed(2)}%`}</td>
          </tr>
          <tr>
            <td>Diferencia Ingreso - Egreso en USD</td>
            <td>{totals?.diff_income_expense_usd == null ? '-' : totals.diff_income_expense_usd.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
