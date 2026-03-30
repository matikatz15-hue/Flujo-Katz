import { FormEvent, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ErrorMessage } from '../components/ErrorMessage';
import { SectionHeader } from '../components/SectionHeader';
import { KpiCard } from '../components/KpiCard';
import { formatCurrency } from '../lib/format';
import { MovementType } from '../types/database';

interface Option {
  id: string;
  name: string;
}

interface DailyOperation {
  id: string;
  movement_date: string;
  movement_type: MovementType;
  amount: number;
  description: string;
  categories: { name: string } | null;
  concepts: { name: string } | null;
  accounts: { name: string } | null;
}

const baseForm = {
  movement_date: new Date().toISOString().slice(0, 10),
  movement_type: 'expense' as MovementType,
  account_id: '',
  category_id: '',
  concept_id: '',
  description: '',
  amount: 0
};

export function CashPage() {
  const [branchId, setBranchId] = useState<string>('');
  const [paymentMethodId, setPaymentMethodId] = useState<string>('');
  const [form, setForm] = useState(baseForm);
  const [fundName, setFundName] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [conceptName, setConceptName] = useState('');
  const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7));
  const [branches, setBranches] = useState<Option[]>([]);
  const [funds, setFunds] = useState<Option[]>([]);
  const [categories, setCategories] = useState<Option[]>([]);
  const [concepts, setConcepts] = useState<Option[]>([]);
  const [operations, setOperations] = useState<DailyOperation[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadOptions = async () => {
    const [{ data: branchData }, { data: categoryData }, { data: paymentData }] = await Promise.all([
      supabase.from('branches').select('id,name').order('name'),
      supabase.from('categories').select('id,name').order('name'),
      supabase.from('payment_methods').select('id,name').order('name').limit(1)
    ]);

    const safeBranches = (branchData ?? []) as Option[];
    setBranches(safeBranches);
    setCategories((categoryData ?? []) as Option[]);
    setPaymentMethodId((paymentData?.[0]?.id as string) ?? '');

    if (!branchId && safeBranches.length > 0) {
      setBranchId(safeBranches[0].id);
    }
  };

  const loadBranchFunds = async (selectedBranchId: string) => {
    if (!selectedBranchId) return;
    const { data } = await supabase.from('accounts').select('id,name').eq('branch_id', selectedBranchId).order('name');
    setFunds((data ?? []) as Option[]);
  };

  const loadConcepts = async (selectedCategoryId: string) => {
    if (!selectedCategoryId) {
      setConcepts([]);
      return;
    }
    const { data } = await supabase.from('concepts').select('id,name').eq('category_id', selectedCategoryId).order('name');
    setConcepts((data ?? []) as Option[]);
  };

  const loadOperations = async () => {
    const from = `${monthFilter}-01`;
    const to = `${monthFilter}-31`;

    const { data, error: fetchError } = await supabase
      .from('transactions')
      .select('id,movement_date,movement_type,amount,description,categories(name),concepts(name),accounts(name)')
      .gte('movement_date', from)
      .lte('movement_date', to)
      .in('movement_type', ['income', 'expense'])
      .eq('status', 'confirmed')
      .order('movement_date', { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      return;
    }

    setOperations((data ?? []) as DailyOperation[]);
  };

  useEffect(() => {
    void loadOptions();
  }, []);

  useEffect(() => {
    void loadBranchFunds(branchId);
  }, [branchId]);

  useEffect(() => {
    void loadConcepts(form.category_id);
  }, [form.category_id]);

  useEffect(() => {
    void loadOperations();
  }, [monthFilter]);

  const createFund = async () => {
    if (!fundName || !branchId) return;
    const { error: insertError } = await supabase.from('accounts').insert({ name: fundName, branch_id: branchId });
    if (insertError) return setError(insertError.message);
    setFundName('');
    await loadBranchFunds(branchId);
  };

  const createCategory = async () => {
    if (!categoryName) return;
    const { error: insertError } = await supabase.from('categories').insert({ name: categoryName });
    if (insertError) return setError(insertError.message);
    setCategoryName('');
    await loadOptions();
  };

  const createConcept = async () => {
    if (!conceptName || !form.category_id) return;
    const { error: insertError } = await supabase.from('concepts').insert({ name: conceptName, category_id: form.category_id });
    if (insertError) return setError(insertError.message);
    setConceptName('');
    await loadConcepts(form.category_id);
  };

  const saveOperation = async (event: FormEvent) => {
    event.preventDefault();
    if (!branchId || !paymentMethodId) return;

    const { error: insertError } = await supabase.from('transactions').insert({
      movement_date: form.movement_date,
      movement_type: form.movement_type,
      branch_id: branchId,
      account_id: form.account_id,
      category_id: form.category_id,
      concept_id: form.concept_id || null,
      payment_method_id: paymentMethodId,
      description: form.description,
      amount: Number(form.amount),
      status: 'confirmed'
    });

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setForm({ ...baseForm, movement_date: form.movement_date });
    await loadOperations();
  };

  const totals = useMemo(() => {
    const income = operations.filter((x) => x.movement_type === 'income').reduce((acc, item) => acc + item.amount, 0);
    const expense = operations.filter((x) => x.movement_type === 'expense').reduce((acc, item) => acc + item.amount, 0);
    return { income, expense, net: income - expense };
  }, [operations]);

  return (
    <section>
      <SectionHeader title="Módulo 2 · Caja diaria" subtitle="Fondos + operaciones diarias por rubro y concepto" />
      {error && <ErrorMessage message={error} />}

      <div className="kpi-grid">
        <KpiCard title="Ingresos del mes" value={totals.income} />
        <KpiCard title="Egresos del mes" value={totals.expense} />
        <KpiCard title="Neto del mes" value={totals.net} />
        <article className="card"><p>Mes de trabajo</p><strong>{monthFilter}</strong></article>
      </div>

      <div className="two-column">
        <div className="card-block">
          <h3>ABM rápido</h3>
          <label>Sucursal</label>
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            {branches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>

          <label>Crear fondo (+)</label>
          <div className="inline-form">
            <input value={fundName} onChange={(e) => setFundName(e.target.value)} placeholder="Banco / Efectivo / Meli" />
            <button type="button" onClick={() => void createFund()}>Crear</button>
          </div>

          <label>Crear rubro (+)</label>
          <div className="inline-form">
            <input value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="Impuestos / Sueldos / Proveedores" />
            <button type="button" onClick={() => void createCategory()}>Crear</button>
          </div>

          <label>Crear concepto (+)</label>
          <div className="inline-form">
            <input value={conceptName} onChange={(e) => setConceptName(e.target.value)} placeholder="I.V.A. BASE" />
            <button type="button" onClick={() => void createConcept()}>Crear</button>
          </div>
        </div>

        <form className="card-block" onSubmit={saveOperation}>
          <h3>Cargar operación diaria</h3>
          <label>Fecha</label>
          <input type="date" value={form.movement_date} onChange={(e) => setForm({ ...form, movement_date: e.target.value })} required />

          <label>Tipo</label>
          <select value={form.movement_type} onChange={(e) => setForm({ ...form, movement_type: e.target.value as MovementType })}>
            <option value="income">Ingreso</option>
            <option value="expense">Egreso</option>
          </select>

          <label>Fondo</label>
          <select value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })} required>
            <option value="">Seleccionar</option>
            {funds.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>

          <label>Rubro</label>
          <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value, concept_id: '' })} required>
            <option value="">Seleccionar</option>
            {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>

          <label>Concepto</label>
          <select value={form.concept_id} onChange={(e) => setForm({ ...form, concept_id: e.target.value })}>
            <option value="">Sin concepto</option>
            {concepts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>

          <label>Detalle</label>
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />

          <label>Importe</label>
          <input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} required />

          <button type="submit">Guardar operación</button>
        </form>
      </div>

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
            <th>Rubro</th>
            <th>Concepto</th>
            <th>Fondo</th>
            <th>Detalle</th>
            <th>Importe</th>
          </tr>
        </thead>
        <tbody>
          {operations.map((row) => (
            <tr key={row.id}>
              <td>{row.movement_date}</td>
              <td>{row.movement_type}</td>
              <td>{row.categories?.name ?? '-'}</td>
              <td>{row.concepts?.name ?? '-'}</td>
              <td>{row.accounts?.name ?? '-'}</td>
              <td>{row.description}</td>
              <td>{formatCurrency(row.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
