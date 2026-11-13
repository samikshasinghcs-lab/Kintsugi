-- Kintsugi tenant-isolated PostgreSQL schema for Cloudflare Workers + Hyperdrive.
-- Apply with a migration/admin role. Runtime connections must use a non-owner role.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subject text NOT NULL,
  email text,
  active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, subject)
);
CREATE UNIQUE INDEX IF NOT EXISTS memberships_one_default_per_subject
  ON memberships(subject) WHERE is_default AND active;
CREATE INDEX IF NOT EXISTS memberships_subject_idx ON memberships(subject) WHERE active;

CREATE TABLE IF NOT EXISTS cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  created_by_subject text NOT NULL,
  customer_display_name text,
  support_path text NOT NULL CHECK (support_path IN ('fraud', 'hardship')),
  urgency text NOT NULL CHECK (urgency IN ('high', 'unclear', 'normal')),
  issue_category text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_review', 'resolved', 'closed')),
  summary text NOT NULL CHECK (length(summary) <= 3000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cases_tenant_created_idx ON cases(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS case_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  case_id uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  actor_subject text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('case_created', 'status_changed', 'handoff_prepared', 'note_added')),
  detail text NOT NULL CHECK (length(detail) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS case_events_tenant_case_idx ON case_events(tenant_id, case_id, created_at);

ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases FORCE ROW LEVEL SECURITY;
ALTER TABLE case_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS memberships_self_read ON memberships;
CREATE POLICY memberships_self_read ON memberships
  FOR SELECT USING (subject = current_setting('app.user_sub', true) AND active = true);

DROP POLICY IF EXISTS cases_tenant_isolation ON cases;
CREATE POLICY cases_tenant_isolation ON cases
  FOR ALL
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS case_events_tenant_isolation ON case_events;
CREATE POLICY case_events_tenant_isolation ON case_events
  FOR ALL
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

-- Provision a dedicated LOGIN role outside this migration and grant only required privileges.
-- Example (DBA-controlled; choose a strong secret outside source control):
--   CREATE ROLE kintsugi_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
--   GRANT CONNECT ON DATABASE your_database TO kintsugi_app;
--   GRANT USAGE ON SCHEMA public TO kintsugi_app;
--   GRANT SELECT ON memberships TO kintsugi_app;
--   GRANT SELECT, INSERT, UPDATE ON cases TO kintsugi_app;
--   GRANT SELECT, INSERT ON case_events TO kintsugi_app;
--   GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO kintsugi_app;
-- Do not grant BYPASSRLS. The runtime role must not own these tables or be a superuser.
