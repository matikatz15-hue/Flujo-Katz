import { formatCurrency } from '../lib/format';

interface Props {
  title: string;
  value: number;
}

export function KpiCard({ title, value }: Props) {
  return (
    <article className="card">
      <p>{title}</p>
      <strong>{formatCurrency(value)}</strong>
    </article>
  );
}
