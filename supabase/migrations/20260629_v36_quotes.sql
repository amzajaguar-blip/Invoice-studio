-- VELA v36: Quotes & Quote Items Tables (CORRECTED)
-- Esegui in Supabase SQL Editor (copy/paste tutto)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "moddatetime";

-- ═══════════════════════════════════════════════════════════════════════════════
-- QUOTES TABLE
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  number VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'draft',
  issue_date DATE DEFAULT CURRENT_DATE,
  due_date DATE,
  subtotal NUMERIC(12,2) DEFAULT 0,
  tax_rate NUMERIC(5,2) DEFAULT 22,
  total NUMERIC(12,2) DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'EUR',
  notes TEXT,
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_quotes_org_number UNIQUE (org_id, number)
);

CREATE INDEX IF NOT EXISTS idx_quotes_org_id ON quotes(org_id);
CREATE INDEX IF NOT EXISTS idx_quotes_org_id_status ON quotes(org_id, status);
CREATE INDEX IF NOT EXISTS idx_quotes_client_id ON quotes(client_id);
CREATE INDEX IF NOT EXISTS idx_quotes_deleted_at ON quotes(deleted_at) WHERE deleted_at IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════════
-- QUOTE_ITEMS TABLE
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS quote_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(10,2) DEFAULT 1,
  unit_price NUMERIC(12,2) DEFAULT 0,
  tax_rate NUMERIC(5,2) DEFAULT 22,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quote_items_quote_id ON quote_items(quote_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;

-- ═══ Quotes RLS ─────────────────────────────────────────────────────────────
CREATE POLICY "org_members_can_read_quotes" ON quotes
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
    AND deleted_at IS NULL
  );

CREATE POLICY "org_members_can_insert_quotes" ON quotes
  FOR INSERT WITH CHECK (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );

CREATE POLICY "org_members_can_update_quotes" ON quotes
  FOR UPDATE USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
    AND deleted_at IS NULL
  );

-- Soft delete: allow UPDATE to set deleted_at
CREATE POLICY "org_members_can_soft_delete_quotes" ON quotes
  FOR UPDATE USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );

-- Hard DELETE blocked by trigger, but policy needed for RBAC
CREATE POLICY "org_members_can_delete_quotes" ON quotes
  FOR DELETE USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );

-- ═══ Quote Items RLS (COMPLETE) ─────────────────────────────────────────────
CREATE POLICY "org_members_can_read_quote_items" ON quote_items
  FOR SELECT USING (
    quote_id IN (
      SELECT id FROM quotes 
      WHERE org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
      AND deleted_at IS NULL
    )
  );

CREATE POLICY "org_members_can_insert_quote_items" ON quote_items
  FOR INSERT WITH CHECK (
    quote_id IN (
      SELECT id FROM quotes 
      WHERE org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
      AND deleted_at IS NULL
    )
  );

CREATE POLICY "org_members_can_update_quote_items" ON quote_items
  FOR UPDATE USING (
    quote_id IN (
      SELECT id FROM quotes 
      WHERE org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
      AND deleted_at IS NULL
    )
  );

