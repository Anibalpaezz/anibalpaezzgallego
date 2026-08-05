import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env
  .PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const getAuthStorage = () => {
  if (typeof window === "undefined") return undefined;
  return localStorage;
};

export const supabase = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storage: getAuthStorage(),
      persistSession: true,
      autoRefreshToken: true,
    },
  },
);
