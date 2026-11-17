-- FinControl - Schema Inicial Multi-tenant (PostgreSQL)
-- Regras aplicadas:
-- - Isolamento multi-tenant obrigatório via user_id em todas as tabelas de domínio
-- - Valores monetários armazenados em centavos (BIGINT) para precisão exata
-- - Suporte nativo a bancos brasileiros, rendas fixas/variáveis e motor de parcelamento

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Função compartilhada para atualização automática de updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 1. USUÁRIOS (SaaS Ready: controle de plano FREE / PRO)
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  plan_tier VARCHAR(20) NOT NULL DEFAULT 'FREE'
    CHECK (plan_tier IN ('FREE', 'PRO')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 2. CONTAS E CARTEIRAS (Suporte a bancos brasileiros e tipos de conta)
-- ============================================================================
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  bank_code VARCHAR(40) NOT NULL DEFAULT 'OTHER'
    CHECK (bank_code IN (
      'NUBANK',
      'INTER',
      'ITAU',
      'BRADESCO',
      'SANTANDER',
      'CAIXA',
      'BANCO_DO_BRASIL',
      'CASH',
      'OTHER'
    )),
  type VARCHAR(20) NOT NULL
    CHECK (type IN ('CHECKING', 'CREDIT_CARD', 'DEBIT_CARD', 'CASH', 'INVESTMENT')),
  initial_balance_cents BIGINT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);

CREATE TRIGGER trg_accounts_updated_at
  BEFORE UPDATE ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 3. CARTÕES DE CRÉDITO
-- ============================================================================
CREATE TABLE IF NOT EXISTS cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL,
  name VARCHAR(100) NOT NULL,
  brand VARCHAR(40),
  last_four_digits CHAR(4),
  credit_limit_cents BIGINT NOT NULL CHECK (credit_limit_cents >= 0),
  closing_day SMALLINT NOT NULL CHECK (closing_day BETWEEN 1 AND 31),
  due_day SMALLINT NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (account_id, user_id) REFERENCES accounts(id, user_id) ON DELETE CASCADE,
  UNIQUE (id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_cards_user_id ON cards(user_id);
CREATE INDEX IF NOT EXISTS idx_cards_user_account ON cards(user_id, account_id);

CREATE TRIGGER trg_cards_updated_at
  BEFORE UPDATE ON cards
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 4. CATEGORIAS
-- ============================================================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(80) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('INCOME', 'EXPENSE')),
  color VARCHAR(20),
  icon VARCHAR(50),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, name, type)
);

CREATE INDEX IF NOT EXISTS idx_categories_user_type ON categories(user_id, type);

CREATE TRIGGER trg_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 5. RENDAS (Fixa com recorrência mensal vs. Variável por competência)
-- ============================================================================
CREATE TABLE IF NOT EXISTS incomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  description VARCHAR(180) NOT NULL,
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('FIXED', 'VARIABLE')),
  competence_date DATE NOT NULL,
  recurrence_day SMALLINT CHECK (recurrence_day BETWEEN 1 AND 31),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (frequency = 'FIXED' AND recurrence_day IS NOT NULL)
    OR (frequency = 'VARIABLE')
  ),
  FOREIGN KEY (account_id, user_id) REFERENCES accounts(id, user_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_incomes_user_competence ON incomes(user_id, competence_date);
CREATE INDEX IF NOT EXISTS idx_incomes_user_frequency ON incomes(user_id, frequency, is_active);

CREATE TRIGGER trg_incomes_updated_at
  BEFORE UPDATE ON incomes
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 6. TRANSAÇÕES (Base financeira e vínculo pai para parcelamentos)
-- ============================================================================
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL,
  card_id UUID REFERENCES cards(id) ON DELETE SET NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  income_id UUID REFERENCES incomes(id) ON DELETE SET NULL,
  parent_transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('INCOME', 'EXPENSE', 'TRANSFER')),
  status VARCHAR(20) NOT NULL DEFAULT 'PAID'
    CHECK (status IN ('PENDING', 'PAID', 'CANCELED')),
  description VARCHAR(200) NOT NULL,
  total_amount_cents BIGINT NOT NULL CHECK (total_amount_cents > 0),
  is_installment BOOLEAN NOT NULL DEFAULT FALSE,
  total_installments SMALLINT NOT NULL DEFAULT 1
    CHECK (total_installments >= 1 AND total_installments <= 120),
  occurred_at DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (account_id, user_id) REFERENCES accounts(id, user_id) ON DELETE RESTRICT,
  UNIQUE (id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_occurred
  ON transactions(user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_type_status
  ON transactions(user_id, type, status);
CREATE INDEX IF NOT EXISTS idx_transactions_user_parent
  ON transactions(user_id, parent_transaction_id);

CREATE TRIGGER trg_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 7. PARCELAS (Motor de parcelamento mês a mês e antecipação)
-- ============================================================================
CREATE TABLE IF NOT EXISTS installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_transaction_id UUID NOT NULL,
  account_id UUID NOT NULL,
  card_id UUID REFERENCES cards(id) ON DELETE SET NULL,
  installment_number SMALLINT NOT NULL CHECK (installment_number >= 1),
  total_installments SMALLINT NOT NULL CHECK (total_installments >= 1),
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  billing_month DATE NOT NULL,
  due_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'PAID', 'ANTICIPATED', 'CANCELED')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (installment_number <= total_installments),
  FOREIGN KEY (parent_transaction_id, user_id)
    REFERENCES transactions(id, user_id) ON DELETE CASCADE,
  FOREIGN KEY (account_id, user_id)
    REFERENCES accounts(id, user_id) ON DELETE RESTRICT,
  UNIQUE (parent_transaction_id, installment_number)
);

CREATE INDEX IF NOT EXISTS idx_installments_user_due
  ON installments(user_id, due_date, status);
CREATE INDEX IF NOT EXISTS idx_installments_user_billing
  ON installments(user_id, billing_month, status);
CREATE INDEX IF NOT EXISTS idx_installments_user_card_status
  ON installments(user_id, card_id, status);

CREATE TRIGGER trg_installments_updated_at
  BEFORE UPDATE ON installments
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
