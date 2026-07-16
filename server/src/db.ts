import pg from "pg";
const { Pool } = pg;
export const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
export type Tenant = { organizationId: string; userId: string; role: "viewer"|"analyst"|"steward"|"admin"|"auditor" };
export async function withTenant<T>(tenant: Tenant, work: (client: pg.PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try { await client.query("BEGIN"); await client.query("SELECT set_config('app.organization_id', $1, true)", [tenant.organizationId]); const result = await work(client); await client.query("COMMIT"); return result; }
  catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}
