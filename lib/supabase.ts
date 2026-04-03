import { createClient } from "@supabase/supabase-js";
import type { MyDataRecord } from "@/lib/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase env vars are missing. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  return supabase;
}

export async function insertMyData({
  ownerAddress,
  rawData
}: {
  ownerAddress: string;
  rawData: Record<string, unknown>;
}) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("my_data")
    .insert({
      owner_address: ownerAddress.toLowerCase(),
      raw_data: rawData
    })
    .select("id, owner_address, raw_data, created_at")
    .single();

  if (error) {
    throw new Error(`Supabase insert failed: ${error.message}`);
  }

  return data as MyDataRecord;
}

export async function getMyDataById(id: string) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("my_data")
    .select("id, owner_address, raw_data, created_at")
    .eq("id", id)
    .single();

  if (error) {
    throw new Error(`Supabase select failed: ${error.message}`);
  }

  return data as MyDataRecord;
}

