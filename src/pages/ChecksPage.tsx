import { FormEvent, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Check, CheckStatus, CheckType } from '../types/database';
import { SectionHeader } from '../components/SectionHeader';
import { ErrorMessage } from '../components/ErrorMessage';

const initialForm = {
  check_type: 'issued' as CheckType,
  third_party: '',
  amount: 0,
  issue_date: new Date().toISOString().slice(0, 10),
  due_date: new Date().toISOString().slice(0, 10),
  status: 'pending' as CheckStatus,
  notes: ''
};

export function ChecksPage() {
  const [rows, setRows] = useState<Check[]>([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const { data, error: fetchError } = await supabase.from('checks').select('*').order('due_date', { ascending: true });
    if (fetchError) {
      setError(fetchError.message);
      return;
    }
    setRows((data ?? []) as Check[]);
  };

  useEffect(() => {
    void load();
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const payload = { ...form, amount: Number(form.amount), notes: form.notes || null };

    const result = editingId
      ? await supabase.from('checks').update(payload).eq('id', editingId)
      : await supabase.from('checks').insert(payload);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setEditingId(null);
    setForm(initialForm);
    await load();
  };

  return (
    <section>
      <SectionHeader title="Módulo 3 · Cheques" subtitle="Agenda futura separada de caja real" />
      {error && <ErrorMessage message={error} />}
      <form className="form-grid" onSubmit={handleSubmit}>
        <select value={form.check_type} onChange={(e) => setForm({ ...form, check_type: e.target.value as CheckType })}>
          <option value="issued">Emitido</option>
          <option value="received">Recibido</option>
        </select>
        <input placeholder="Tercero" value={form.third_party} onChange={(e) => setForm({ ...form, third_party: e.target.value })} required />
        <input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} required />
        <input type="date" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} required />
        <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} required />
        <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as CheckStatus })}>
          <option value="pending">Pendiente</option>
          <option value="deposited">Depositado</option>
          <option value="cleared">Acreditado</option>
          <option value="bounced">Rechazado</option>
          <option value="cancelled">Cancelado</option>
        </select>
        <input placeholder="Observaciones" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        <button type="submit">{editingId ? 'Actualizar' : 'Guardar'}</button>
      </form>

      <table>
        <thead>
          <tr>
            <th>Tipo</th>
            <th>Tercero</th>
            <th>Vencimiento</th>
            <th>Estado</th>
            <th>Importe</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.check_type}</td>
              <td>{row.third_party}</td>
              <td>{row.due_date}</td>
              <td>{row.status}</td>
              <td>{row.amount.toFixed(2)}</td>
              <td>
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(row.id);
                    setForm({
                      check_type: row.check_type,
                      third_party: row.third_party,
                      amount: row.amount,
                      issue_date: row.issue_date,
                      due_date: row.due_date,
                      status: row.status,
                      notes: row.notes ?? ''
                    });
                  }}
                >
                  Editar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
