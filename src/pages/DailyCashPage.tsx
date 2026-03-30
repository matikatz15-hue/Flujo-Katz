import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { DailyCashSummary } from '../types/database';
import { SectionHeader } from '../components/SectionHeader';
import { formatCurrency } from '../lib/format';
import { ErrorMessage } from '../components/ErrorMessage';

export function DailyCashPage() {
  const [rows, setRows] = useState<DailyCashSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const today = new Date();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
      const { data, error: fetchError } = await supabase
        .from('v_daily_cash')
        .select('*')
        .gte('day', monthStart)
        .order('day', { ascending: true });

      if (fetchError) {
        setError(fetchError.message);
        return;
      }
      setRows((data ?? []) as DailyCashSummary[]);
    };
    void load();
  }, []);

  return (
    <section>
      <SectionHeader title="Caja diaria" subtitle="Flujo diario y acumulado del mes" />
      {error && <ErrorMessage message={error} />}
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Ingresos</th>
            <th>Egresos</th>
            <th>Neto</th>
            <th>Acumulado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.day}>
              <td>{row.day}</td>
              <td>{formatCurrency(row.income_total)}</td>
              <td>{formatCurrency(row.expense_total)}</td>
              <td>{formatCurrency(row.net_total)}</td>
              <td>{formatCurrency(row.month_running_net)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
