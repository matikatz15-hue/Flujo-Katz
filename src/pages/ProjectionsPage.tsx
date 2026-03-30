import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { SectionHeader } from '../components/SectionHeader';
import { ErrorMessage } from '../components/ErrorMessage';
import { formatCurrency } from '../lib/format';

interface TargetRow {
  month: string;
  billing_total_with_vat: number;
  billing_services_with_vat: number;
  billing_products_with_vat: number;
  usd_rate: number | null;
}

export function ProjectionsPage() {
  const [rows, setRows] = useState<TargetRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data, error: fetchError } = await supabase
        .from('monthly_financial_targets')
        .select('*')
        .order('month', { ascending: false });

      if (fetchError) return setError(fetchError.message);
      setRows((data ?? []) as TargetRow[]);
    };

    void load();
  }, []);

  return (
    <section>
      <SectionHeader
        title="Módulo 4 · Proyecciones"
        subtitle="Base para crecimiento, facturación con IVA y conversión a USD (tipo de cambio configurable)"
      />
      {error && <ErrorMessage message={error} />}
      <table>
        <thead>
          <tr>
            <th>Mes</th>
            <th>Facturación c/IVA</th>
            <th>Servicios c/IVA</th>
            <th>Productos c/IVA</th>
            <th>USD Rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.month}>
              <td>{row.month}</td>
              <td>{formatCurrency(row.billing_total_with_vat)}</td>
              <td>{formatCurrency(row.billing_services_with_vat)}</td>
              <td>{formatCurrency(row.billing_products_with_vat)}</td>
              <td>{row.usd_rate ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
