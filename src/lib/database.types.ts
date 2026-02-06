export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      sermons: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          gamma_url: string;
          created_at: string;
          status: "processing" | "ready" | "failed";
          hero_verse: string | null;
          scripture_references: Json;
          key_points: Json;
          transcript_excerpt: string | null;
          idempotency_key: string;
          gamma_request_id: string | null;
          pastor_name: string | null;
          tags: string[];
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          gamma_url: string;
          created_at?: string;
          status?: "processing" | "ready" | "failed";
          hero_verse?: string | null;
          scripture_references?: Json;
          key_points?: Json;
          transcript_excerpt?: string | null;
          idempotency_key: string;
          gamma_request_id?: string | null;
          pastor_name?: string | null;
          tags?: string[];
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          gamma_url?: string;
          created_at?: string;
          status?: "processing" | "ready" | "failed";
          hero_verse?: string | null;
          scripture_references?: Json;
          key_points?: Json;
          transcript_excerpt?: string | null;
          idempotency_key?: string;
          gamma_request_id?: string | null;
          pastor_name?: string | null;
          tags?: string[];
        };
        Relationships: [
          {
            foreignKeyName: "sermons_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
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
