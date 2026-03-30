export type MovementType = 'income' | 'expense' | 'internal_transfer';
export type TransactionStatus = 'draft' | 'confirmed' | 'cancelled';
export type CheckType = 'issued' | 'received';
export type CheckStatus = 'pending' | 'deposited' | 'cleared' | 'bounced' | 'cancelled';

export interface Branch {
  id: string;
  name: string;
}

export interface Account {
  id: string;
  branch_id: string;
  name: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
}

export interface Category {
  id: string;
  parent_id: string | null;
  name: string;
}

export interface Transaction {
  id: string;
  movement_date: string;
  movement_type: MovementType;
  branch_id: string;
  account_id: string;
  payment_method_id: string;
  category_id: string;
  description: string;
  amount: number;
  notes: string | null;
  status: TransactionStatus;
}

export interface Check {
  id: string;
  check_type: CheckType;
  third_party: string;
  amount: number;
  issue_date: string;
  due_date: string;
  status: CheckStatus;
  notes: string | null;
}

export interface DailyCashSummary {
  day: string;
  income_total: number;
  expense_total: number;
  net_total: number;
  month_running_net: number;
}

export interface MonthlySummary {
  month: string;
  income_total: number;
  expense_total: number;
  net_total: number;
  previous_net_total: number | null;
  variation_vs_previous: number | null;
}
