import type pg from "pg";
import type { Tenant } from "./db.js";
export async function audit(client: pg.PoolClient, tenant: Tenant, event: string, entity: string, id: string | null, metadata: object = {}) {
  await client.query("INSERT INTO audit_events(organization_id,actor_id,event_type,entity_type,entity_id,metadata) VALUES($1,$2,$3,$4,$5,$6)", [tenant.organizationId, tenant.userId, event, entity, id, metadata]);
}
