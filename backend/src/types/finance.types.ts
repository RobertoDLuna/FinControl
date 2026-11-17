export type CategoryType = 'INCOME' | 'EXPENSE';

export type AccountType =
  | 'CHECKING'
  | 'CREDIT_CARD'
  | 'DEBIT_CARD'
  | 'CASH'
  | 'INVESTMENT';

export type BankCode =
  | 'NUBANK'
  | 'INTER'
  | 'ITAU'
  | 'BRADESCO'
  | 'SANTANDER'
  | 'CAIXA'
  | 'BANCO_DO_BRASIL'
  | 'CASH'
  | 'OTHER';

export interface Category {
  id: string;
  userId: string;
  name: string;
  type: CategoryType;
  color: string | null;
  icon: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Account {
  id: string;
  userId: string;
  name: string;
  bankCode: BankCode;
  type: AccountType;
  initialBalanceCents: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AccountWithBalance extends Account {
  currentBalanceCents: number;
}