CREATE POLICY "org_members_can_delete_quote_items" ON quote_items
  FOR DELETE USING (
    quote_id IN (
      SELECT id FROM quotes 
      WHERE org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
      AND deleted_at IS NULL
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- TRIGGERS: Auto updated_at
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TRIGGER handle_updated_at_quotes
BEFORE UPDATE ON quotes
FOR EACH ROW EXECUTE FUNCTION moddatetime('updated_at');

CREATE TRIGGER handle_updated_at_quote_items
BEFORE UPDATE ON quote_items
FOR EACH ROW EXECUTE FUNCTION moddatetime('updated_at');

-- ═══════════════════════════════════════════════════════════════════════════════
-- TRIGGER: Soft Delete (CORRETTO)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Function that actually performs the UPDATE instead of letting DELETE happen
CREATE OR REPLACE FUNCTION soft_delete_quote()
RETURNS TRIGGER AS $$
BEGIN
  -- Perform the soft delete UPDATE
  UPDATE quotes
  SET deleted_at = NOW(), updated_at = NOW()
  WHERE id = OLD.id;
  
  -- Return NULL to prevent the row from being deleted
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Apply soft delete trigger - blocks hard deletes
CREATE TRIGGER trigger_soft_delete_quote
BEFORE DELETE ON quotes
FOR EACH ROW
EXECUTE FUNCTION soft_delete_quote();

-- ═══════════════════════════════════════════════════════════════════════════════
-- TRIGGER: Calculate Totals (CORRETTO)
-- ═══════════════════════════════════════════════════════════════════════════════
-- More robust version that handles INSERT, UPDATE, DELETE correctly
CREATE OR REPLACE FUNCTION update_quote_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_quote_id UUID;
  v_subtotal NUMERIC(12,2);
  v_tax_rate NUMERIC(5,2);
  v_tax_amount NUMERIC(12,2);
  v_total NUMERIC(12,2);
BEGIN
  -- Determine which quote_id to use (NEW for INSERT/UPDATE, OLD for DELETE)
  v_quote_id := COALESCE(NEW.quote_id, OLD.quote_id);
  
  -- Skip if no valid quote_id (shouldn't happen)
  IF v_quote_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Get current tax_rate from the quote
  SELECT COALESCE(tax_rate, 22) INTO v_tax_rate FROM quotes WHERE id = v_quote_id;
  
  -- Calculate subtotal from all line items for this quote
  SELECT COALESCE(SUM(quantity * unit_price), 0)
  INTO v_subtotal
  FROM quote_items
  WHERE quote_id = v_quote_id;
  
  -- Calculate total with tax
  v_tax_amount := v_subtotal * (v_tax_rate / 100);
  v_total := v_subtotal + v_tax_amount;
  
  -- Update the quote totals
  UPDATE quotes
  SET 
    subtotal = v_subtotal,
    total = v_total,
    updated_at = NOW()
  WHERE id = v_quote_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger fires on any change to quote_items
CREATE TRIGGER trigger_update_quote_totals
AFTER INSERT OR UPDATE OR DELETE ON quote_items
FOR EACH ROW
EXECUTE FUNCTION update_quote_totals();

-- ═══════════════════════════════════════════════════════════════════════════════
-- TRIGGER: Recalculate on tax_rate change in quotes
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION recalc_quote_totals_on_tax_change()
RETURNS TRIGGER AS $$
DECLARE
  v_subtotal NUMERIC(12,2);
  v_tax_amount NUMERIC(12,2);
  v_total NUMERIC(12,2);
BEGIN
  -- Only recalculate if tax_rate or the items changed
  IF OLD.tax_rate IS DISTINCT FROM NEW.tax_rate OR OLD.subtotal IS DISTINCT FROM NEW.subtotal THEN
    SELECT COALESCE(SUM(quantity * unit_price), 0)
    INTO v_subtotal
    FROM quote_items
    WHERE quote_id = NEW.id;
    
    v_tax_amount := v_subtotal * (NEW.tax_rate / 100);
    v_total := v_subtotal + v_tax_amount;
    
    NEW.subtotal := v_subtotal;
    NEW.total := v_total;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_recalc_totals_on_tax_change
BEFORE UPDATE ON quotes
FOR EACH ROW
EXECUTE FUNCTION recalc_quote_totals_on_tax_change();

-- ═══════════════════════════════════════════════════════════════════════════════
-- VIEW: Quote with calculated totals (PERFORMANCE ALTERNATIVE)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Use this view instead of triggers for better performance with many items
-- The view calculates totals on-demand, avoiding trigger overhead
CREATE OR REPLACE VIEW quotes_with_totals AS
SELECT 
  q.*,
  COALESCE(SUM(qi.quantity * qi.unit_price) OVER (PARTITION BY q.id), 0) AS calculated_subtotal,
  ROUND(
    COALESCE(SUM(qi.quantity * qi.unit_price) OVER (PARTITION BY q.id), 0) * (1 + q.tax_rate / 100),
    2
  ) AS calculated_total
FROM quotes q
LEFT JOIN quote_items qi ON qi.quote_id = q.id
WHERE q.deleted_at IS NULL;

-- Function to get totals without trigger (alternative to triggers)
CREATE OR REPLACE FUNCTION get_quote_totals(p_quote_id UUID)
RETURNS TABLE(subtotal NUMERIC(12,2), tax_rate NUMERIC(5,2), total NUMERIC(12,2)) AS $$
BEGIN
  RETURN QUERY
  WITH item_sum AS (
    SELECT 
      COALESCE(SUM(quantity * unit_price), 0) AS subtotal,
      MAX(tax_rate) AS tax_rate
    FROM quote_items
    WHERE quote_id = p_quote_id
  )
  SELECT 
    item_sum.subtotal,
    COALESCE(item_sum.tax_rate, 22) AS tax_rate,
    ROUND(item_sum.subtotal * (1 + COALESCE(item_sum.tax_rate, 22) / 100), 2) AS total
  FROM item_sum;
END;
$$ LANGUAGE plpgsql;
