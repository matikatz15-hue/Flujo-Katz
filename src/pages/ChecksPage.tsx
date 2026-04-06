import { FormEvent, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Branch, Category, Check, CheckStatus, CheckType } from '../types/database';
import { SectionHeader } from '../components/SectionHeader';
import { ErrorMessage } from '../components/ErrorMessage';
import { formatCurrency } from '../lib/format';

interface Option {
  id: string;
  name: string;
}

const initialForm = {
  check_type: 'issued' as CheckType,
  third_party: '',
  amount: 0,
  issue_date: new Date().toISOString().slice(0, 10),
  due_date: new Date().toISOString().slice(0, 10),
  description: '',
  notes: '',
  // Fund fields
  branch_id: '',
  account_id: '',
  payment_method_id: '',
  // Category fields
  rubro_id: '',
  category_id: ''
};

const STATUS_LABELS: Record<CheckStatus, string> = {
  pending: 'Pendiente',
  deposited: 'Depositado',
  cleared: 'Acreditado',
  bounced: 'Rechazado',
  cancelled: 'Cancelado',
  paid: 'Pagado'
};

export function ChecksPage() {
  const [rows, setRows] = useState<Check[]>([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Master data
  const [branches, setBranches] = useState<Branch[]>([]);
  const [accounts, setAccounts] = useState<Option[]>([]);
  const [methods, setMethods] = useState<Option[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Rubros = root categories
  const rubros = useMemo(() => categories.filter((c) => c.parent_id === null), [categories]);
  // Conceptos = children of selected rubro
  const conceptos = useMemo(
    () => categories.filter((c) => c.parent_id === form.rubro_id),
    [categories, form.rubro_id]
  );

  // Category/account name lookups
  const catName = useMemo(() => {
    const map: Record<string, string> = {};
    categories.forEach((c) => { map[c.id] = c.name; });
    return map;
  }, [categories]);

  const accountName = useMemo(() => {
    const map: Record<string, string> = {};
    accounts.forEach((a) => { map[a.id] = a.name; });
    return map;
  }, [accounts]);

  const load = async () => {
    const [
      { data: checkData, error: checkError },
      { data: branchData },
      { data: accountData },
      { data: methodData },
      { data: categoryData }
    ] = await Promise.all([
      supabase.from('checks').select('*').order('due_date', { ascending: true }),
      supabase.from('branches').select('id,name').order('name'),
      supabase.from('accounts').select('id,name').order('name'),
      supabase.from('payment_methods').select('id,name').order('name'),
      supabase.from('categories').select('*').order('name')
    ]);

    if (checkError) {
      setError(checkError.message);
      return;
    }
    setRows((checkData ?? []) as Check[]);
    setBranches((branchData ?? []) as Branch[]);
    setAccounts((accountData ?? []) as Option[]);
    setMethods((methodData ?? []) as Option[]);
    setCategories((categoryData ?? []) as Category[]);
  };

  useEffect(() => {
    void load();
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const payload = {
      check_type: form.check_type,
      third_party: form.third_party,
      amount: Number(form.amount),
      issue_date: form.issue_date,
      due_date: form.due_date,
      description: form.description,
      notes: form.notes || null,
      branch_id: form.branch_id || null,
      account_id: form.account_id || null,
      payment_method_id: form.payment_method_id || null,
      category_id: form.category_id || null,
      status: 'pending' as CheckStatus
    };

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

  const handleCancel = async (id: string) => {
    const { error: updateError } = await supabase
      .from('checks')
      .update({ status: 'cancelled' })
      .eq('id', id);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    await load();
  };

  const handlePaid = async (check: Check) => {
    // Mark check as paid
    const { error: updateError } = await supabase
      .from('checks')
      .update({ status: 'paid' })
      .eq('id', check.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    // Generate transaction in movimientos if we have enough data
    if (check.branch_id && check.account_id && check.payment_method_id && check.category_id) {
      const movementType = check.check_type === 'issued' ? 'expense' : 'income';
      const { error: txError } = await supabase.from('transactions').insert({
        movement_date: new Date().toISOString().slice(0, 10),
        movement_type: movementType,
        branch_id: check.branch_id,
        account_id: check.account_id,
        payment_method_id: check.payment_method_id,
        category_id: check.category_id,
        description: check.description || `Cheque ${check.check_type === 'issued' ? 'emitido' : 'recibido'}: ${check.third_party}`,
        amount: check.amount,
        notes: check.notes,
        status: 'confirmed'
      });

      if (txError) {
        setError(`Cheque marcado como pagado pero falló la transacción: ${txError.message}`);
      }
    }

    await load();
  };

  const startEdit = (row: Check) => {
    // Find rubro for category
    const cat = categories.find((c) => c.id === row.category_id);
    setEditingId(row.id);
    setForm({
      check_type: row.check_type,
      third_party: row.third_party,
      amount: row.amount,
      issue_date: row.issue_date,
      due_date: row.due_date,
      description: row.description ?? '',
      notes: row.notes ?? '',
      branch_id: row.branch_id ?? '',
      account_id: row.account_id ?? '',
      payment_method_id: row.payment_method_id ?? '',
      rubro_id: cat?.parent_id ?? '',
      category_id: row.category_id ?? ''
    });
  };

  const activeRows = rows.filter((r) => r.status !== 'cancelled' && r.status !== 'paid');
  const closedRows = rows.filter((r) => r.status === 'cancelled' || r.status === 'paid');

  return (
    <section>
      <SectionHeader title="Cheques y compromisos" subtitle="Agenda futura separada de caja real" />
      {error && <ErrorMessage message={error} />}

      <form className="form-grid" onSubmit={handleSubmit} style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
        <select
          value={form.check_type}
          onChange={(e) => setForm({ ...form, check_type: e.target.value as CheckType })}
        >
          <option value="issued">Emitido</option>
          <option value="received">Recibido</option>
        </select>

        <input
          placeholder="Proveedor / Tercero"
          value={form.third_party}
          onChange={(e) => setForm({ ...form, third_party: e.target.value })}
          required
        />

        <input
          type="number"
          step="0.01"
          placeholder="Importe"
          value={form.amount || ''}
          onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
          required
          min="0.01"
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>Fecha emisión</label>
          <input
            type="date"
            value={form.issue_date}
            onChange={(e) => setForm({ ...form, issue_date: e.target.value })}
            required
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>Fecha vencimiento</label>
          <input
            type="date"
            value={form.due_date}
            onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            required
          />
        </div>

        {/* Rubro / Concepto */}
        <select
          value={form.rubro_id}
          onChange={(e) => setForm({ ...form, rubro_id: e.target.value, category_id: '' })}
        >
          <option value="">Rubro...</option>
          {rubros.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>

        <select
          value={form.category_id}
          onChange={(e) => setForm({ ...form, category_id: e.target.value })}
          disabled={!form.rubro_id}
        >
          <option value="">Concepto...</option>
          {conceptos.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <input
          placeholder="Descripción"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />

        <input
          placeholder="Observaciones"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />

        {/* Fondo section */}
        <select
          value={form.branch_id}
          onChange={(e) => setForm({ ...form, branch_id: e.target.value })}
        >
          <option value="">Sucursal (Fondo)</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>

        <select
          value={form.account_id}
          onChange={(e) => setForm({ ...form, account_id: e.target.value })}
        >
          <option value="">Cuenta (Fondo)</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>

        <select
          value={form.payment_method_id}
          onChange={(e) => setForm({ ...form, payment_method_id: e.target.value })}
        >
          <option value="">Medio de pago</option>
          {methods.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>

        <button type="submit">{editingId ? 'Actualizar' : 'Guardar'}</button>
      </form>

      {/* Active checks */}
      <h4 style={{ margin: '0 0 8px', color: '#6b7280', fontWeight: 500 }}>Cheques activos</h4>
      {activeRows.length === 0 ? (
        <p style={{ color: '#9ca3af' }}>Sin cheques activos</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Proveedor/Tercero</th>
              <th>Concepto</th>
              <th>Cuenta</th>
              <th>Vencimiento</th>
              <th>Estado</th>
              <th>Importe</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {activeRows.map((row) => (
              <tr key={row.id}>
                <td>{row.check_type === 'issued' ? 'Emitido' : 'Recibido'}</td>
                <td>{row.third_party}</td>
                <td>{row.category_id ? catName[row.category_id] : '-'}</td>
                <td>{row.account_id ? accountName[row.account_id] : '-'}</td>
                <td>{row.due_date}</td>
                <td>{STATUS_LABELS[row.status]}</td>
                <td>{formatCurrency(row.amount)}</td>
                <td style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    style={{ background: '#1e40af', fontSize: '0.8rem', padding: '4px 8px' }}
                    onClick={() => startEdit(row)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    style={{ background: '#15803d', fontSize: '0.8rem', padding: '4px 8px' }}
                    onClick={() => handlePaid(row)}
                  >
                    Pagado
                  </button>
                  <button
                    type="button"
                    style={{ background: '#991b1b', fontSize: '0.8rem', padding: '4px 8px' }}
                    onClick={() => handleCancel(row.id)}
                  >
                    Cancelar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Closed checks (cancelled/paid) */}
      {closedRows.length > 0 && (
        <>
          <h4 style={{ margin: '24px 0 8px', color: '#6b7280', fontWeight: 500 }}>Historial</h4>
          <table>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Proveedor/Tercero</th>
                <th>Concepto</th>
                <th>Vencimiento</th>
                <th>Estado</th>
                <th>Importe</th>
              </tr>
            </thead>
            <tbody>
              {closedRows.map((row) => (
                <tr
                  key={row.id}
                  style={{
                    textDecoration: row.status === 'cancelled' ? 'line-through' : 'none',
                    color: '#9ca3af'
                  }}
                >
                  <td>{row.check_type === 'issued' ? 'Emitido' : 'Recibido'}</td>
                  <td>{row.third_party}</td>
                  <td>{row.category_id ? catName[row.category_id] : '-'}</td>
                  <td>{row.due_date}</td>
                  <td>{STATUS_LABELS[row.status]}</td>
                  <td>{formatCurrency(row.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
