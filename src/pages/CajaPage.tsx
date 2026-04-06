import { FormEvent, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Category, Credit, CreditType } from '../types/database';
import { SectionHeader } from '../components/SectionHeader';
import { ErrorMessage } from '../components/ErrorMessage';
import { formatCurrency } from '../lib/format';

interface Option {
  id: string;
  name: string;
}

const initialForm = {
  credit_type: 'taken_credit' as CreditType,
  rubro_id: '',
  category_id: '',
  description: '',
  notes: '',
  amount: 0,
  installments: 1,
  first_payment_date: new Date().toISOString().slice(0, 10)
};

const CREDIT_TYPE_LABELS: Record<CreditType, string> = {
  unpaid_payment: 'Pago no realizado',
  taken_credit: 'Crédito tomado'
};

export function CajaPage() {
  const [credits, setCredits] = useState<Credit[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState<string | null>(null);

  // Rubros = parent categories (parent_id is null)
  const rubros = useMemo(() => categories.filter((c) => c.parent_id === null), [categories]);

  // Conceptos = children of selected rubro
  const conceptos = useMemo(
    () => categories.filter((c) => c.parent_id === form.rubro_id),
    [categories, form.rubro_id]
  );

  // Category name lookup
  const catName = useMemo(() => {
    const map: Record<string, string> = {};
    categories.forEach((c) => { map[c.id] = c.name; });
    return map;
  }, [categories]);

  const load = async () => {
    const [{ data: creditData, error: creditError }, { data: categoryData, error: catError }] =
      await Promise.all([
        supabase
          .from('credits')
          .select('*')
          .eq('status', 'active')
          .order('created_at', { ascending: false }),
        supabase.from('categories').select('*').order('name')
      ]);

    if (creditError || catError) {
      setError(creditError?.message ?? catError?.message ?? 'Error cargando datos');
      return;
    }
    setCredits((creditData ?? []) as Credit[]);
    setCategories((categoryData ?? []) as Category[]);
  };

  useEffect(() => {
    void load();
  }, []);

  // When rubro changes, reset concepto
  const handleRubroChange = (rubroId: string) => {
    setForm({ ...form, rubro_id: rubroId, category_id: '' });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.category_id) {
      setError('Seleccioná un Concepto');
      return;
    }
    setError(null);

    const payload = {
      credit_type: form.credit_type,
      category_id: form.category_id,
      description: form.description,
      notes: form.notes || null,
      amount: Number(form.amount),
      installments: Number(form.installments),
      first_payment_date: form.first_payment_date
    };

    const { error: insertError } = await supabase.from('credits').insert(payload);
    if (insertError) {
      setError(insertError.message);
      return;
    }

    setForm(initialForm);
    await load();
  };

  const unpaidPayments = credits.filter((c) => c.credit_type === 'unpaid_payment');
  const takenCredits = credits.filter((c) => c.credit_type === 'taken_credit');

  const renderCreditRow = (credit: Credit) => {
    const remaining = credit.amount - credit.paid_amount;
    const remainingInstallments = credit.installments - credit.paid_installments;
    const conceptoName = catName[credit.category_id] ?? '-';

    return (
      <tr key={credit.id}>
        <td>{CREDIT_TYPE_LABELS[credit.credit_type]}</td>
        <td>{conceptoName}</td>
        <td>{credit.description || '-'}</td>
        <td style={{ color: '#dc2626', fontWeight: 600 }}>{formatCurrency(remaining)}</td>
        <td style={{ color: '#dc2626' }}>
          {remainingInstallments} cuota{remainingInstallments !== 1 ? 's' : ''} restante{remainingInstallments !== 1 ? 's' : ''}
        </td>
        <td>{credit.first_payment_date}</td>
        <td>
          <button
            type="button"
            style={{ background: '#15803d', fontSize: '0.8rem', padding: '4px 8px', marginRight: 6 }}
            onClick={() => handlePayInstallment(credit)}
          >
            Registrar pago
          </button>
          <button
            type="button"
            style={{ background: '#991b1b', fontSize: '0.8rem', padding: '4px 8px' }}
            onClick={() => handleCancel(credit.id)}
          >
            Cancelar
          </button>
        </td>
      </tr>
    );
  };

  const handlePayInstallment = async (credit: Credit) => {
    const installmentAmount = credit.amount / credit.installments;
    const newPaidAmount = credit.paid_amount + installmentAmount;
    const newPaidInstallments = credit.paid_installments + 1;
    const isComplete = newPaidInstallments >= credit.installments;

    const { error: updateError } = await supabase
      .from('credits')
      .update({
        paid_amount: newPaidAmount,
        paid_installments: newPaidInstallments,
        status: isComplete ? 'completed' : 'active'
      })
      .eq('id', credit.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    await load();
  };

  const handleCancel = async (id: string) => {
    const { error: updateError } = await supabase
      .from('credits')
      .update({ status: 'cancelled' })
      .eq('id', id);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    await load();
  };

  return (
    <section>
      <SectionHeader title="Caja" subtitle="Gestión de créditos y pagos pendientes" />
      {error && <ErrorMessage message={error} />}

      {/* Credits section header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '20px 0 12px' }}>
        <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>Créditos</span>
      </div>

      {/* Credits form */}
      <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 24 }}>
        <select
          value={form.credit_type}
          onChange={(e) => setForm({ ...form, credit_type: e.target.value as CreditType })}
        >
          <option value="unpaid_payment">Pago no realizado</option>
          <option value="taken_credit">Crédito tomado</option>
        </select>

        <select value={form.rubro_id} onChange={(e) => handleRubroChange(e.target.value)} required>
          <option value="">Rubro...</option>
          {rubros.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>

        <select
          value={form.category_id}
          onChange={(e) => setForm({ ...form, category_id: e.target.value })}
          required
          disabled={!form.rubro_id}
        >
          <option value="">Concepto...</option>
          {conceptos.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <input
          type="number"
          step="0.01"
          placeholder="$0.000.000,00"
          value={form.amount || ''}
          onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
          required
          min="0.01"
        />

        <input
          placeholder="Descripción..."
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />

        <input
          placeholder="N° factura / Observaciones"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>Cuotas</label>
          <input
            type="number"
            min="1"
            value={form.installments}
            onChange={(e) => setForm({ ...form, installments: Number(e.target.value) })}
            required
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>1er pago</label>
          <input
            type="date"
            value={form.first_payment_date}
            onChange={(e) => setForm({ ...form, first_payment_date: e.target.value })}
            required
          />
        </div>

        <button type="submit" style={{ alignSelf: 'flex-end' }}>+</button>
      </form>

      {/* Pagos No Realizados */}
      <div style={{ marginBottom: 24 }}>
        <h4 style={{ margin: '0 0 8px', color: '#6b7280', fontWeight: 500 }}>Pagos No Realizados</h4>
        {unpaidPayments.length === 0 ? (
          <p style={{ color: '#9ca3af', margin: 0 }}>Sin registros</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Concepto</th>
                <th>Descripción</th>
                <th>Monto restante</th>
                <th>Cuotas</th>
                <th>1er pago</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>{unpaidPayments.map(renderCreditRow)}</tbody>
          </table>
        )}
      </div>

      {/* Créditos Tomados */}
      <div>
        <h4 style={{ margin: '0 0 8px', color: '#6b7280', fontWeight: 500 }}>Créditos Tomados</h4>
        {takenCredits.length === 0 ? (
          <p style={{ color: '#9ca3af', margin: 0 }}>Sin registros</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Concepto</th>
                <th>Descripción</th>
                <th>Monto restante</th>
                <th>Cuotas</th>
                <th>1er pago</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>{takenCredits.map(renderCreditRow)}</tbody>
          </table>
        )}
      </div>
    </section>
  );
}
