import { FormEvent, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Category, Credit, MovementType, Transaction, TransactionStatus } from '../types/database';
import { SectionHeader } from '../components/SectionHeader';
import { ErrorMessage } from '../components/ErrorMessage';
import { formatCurrency } from '../lib/format';

const CREDIT_TYPE_LABELS: Record<string, string> = {
  unpaid_payment: 'Pago no realizado',
  taken_credit: 'Crédito tomado'
};

interface Option {
  id: string;
  name: string;
}

const initialForm = {
  movement_date: new Date().toISOString().slice(0, 10),
  movement_type: 'expense' as MovementType,
  branch_id: '',
  account_id: '',
  payment_method_id: '',
  category_id: '',
  description: '',
  amount: 0,
  notes: '',
  status: 'confirmed' as TransactionStatus
};

export function TransactionsPage() {
  const [rows, setRows] = useState<Transaction[]>([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7));
  const [branches, setBranches] = useState<Option[]>([]);
  const [accounts, setAccounts] = useState<Option[]>([]);
  const [methods, setMethods] = useState<Option[]>([]);
  const [categories, setCategories] = useState<Option[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [credits, setCredits] = useState<Credit[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);

  const filteredRows = useMemo(() => rows.filter((tx) => tx.movement_date.startsWith(monthFilter)), [rows, monthFilter]);

  const catName = useMemo(() => {
    const map: Record<string, string> = {};
    allCategories.forEach((c) => { map[c.id] = c.name; });
    return map;
  }, [allCategories]);

  const load = async () => {
    const [
      { data: txData, error: txError },
      { data: branchData },
      { data: accountData },
      { data: methodData },
      { data: categoryData },
      { data: creditData }
    ] = await Promise.all([
      supabase.from('transactions').select('*').order('movement_date', { ascending: false }).limit(500),
      supabase.from('branches').select('id,name').order('name'),
      supabase.from('accounts').select('id,name').order('name'),
      supabase.from('payment_methods').select('id,name').order('name'),
      supabase.from('categories').select('*').order('name'),
      supabase.from('credits').select('*').eq('status', 'active').order('first_payment_date')
    ]);

    if (txError) {
      setError(txError.message);
      return;
    }
    setRows((txData ?? []) as Transaction[]);
    setBranches((branchData ?? []) as Option[]);
    setAccounts((accountData ?? []) as Option[]);
    setMethods((methodData ?? []) as Option[]);
    setCategories((categoryData ?? []) as Option[]);
    setAllCategories((categoryData ?? []) as Category[]);
    setCredits((creditData ?? []) as Credit[]);
  };

  useEffect(() => {
    void load();
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const payload = {
      ...form,
      amount: Number(form.amount),
      notes: form.notes || null
    };

    const result = editingId
      ? await supabase.from('transactions').update(payload).eq('id', editingId)
      : await supabase.from('transactions').insert(payload);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setForm(initialForm);
    setEditingId(null);
    await load();
  };

  return (
    <section>
      <SectionHeader title="Movimientos" subtitle="Alta, edición y filtros por mes" />
      {error && <ErrorMessage message={error} />}
      <form className="form-grid" onSubmit={handleSubmit}>
        <input type="date" value={form.movement_date} onChange={(e) => setForm({ ...form, movement_date: e.target.value })} required />
        <select value={form.movement_type} onChange={(e) => setForm({ ...form, movement_type: e.target.value as MovementType })}>
          <option value="income">Ingreso</option>
          <option value="expense">Egreso</option>
          <option value="internal_transfer">Transferencia interna</option>
        </select>
        <select value={form.branch_id} onChange={(e) => setForm({ ...form, branch_id: e.target.value })} required>
          <option value="">Sucursal</option>
          {branches.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
        <select value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })} required>
          <option value="">Cuenta</option>
          {accounts.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
        <select value={form.payment_method_id} onChange={(e) => setForm({ ...form, payment_method_id: e.target.value })} required>
          <option value="">Medio</option>
          {methods.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
        <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} required>
          <option value="">Categoría</option>
          {categories.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
        <input placeholder="Concepto" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
        <input type="number" step="0.01" placeholder="Importe" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} required />
        <input placeholder="Observaciones" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        <button type="submit">{editingId ? 'Actualizar' : 'Guardar'}</button>
      </form>

      <div className="toolbar">
        <label>
          Mes
          <input type="month" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} />
        </label>
      </div>

      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Tipo</th>
            <th>Concepto</th>
            <th>Importe</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          {filteredRows.map((row) => (
            <tr key={row.id}>
              <td>{row.movement_date}</td>
              <td>{row.movement_type}</td>
              <td>{row.description}</td>
              <td>{row.amount.toFixed(2)}</td>
              <td>
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(row.id);
                    setForm({
                      movement_date: row.movement_date,
                      movement_type: row.movement_type,
                      branch_id: row.branch_id,
                      account_id: row.account_id,
                      payment_method_id: row.payment_method_id,
                      category_id: row.category_id,
                      description: row.description,
                      amount: row.amount,
                      notes: row.notes ?? '',
                      status: row.status
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

      {/* Créditos section */}
      {credits.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h3 style={{ margin: '0 0 12px' }}>Créditos</h3>

          {/* Pagos No Realizados */}
          {credits.filter((c) => c.credit_type === 'unpaid_payment').length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h4 style={{ margin: '0 0 8px', color: '#6b7280', fontWeight: 500 }}>Pagos No Realizados</h4>
              <table>
                <thead>
                  <tr>
                    <th>Descripción</th>
                    <th>Concepto</th>
                    <th>Cuotas restantes</th>
                    <th style={{ textAlign: 'right' }}>Monto restante</th>
                  </tr>
                </thead>
                <tbody>
                  {credits
                    .filter((c) => c.credit_type === 'unpaid_payment')
                    .map((credit) => {
                      const remaining = credit.amount - credit.paid_amount;
                      const remainingInstallments = credit.installments - credit.paid_installments;
                      return (
                        <tr key={credit.id}>
                          <td>{credit.description || '-'}</td>
                          <td>{catName[credit.category_id] ?? '-'}</td>
                          <td style={{ color: '#dc2626' }}>{remainingInstallments}</td>
                          <td style={{ textAlign: 'right', color: '#dc2626', fontWeight: 600 }}>
                            {formatCurrency(remaining)}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}

          {/* Créditos Tomados */}
          {credits.filter((c) => c.credit_type === 'taken_credit').length > 0 && (
            <div>
              <h4 style={{ margin: '0 0 8px', color: '#6b7280', fontWeight: 500 }}>Créditos Tomados</h4>
              <table>
                <thead>
                  <tr>
                    <th>Descripción</th>
                    <th>Concepto</th>
                    <th>Cuotas restantes</th>
                    <th style={{ textAlign: 'right' }}>Monto restante</th>
                  </tr>
                </thead>
                <tbody>
                  {credits
                    .filter((c) => c.credit_type === 'taken_credit')
                    .map((credit) => {
                      const remaining = credit.amount - credit.paid_amount;
                      const remainingInstallments = credit.installments - credit.paid_installments;
                      return (
                        <tr key={credit.id}>
                          <td>{credit.description || '-'}</td>
                          <td>{catName[credit.category_id] ?? '-'}</td>
                          <td style={{ color: '#dc2626' }}>{remainingInstallments}</td>
                          <td style={{ textAlign: 'right', color: '#dc2626', fontWeight: 600 }}>
                            {formatCurrency(remaining)}
                          </td>
                        </tr>
                      );
                    })}
                  <tr style={{ fontWeight: 700, borderTop: '2px solid #e5e7eb' }}>
                    <td colSpan={3}>TOTAL</td>
                    <td style={{ textAlign: 'right', color: '#dc2626' }}>
                      {formatCurrency(
                        credits
                          .filter((c) => c.credit_type === 'taken_credit')
                          .reduce((acc, c) => acc + (c.amount - c.paid_amount), 0)
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
