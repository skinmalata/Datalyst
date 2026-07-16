-- Run this once in the Supabase SQL Editor after 001_init.sql.
-- It makes tenant policies apply even when the application connects as table owner.
ALTER TABLE datasets FORCE ROW LEVEL SECURITY;
ALTER TABLE metrics FORCE ROW LEVEL SECURITY;
ALTER TABLE analyses FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS datasets_organization_id_idx ON datasets(organization_id);
CREATE INDEX IF NOT EXISTS metrics_organization_id_idx ON metrics(organization_id);
CREATE INDEX IF NOT EXISTS analyses_organization_id_idx ON analyses(organization_id);
CREATE INDEX IF NOT EXISTS audit_events_organization_id_idx ON audit_events(organization_id);
