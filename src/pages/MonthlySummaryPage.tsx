import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { MonthlySummary } from '../types/database';
import { SectionHeader } from '../components/SectionHeader';
import { formatCurrency } from '../lib/format';
import { ErrorMessage } from '../components/ErrorMessage';

export function MonthlySummaryPage() {
  const [rows, setRows] = useState<MonthlySummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data, error: fetchError } = await supabase
        .from('v_monthly_summary')
        .select('*')
        .order('month', { ascending: false });

      if (fetchError) {
        setError(fetchError.message);
        return;
      }
      setRows((data ?? []) as MonthlySummary[]);
    };
    void load();
  }, []);

  return (
    <section>
      <SectionHeader title="Resumen mensual" subtitle="Comparativo real (sin transferencias internas)" />
      {error && <ErrorMessage message={error} />}
      <table>
        <thead>
          <tr>
            <th>Mes</th>
            <th>Ingresos</th>
            <th>Egresos</th>
            <th>Neto</th>
            <th>Mes anterior</th>
            <th>Variación</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.month}>
              <td>{row.month}</td>
              <td>{formatCurrency(row.income_total)}</td>
              <td>{formatCurrency(row.expense_total)}</td>
              <td>{formatCurrency(row.net_total)}</td>
              <td>{formatCurrency(row.previous_net_total ?? 0)}</td>
              <td>{formatCurrency(row.variation_vs_previous ?? 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
