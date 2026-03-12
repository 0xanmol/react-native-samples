import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

export const sql = postgres(DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export async function initDb(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      session_id  TEXT PRIMARY KEY,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS messages (
      id          BIGSERIAL PRIMARY KEY,
      session_id  TEXT NOT NULL REFERENCES sessions(session_id),
      role        TEXT NOT NULL CHECK (role IN ('user', 'agent')),
      content     TEXT NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Price alerts set by the user (or agent) — monitor and trigger when hit
  await sql`
    CREATE TABLE IF NOT EXISTS price_alerts (
      id            BIGSERIAL PRIMARY KEY,
      session_id    TEXT,
      token         TEXT NOT NULL,
      target_price  NUMERIC NOT NULL,
      direction     TEXT NOT NULL CHECK (direction IN ('above', 'below')),
      from_token    TEXT NOT NULL,
      to_token      TEXT NOT NULL,
      amount        NUMERIC NOT NULL,
      status        TEXT NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active', 'triggered', 'cancelled')),
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Transactions built from triggered alerts — awaiting mobile wallet signature
  await sql`
    CREATE TABLE IF NOT EXISTS pending_txs (
      tx_id         TEXT PRIMARY KEY,
      alert_id      BIGINT REFERENCES price_alerts(id),
      from_token    TEXT NOT NULL,
      to_token      TEXT NOT NULL,
      amount        NUMERIC NOT NULL,
      payload       TEXT NOT NULL,
      trigger_price NUMERIC,         -- SOL price that fired the alert; null for manual trades
      status        TEXT NOT NULL DEFAULT 'pending_signature'
                      CONSTRAINT pending_txs_status_check
                      CHECK (status IN ('pending_signature', 'signed', 'rejected', 'expired', 'confirmed', 'failed')),
      signature     TEXT,
      expires_at    TIMESTAMPTZ NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Migration: add trigger_price column to existing deployments
  await sql`
    ALTER TABLE pending_txs ADD COLUMN IF NOT EXISTS trigger_price NUMERIC
  `;

  // Migration: expand the status CHECK to include 'confirmed' and 'failed'.
  // Idempotent — skipped if the updated constraint already exists.
  await sql.unsafe(`
    DO $$
    DECLARE cname text;
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
         WHERE table_name = 'pending_txs'
           AND constraint_name = 'pending_txs_status_check'
      ) THEN
        SELECT constraint_name INTO cname
          FROM information_schema.table_constraints
         WHERE table_name = 'pending_txs'
           AND constraint_type = 'CHECK'
           AND constraint_name LIKE '%status%'
         LIMIT 1;
        IF cname IS NOT NULL THEN
          EXECUTE 'ALTER TABLE pending_txs DROP CONSTRAINT ' || quote_ident(cname);
        END IF;
        ALTER TABLE pending_txs
          ADD CONSTRAINT pending_txs_status_check
          CHECK (status IN ('pending_signature', 'signed', 'rejected', 'expired', 'confirmed', 'failed'));
      END IF;
    END;
    $$
  `);

  // Expo push tokens registered by mobile devices for background notifications
  await sql`
    CREATE TABLE IF NOT EXISTS devices (
      id             BIGSERIAL PRIMARY KEY,
      push_token     TEXT NOT NULL UNIQUE,
      wallet_address TEXT,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Migration: add wallet_address to existing deployments
  await sql`
    ALTER TABLE devices ADD COLUMN IF NOT EXISTS wallet_address TEXT
  `;

  console.log("[db] Schema ready");
}
