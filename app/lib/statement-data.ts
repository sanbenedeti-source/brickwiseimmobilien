import type { SupabaseClient } from "@supabase/supabase-js";
import type { LedgerRow } from "./client-finance";

/** Every wallet ledger row of one client, oldest first (RLS also limits rows to the owner). */
export async function loadLedger(client: SupabaseClient, userId: string): Promise<LedgerRow[] | null> {
  const rows: LedgerRow[] = [];
  for (let offset = 0; offset < 20_000; offset += 1000) {
    const { data, error } = await client.from("wallet_transactions")
      .select("id,type,direction,amount,property_slug,shares,reference_type,idempotency_key,created_at")
      .eq("user_id", userId).order("created_at").order("id").range(offset, offset + 999);
    if (error) return null;
    rows.push(...(data || []).map((row) => ({ ...row, amount: Number(row.amount), shares: row.shares === null ? null : Number(row.shares) }) as LedgerRow));
    if (!data || data.length < 1000) break;
  }
  return rows;
}
