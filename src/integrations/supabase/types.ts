export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13.0.5";
  };
  public: {
    Tables: {
      contacts: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          message: string;
          name: string;
          subject: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
          message: string;
          name: string;
          subject: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          message?: string;
          name?: string;
          subject?: string;
        };
        Relationships: [];
      };
      propinas: {
        Row: {
          id: number;
          fecha: string;
          turno: "mañana" | "tarde" | "noche" | null;
          cantidad: number;
          metodo_pago: "efectivo" | "tarjeta" | null;
          direccion: string | null;
          clima: string | null;
          notas: string | null;
        };
        Insert: {
          id?: number;
          fecha: string;
          turno?: "mañana" | "tarde" | "noche" | null;
          cantidad: number;
          metodo_pago?: "efectivo" | "tarjeta" | null;
          direccion?: string | null;
          clima?: string | null;
          notas?: string | null;
        };
        Update: {
          id?: number;
          fecha?: string;
          turno?: "mañana" | "tarde" | "noche" | null;
          cantidad?: number;
          metodo_pago?: "efectivo" | "tarjeta" | null;
          direccion?: string | null;
          clima?: string | null;
          notas?: string | null;
        };
        Relationships: [];
      };
      cookie_consent_log: {
        Row: {
          consent_id: number;
          created_at: string;
          consented_at: string;
          anonymous_id: string;
          user_id: number | null;
          ip_address: string | null;
          user_agent: string | null;
          browser_language: string | null;
          page_url: string | null;
          policy_version: string;
          necessary_cookies: boolean;
          analytics_cookies: boolean;
          marketing_cookies: boolean;
          preferences_cookies: boolean;
          consent_action: string;
          consent_method: string;
        };
        Insert: {
          consent_id?: number;
          created_at?: string;
          consented_at?: string;
          anonymous_id: string;
          user_id?: number | null;
          ip_address?: string | null;
          user_agent?: string | null;
          browser_language?: string | null;
          page_url?: string | null;
          policy_version: string;
          necessary_cookies: boolean;
          analytics_cookies: boolean;
          marketing_cookies: boolean;
          preferences_cookies: boolean;
          consent_action: string;
          consent_method: string;
        };
        Update: {
          consent_id?: number;
          created_at?: string;
          consented_at?: string;
          anonymous_id?: string;
          user_id?: number | null;
          ip_address?: string | null;
          user_agent?: string | null;
          browser_language?: string | null;
          page_url?: string | null;
          policy_version?: string;
          necessary_cookies?: boolean;
          analytics_cookies?: boolean;
          marketing_cookies?: boolean;
          preferences_cookies?: boolean;
          consent_action?: string;
          consent_method?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database["public"];

export type Tables<
  T extends keyof PublicSchema["Tables"] | keyof PublicSchema["Views"],
> = T extends keyof PublicSchema["Tables"]
  ? PublicSchema["Tables"][T]["Row"]
  : T extends keyof PublicSchema["Views"]
    ? PublicSchema["Views"][T]["Row"]
    : never;

export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];

export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];

export type Enums<T extends keyof PublicSchema["Enums"]> =
  PublicSchema["Enums"][T];

export type CompositeTypes<T extends keyof PublicSchema["CompositeTypes"]> =
  PublicSchema["CompositeTypes"][T];
