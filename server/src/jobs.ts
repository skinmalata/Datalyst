import { Queue, Worker } from "bullmq";
import { pool } from "./db.js";
const redisUrl = new URL(process.env.REDIS_URL || "redis://localhost:6379");
const connection = { host: redisUrl.hostname, port: Number(redisUrl.port || 6379), ...(redisUrl.username ? { username: decodeURIComponent(redisUrl.username) } : {}), ...(redisUrl.password ? { password: decodeURIComponent(redisUrl.password) } : {}), ...(redisUrl.protocol === "rediss:" ? { tls: {} } : {}) };
export const qualityQueue = new Queue("quality-checks", { connection });
export function startWorkers() {
  new Worker("quality-checks", async job => {
    const { datasetId, organizationId } = job.data as {datasetId:string;organizationId:string};
    const client=await pool.connect();
    try { await client.query("BEGIN"); await client.query("SELECT set_config('app.organization_id', $1, true)",[organizationId]); const result=await client.query("SELECT rows_json FROM datasets WHERE id=$1 AND organization_id=$2",[datasetId,organizationId]); if(!result.rowCount){await client.query("COMMIT");return {skipped:true}}; const rows=result.rows[0].rows_json as Record<string,unknown>[];let all=0,missing=0;rows.forEach(row=>Object.values(row).forEach(value=>{all++;if(value===null||value===undefined||String(value).trim()==="")missing++;}));const completeness=all?Math.round((1-missing/all)*100):0;await client.query("INSERT INTO audit_events(organization_id,event_type,entity_type,entity_id,metadata) VALUES($1,'quality.checked','dataset',$2,$3)",[organizationId,datasetId,JSON.stringify({records:rows.length,completeness})]);await client.query("COMMIT");return {records:rows.length,completeness}}catch(error){await client.query("ROLLBACK");throw error}finally{client.release()}
  }, { connection });
}
export async function scheduleQualityCheck(datasetId:string, organizationId:string) { await qualityQueue.add("profile-dataset", {datasetId,organizationId}, {attempts:3,backoff:{type:"exponential",delay:1000},removeOnComplete:100}); }
