/**
 * Server-only Supabase client.
 *
 * Uses the SUPABASE_SERVICE_ROLE_KEY, which must NEVER be prefixed with
 * `PUBLIC_` and must never be referenced from any module that gets bundled for
 * the browser. This file is only imported by server-side code (API routes).
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL as string;
const SERVICE_ROLE_KEY = import.meta.env.SUPABASE_SERVICE_ROLE_KEY as
  string | undefined;

export const supabaseAdmin = createClient<Database>(
  SUPABASE_URL,
  SERVICE_ROLE_KEY ?? "",
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);
