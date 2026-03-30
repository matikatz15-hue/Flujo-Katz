import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { KpiCard } from '../components/KpiCard';
import { SectionHeader } from '../components/SectionHeader';
import { ErrorMessage } from '../components/ErrorMessage';

interface DashboardMetrics {
  income_total: number;
  expense_total: number;
  net_total: number;
  month_running_net: number;
}

interface UpcomingCheck {
  id: string;
  third_party: string;
  due_date: string;
  amount: number;
  check_type: string;
}

export function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [checks, setChecks] = useState<UpcomingCheck[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [{ data: dailyData, error: dailyError }, { data: checkData, error: checkError }] = await Promise.all([
        supabase.from('v_daily_cash').select('*').eq('day', today).maybeSingle(),
        supabase
          .from('checks')
          .select('id,third_party,due_date,amount,check_type')
          .eq('status', 'pending')
          .gte('due_date', today)
          .order('due_date', { ascending: true })
          .limit(8)
      ]);

      if (dailyError || checkError) {
        setError(dailyError?.message ?? checkError?.message ?? 'Error cargando dashboard');
        return;
      }
      setMetrics(
        dailyData ?? {
          income_total: 0,
          expense_total: 0,
          net_total: 0,
          month_running_net: 0
        }
      );
      setChecks(checkData ?? []);
    };
    void load();
  }, []);

  return (
    <section>
      <SectionHeader title="Dashboard" subtitle="Estado diario del flujo y compromisos próximos" />
      {error && <ErrorMessage message={error} />}
      <div className="kpi-grid">
        <KpiCard title="Ingresos del día" value={metrics?.income_total ?? 0} />
        <KpiCard title="Egresos del día" value={metrics?.expense_total ?? 0} />
        <KpiCard title="Neto del día" value={metrics?.net_total ?? 0} />
        <KpiCard title="Acumulado mensual" value={metrics?.month_running_net ?? 0} />
      </div>
      <h3>Próximos compromisos</h3>
      <table>
        <thead>
          <tr>
            <th>Tercero</th>
            <th>Tipo</th>
            <th>Vencimiento</th>
            <th>Importe</th>
          </tr>
        </thead>
        <tbody>
          {checks.map((check) => (
            <tr key={check.id}>
              <td>{check.third_party}</td>
              <td>{check.check_type}</td>
              <td>{check.due_date}</td>
              <td>{check.amount.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
