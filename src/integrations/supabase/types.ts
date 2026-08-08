export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          calendar_event_id: string | null
          confirmation_deadline_at: string | null
          contact_id: string | null
          created_at: string
          created_from: string | null
          description: string | null
          end_at: string
          external_sync_error_code: string | null
          external_sync_status: string
          google_calendar_id: string | null
          id: string
          idempotency_key: string | null
          lead_id: string | null
          location: string | null
          meet_link: string | null
          meeting_id: string | null
          meeting_provider: string | null
          meeting_type: string | null
          replaced_by_id: string | null
          start_at: string
          status: Database["public"]["Enums"]["appointment_status"] | null
          tenant_id: string
          timezone: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          calendar_event_id?: string | null
          confirmation_deadline_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_from?: string | null
          description?: string | null
          end_at: string
          external_sync_error_code?: string | null
          external_sync_status?: string
          google_calendar_id?: string | null
          id?: string
          idempotency_key?: string | null
          lead_id?: string | null
          location?: string | null
          meet_link?: string | null
          meeting_id?: string | null
          meeting_provider?: string | null
          meeting_type?: string | null
          replaced_by_id?: string | null
          start_at: string
          status?: Database["public"]["Enums"]["appointment_status"] | null
          tenant_id: string
          timezone?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          calendar_event_id?: string | null
          confirmation_deadline_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_from?: string | null
          description?: string | null
          end_at?: string
          external_sync_error_code?: string | null
          external_sync_status?: string
          google_calendar_id?: string | null
          id?: string
          idempotency_key?: string | null
          lead_id?: string | null
          location?: string | null
          meet_link?: string | null
          meeting_id?: string | null
          meeting_provider?: string | null
          meeting_type?: string | null
          replaced_by_id?: string | null
          start_at?: string
          status?: Database["public"]["Enums"]["appointment_status"] | null
          tenant_id?: string
          timezone?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_replaced_by_id_fkey"
            columns: ["replaced_by_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_tenant_contact_fkey"
            columns: ["tenant_id", "contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "appointments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments_history: {
        Row: {
          changed_by_user_id: string | null
          created_at: string
          id: string
          new_appointment_id: string | null
          old_appointment_id: string | null
          reason: string | null
          tenant_id: string
        }
        Insert: {
          changed_by_user_id?: string | null
          created_at?: string
          id?: string
          new_appointment_id?: string | null
          old_appointment_id?: string | null
          reason?: string | null
          tenant_id: string
        }
        Update: {
          changed_by_user_id?: string | null
          created_at?: string
          id?: string
          new_appointment_id?: string | null
          old_appointment_id?: string | null
          reason?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_history_new_appointment_id_fkey"
            columns: ["new_appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_history_old_appointment_id_fkey"
            columns: ["old_appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          id: string
          payload_json: Json | null
          tenant_id: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          payload_json?: Json | null
          tenant_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          payload_json?: Json | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_links: {
        Row: {
          calendar_event_id: string
          contact_id: string | null
          created_at: string
          id: string
          tenant_id: string
          whatsapp_to_e164: string | null
        }
        Insert: {
          calendar_event_id: string
          contact_id?: string | null
          created_at?: string
          id?: string
          tenant_id: string
          whatsapp_to_e164?: string | null
        }
        Update: {
          calendar_event_id?: string
          contact_id?: string | null
          created_at?: string
          id?: string
          tenant_id?: string
          whatsapp_to_e164?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_links_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_links_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      call_logs: {
        Row: {
          connected_seconds: number | null
          contact_id: string | null
          created_at: string
          direction: Database["public"]["Enums"]["call_direction"] | null
          id: string
          outcome_json: Json | null
          recording_url: string | null
          tenant_id: string
          transcript: string | null
          twilio_call_sid: string | null
        }
        Insert: {
          connected_seconds?: number | null
          contact_id?: string | null
          created_at?: string
          direction?: Database["public"]["Enums"]["call_direction"] | null
          id?: string
          outcome_json?: Json | null
          recording_url?: string | null
          tenant_id: string
          transcript?: string | null
          twilio_call_sid?: string | null
        }
        Update: {
          connected_seconds?: number | null
          contact_id?: string | null
          created_at?: string
          direction?: Database["public"]["Enums"]["call_direction"] | null
          id?: string
          outcome_json?: Json | null
          recording_url?: string | null
          tenant_id?: string
          transcript?: string | null
          twilio_call_sid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_tenant_contact_fkey"
            columns: ["tenant_id", "contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "call_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      call_queue: {
        Row: {
          attempt_count: number | null
          callback_source: string | null
          callback_time: string | null
          contact_id: string
          created_at: string
          id: string
          last_attempt_at: string | null
          last_call_sid: string | null
          last_error_code: string | null
          last_voice_outcome: string | null
          last_wa_outcome: string | null
          last_wa_sent_at: string | null
          locked_at: string | null
          max_attempts: number | null
          next_action_channel: string | null
          next_attempt_at: string | null
          notes: string | null
          outcome: string | null
          priority: number | null
          retry_after: string | null
          status: string
          tenant_id: string
          updated_at: string
          wa_available: boolean | null
          worker_id: string | null
        }
        Insert: {
          attempt_count?: number | null
          callback_source?: string | null
          callback_time?: string | null
          contact_id: string
          created_at?: string
          id?: string
          last_attempt_at?: string | null
          last_call_sid?: string | null
          last_error_code?: string | null
          last_voice_outcome?: string | null
          last_wa_outcome?: string | null
          last_wa_sent_at?: string | null
          locked_at?: string | null
          max_attempts?: number | null
          next_action_channel?: string | null
          next_attempt_at?: string | null
          notes?: string | null
          outcome?: string | null
          priority?: number | null
          retry_after?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
          wa_available?: boolean | null
          worker_id?: string | null
        }
        Update: {
          attempt_count?: number | null
          callback_source?: string | null
          callback_time?: string | null
          contact_id?: string
          created_at?: string
          id?: string
          last_attempt_at?: string | null
          last_call_sid?: string | null
          last_error_code?: string | null
          last_voice_outcome?: string | null
          last_wa_outcome?: string | null
          last_wa_sent_at?: string | null
          locked_at?: string | null
          max_attempts?: number | null
          next_action_channel?: string | null
          next_attempt_at?: string | null
          notes?: string | null
          outcome?: string | null
          priority?: number | null
          retry_after?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          wa_available?: boolean | null
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_queue_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_queue_tenant_contact_fkey"
            columns: ["tenant_id", "contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "call_queue_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_sources: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          source: Database["public"]["Enums"]["contact_source"]
          tenant_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          source?: Database["public"]["Enums"]["contact_source"]
          tenant_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          source?: Database["public"]["Enums"]["contact_source"]
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_sources_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: true
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_sources_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_stages: {
        Row: {
          contact_id: string
          id: string
          stage_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          contact_id: string
          id?: string
          stage_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          contact_id?: string
          id?: string
          stage_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_stages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: true
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_stages_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_stages_tenant_contact_fkey"
            columns: ["tenant_id", "contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "contact_stages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_stages_tenant_stage_fkey"
            columns: ["tenant_id", "stage_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      contacts: {
        Row: {
          appointment_datetime: string | null
          created_at: string
          do_not_contact: boolean | null
          email: string | null
          from_inactive_form: boolean | null
          id: string
          last_activity_at: string | null
          name: string
          phone_e164: string | null
          stage: string
          submission_id: string | null
          tenant_id: string
          updated_at: string
          zoom_link: string | null
        }
        Insert: {
          appointment_datetime?: string | null
          created_at?: string
          do_not_contact?: boolean | null
          email?: string | null
          from_inactive_form?: boolean | null
          id?: string
          last_activity_at?: string | null
          name: string
          phone_e164?: string | null
          stage?: string
          submission_id?: string | null
          tenant_id: string
          updated_at?: string
          zoom_link?: string | null
        }
        Update: {
          appointment_datetime?: string | null
          created_at?: string
          do_not_contact?: boolean | null
          email?: string | null
          from_inactive_form?: boolean | null
          id?: string
          last_activity_at?: string | null
          name?: string
          phone_e164?: string | null
          stage?: string
          submission_id?: string | null
          tenant_id?: string
          updated_at?: string
          zoom_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "facebook_form_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      facebook_form_answers: {
        Row: {
          answer_text: string | null
          created_at: string
          id: string
          question_key: string
          question_label: string
          submission_id: string
          tenant_id: string
        }
        Insert: {
          answer_text?: string | null
          created_at?: string
          id?: string
          question_key: string
          question_label: string
          submission_id: string
          tenant_id: string
        }
        Update: {
          answer_text?: string | null
          created_at?: string
          id?: string
          question_key?: string
          question_label?: string
          submission_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "facebook_form_answers_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "facebook_form_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facebook_form_answers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      facebook_form_questions: {
        Row: {
          created_at: string
          form_id: string
          id: string
          question_key: string
          question_label: string
          question_order: number
          tenant_id: string
        }
        Insert: {
          created_at?: string
          form_id: string
          id?: string
          question_key: string
          question_label: string
          question_order?: number
          tenant_id: string
        }
        Update: {
          created_at?: string
          form_id?: string
          id?: string
          question_key?: string
          question_label?: string
          question_order?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "facebook_form_questions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "facebook_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facebook_form_questions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      facebook_form_submissions: {
        Row: {
          contact_id: string | null
          created_at: string
          form_id: string
          id: string
          leadgen_id: string | null
          raw_payload: Json
          received_at: string
          tenant_id: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          form_id: string
          id?: string
          leadgen_id?: string | null
          raw_payload?: Json
          received_at?: string
          tenant_id: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          form_id?: string
          id?: string
          leadgen_id?: string | null
          raw_payload?: Json
          received_at?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "facebook_form_submissions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facebook_form_submissions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "facebook_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facebook_form_submissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      facebook_forms: {
        Row: {
          created_at: string
          external_form_id: string
          first_seen_at: string
          form_name: string | null
          id: string
          is_active: boolean | null
          last_lead_at: string | null
          lead_count: number | null
          page_id: string | null
          page_name: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          external_form_id: string
          first_seen_at?: string
          form_name?: string | null
          id?: string
          is_active?: boolean | null
          last_lead_at?: string | null
          lead_count?: number | null
          page_id?: string | null
          page_name?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          external_form_id?: string
          first_seen_at?: string
          form_name?: string | null
          id?: string
          is_active?: boolean | null
          last_lead_at?: string | null
          lead_count?: number | null
          page_id?: string | null
          page_name?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "facebook_forms_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      facebook_integrations: {
        Row: {
          access_token: string
          created_at: string
          form_id: string | null
          page_id: string
          tenant_id: string
          token_expires_at: string | null
          updated_at: string
          user_access_token: string | null
        }
        Insert: {
          access_token: string
          created_at?: string
          form_id?: string | null
          page_id: string
          tenant_id: string
          token_expires_at?: string | null
          updated_at?: string
          user_access_token?: string | null
        }
        Update: {
          access_token?: string
          created_at?: string
          form_id?: string | null
          page_id?: string
          tenant_id?: string
          token_expires_at?: string | null
          updated_at?: string
          user_access_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "facebook_integrations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      facebook_lead_imports: {
        Row: {
          contact_id: string | null
          form_id: string | null
          id: string
          imported_at: string
          leadgen_id: string
          page_id: string | null
          raw_data: Json
          tenant_id: string
        }
        Insert: {
          contact_id?: string | null
          form_id?: string | null
          id?: string
          imported_at?: string
          leadgen_id: string
          page_id?: string | null
          raw_data?: Json
          tenant_id: string
        }
        Update: {
          contact_id?: string | null
          form_id?: string | null
          id?: string
          imported_at?: string
          leadgen_id?: string
          page_id?: string | null
          raw_data?: Json
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "facebook_lead_imports_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facebook_lead_imports_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      followup_queue: {
        Row: {
          action_type: string
          attempt_no: number
          created_at: string
          id: string
          lead_id: string
          payload: Json | null
          planned_at: string
          reason: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          action_type: string
          attempt_no?: number
          created_at?: string
          id?: string
          lead_id: string
          payload?: Json | null
          planned_at: string
          reason?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          action_type?: string
          attempt_no?: number
          created_at?: string
          id?: string
          lead_id?: string
          payload?: Json | null
          planned_at?: string
          reason?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "followup_queue_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_queue_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      followup_rules: {
        Row: {
          daily_call_window_end: string
          daily_call_window_start: string
          max_attempts_call: number
          max_attempts_whatsapp: number
          quiet_hours_end: string
          quiet_hours_start: string
          retry_after_no_answer_minutes: number
          sector: string
          stop_words: string[]
          tenant_id: string
          tone: string
        }
        Insert: {
          daily_call_window_end?: string
          daily_call_window_start?: string
          max_attempts_call?: number
          max_attempts_whatsapp?: number
          quiet_hours_end?: string
          quiet_hours_start?: string
          retry_after_no_answer_minutes?: number
          sector?: string
          stop_words?: string[]
          tenant_id: string
          tone?: string
        }
        Update: {
          daily_call_window_end?: string
          daily_call_window_start?: string
          max_attempts_call?: number
          max_attempts_whatsapp?: number
          quiet_hours_end?: string
          quiet_hours_start?: string
          retry_after_no_answer_minutes?: number
          sector?: string
          stop_words?: string[]
          tenant_id?: string
          tone?: string
        }
        Relationships: [
          {
            foreignKeyName: "followup_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      google_tokens: {
        Row: {
          access_token: string
          calendar_id: string | null
          created_at: string
          refresh_token: string
          scope: string | null
          sync_token: string | null
          tenant_id: string
          token_expires_at: string
          updated_at: string
        }
        Insert: {
          access_token: string
          calendar_id?: string | null
          created_at?: string
          refresh_token: string
          scope?: string | null
          sync_token?: string | null
          tenant_id: string
          token_expires_at: string
          updated_at?: string
        }
        Update: {
          access_token?: string
          calendar_id?: string | null
          created_at?: string
          refresh_token?: string
          scope?: string | null
          sync_token?: string | null
          tenant_id?: string
          token_expires_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_tokens_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      google_watch_channels: {
        Row: {
          active: boolean
          calendar_id: string
          channel_id: string
          created_at: string
          expires_at: string
          id: string
          resource_id: string | null
          tenant_id: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          calendar_id: string
          channel_id: string
          created_at?: string
          expires_at: string
          id?: string
          resource_id?: string | null
          tenant_id: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          calendar_id?: string
          channel_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          resource_id?: string | null
          tenant_id?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_watch_channels_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      interactions: {
        Row: {
          channel: string
          content: string | null
          created_at: string
          direction: string
          id: string
          lead_id: string
          meta: Json | null
          outcome: string | null
          tenant_id: string
        }
        Insert: {
          channel: string
          content?: string | null
          created_at?: string
          direction: string
          id?: string
          lead_id: string
          meta?: Json | null
          outcome?: string | null
          tenant_id: string
        }
        Update: {
          channel?: string
          content?: string | null
          created_at?: string
          direction?: string
          id?: string
          lead_id?: string
          meta?: Json | null
          outcome?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_call_recaps: {
        Row: {
          call_log_id: string | null
          contact_id: string
          created_at: string
          id: string
          next_step: string | null
          objections: string | null
          priority: string | null
          raw_input: string | null
          summary_bullets_json: Json
          tenant_id: string
          updated_at: string
        }
        Insert: {
          call_log_id?: string | null
          contact_id: string
          created_at?: string
          id?: string
          next_step?: string | null
          objections?: string | null
          priority?: string | null
          raw_input?: string | null
          summary_bullets_json?: Json
          tenant_id: string
          updated_at?: string
        }
        Update: {
          call_log_id?: string | null
          contact_id?: string
          created_at?: string
          id?: string
          next_step?: string | null
          objections?: string | null
          priority?: string | null
          raw_input?: string | null
          summary_bullets_json?: Json
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_call_recaps_call_log_id_fkey"
            columns: ["call_log_id"]
            isOneToOne: false
            referencedRelation: "call_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_call_recaps_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_call_recaps_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_form_answers: {
        Row: {
          answers_json: Json
          contact_id: string
          created_at: string
          form_id: string | null
          form_provider: Database["public"]["Enums"]["form_provider"]
          id: string
          tenant_id: string
        }
        Insert: {
          answers_json?: Json
          contact_id: string
          created_at?: string
          form_id?: string | null
          form_provider?: Database["public"]["Enums"]["form_provider"]
          id?: string
          tenant_id: string
        }
        Update: {
          answers_json?: Json
          contact_id?: string
          created_at?: string
          form_id?: string | null
          form_provider?: Database["public"]["Enums"]["form_provider"]
          id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_form_answers_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_form_answers_tenant_contact_fkey"
            columns: ["tenant_id", "contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "lead_form_answers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_notes: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          note_text: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          note_text: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          note_text?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_notes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_notes_tenant_contact_fkey"
            columns: ["tenant_id", "contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "lead_notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          appointment_id: string | null
          created_at: string
          email: string | null
          form_payload: Json | null
          handoff_status: string | null
          id: string
          last_contact_at: string | null
          name: string
          next_action_at: string | null
          notes: string | null
          phone_e164: string | null
          priority_score: number | null
          source: string | null
          status: string
          tags: string[] | null
          tenant_id: string
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          email?: string | null
          form_payload?: Json | null
          handoff_status?: string | null
          id?: string
          last_contact_at?: string | null
          name: string
          next_action_at?: string | null
          notes?: string | null
          phone_e164?: string | null
          priority_score?: number | null
          source?: string | null
          status?: string
          tags?: string[] | null
          tenant_id: string
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          email?: string | null
          form_payload?: Json | null
          handoff_status?: string | null
          id?: string
          last_contact_at?: string | null
          name?: string
          next_action_at?: string | null
          notes?: string | null
          phone_e164?: string | null
          priority_score?: number | null
          source?: string | null
          status?: string
          tags?: string[] | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["membership_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["membership_role"]
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["membership_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      message_logs: {
        Row: {
          category: Database["public"]["Enums"]["message_category"] | null
          channel: string | null
          contact_id: string | null
          created_at: string
          id: string
          payload_json: Json | null
          provider_message_id: string | null
          status: Database["public"]["Enums"]["message_status"] | null
          template_name: string | null
          tenant_id: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["message_category"] | null
          channel?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          payload_json?: Json | null
          provider_message_id?: string | null
          status?: Database["public"]["Enums"]["message_status"] | null
          template_name?: string | null
          tenant_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["message_category"] | null
          channel?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          payload_json?: Json | null
          provider_message_id?: string | null
          status?: Database["public"]["Enums"]["message_status"] | null
          template_name?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_logs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_states: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          metadata_json: Json
          provider: string
          redirect_uri: string | null
          state_hash: string
          tenant_id: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          metadata_json?: Json
          provider: string
          redirect_uri?: string | null
          state_hash: string
          tenant_id: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          metadata_json?: Json
          provider?: string
          redirect_uri?: string | null
          state_hash?: string
          tenant_id?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_states_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pipelines: {
        Row: {
          created_at: string
          id: string
          name: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipelines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          code: string
          feature_flags: Json
          features: Json
          included_connected_seconds_per_quarter: number
          included_voice_minutes: number
          included_wa_messages: number
          included_wa_templates_per_quarter: number
          minimum_commitment_months: number
          monthly_price_cents: number
          name: string
          overage_mode: string
          overage_voice_cent_per_min: number
          overage_wa_cent_per_msg: number
          price_per_quarter_cents: number
          setup_fee_cents: number
          technical_cost_per_voice_min_cents: number
          warning_thresholds: Json
          whatsapp_billing_mode: string
          whatsapp_markup_cent_per_msg: number
        }
        Insert: {
          code: string
          feature_flags?: Json
          features?: Json
          included_connected_seconds_per_quarter?: number
          included_voice_minutes?: number
          included_wa_messages?: number
          included_wa_templates_per_quarter?: number
          minimum_commitment_months?: number
          monthly_price_cents?: number
          name: string
          overage_mode?: string
          overage_voice_cent_per_min?: number
          overage_wa_cent_per_msg?: number
          price_per_quarter_cents?: number
          setup_fee_cents?: number
          technical_cost_per_voice_min_cents?: number
          warning_thresholds?: Json
          whatsapp_billing_mode?: string
          whatsapp_markup_cent_per_msg?: number
        }
        Update: {
          code?: string
          feature_flags?: Json
          features?: Json
          included_connected_seconds_per_quarter?: number
          included_voice_minutes?: number
          included_wa_messages?: number
          included_wa_templates_per_quarter?: number
          minimum_commitment_months?: number
          monthly_price_cents?: number
          name?: string
          overage_mode?: string
          overage_voice_cent_per_min?: number
          overage_wa_cent_per_msg?: number
          price_per_quarter_cents?: number
          setup_fee_cents?: number
          technical_cost_per_voice_min_cents?: number
          warning_thresholds?: Json
          whatsapp_billing_mode?: string
          whatsapp_markup_cent_per_msg?: number
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          created_at: string
          created_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          role: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          role?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          role?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_events: {
        Row: {
          attempts: number
          created_at: string
          event_type: string | null
          external_event_id: string
          id: string
          last_error_code: string | null
          locked_at: string | null
          payload_digest: string | null
          processed_at: string | null
          provider: string
          status: string
          tenant_id: string | null
          updated_at: string
          worker_id: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          event_type?: string | null
          external_event_id: string
          id?: string
          last_error_code?: string | null
          locked_at?: string | null
          payload_digest?: string | null
          processed_at?: string | null
          provider: string
          status?: string
          tenant_id?: string | null
          updated_at?: string
          worker_id?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          event_type?: string | null
          external_event_id?: string
          id?: string
          last_error_code?: string | null
          locked_at?: string | null
          payload_digest?: string | null
          processed_at?: string | null
          provider?: string
          status?: string
          tenant_id?: string | null
          updated_at?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_codes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_commissions: {
        Row: {
          amount_cents: number
          created_at: string
          id: string
          level: number
          paid_at: string | null
          period_end: string | null
          period_start: string | null
          rate_percent: number
          referred_tenant_id: string
          referrer_tenant_id: string
          status: string
          subscription_id: string | null
        }
        Insert: {
          amount_cents?: number
          created_at?: string
          id?: string
          level?: number
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          rate_percent?: number
          referred_tenant_id: string
          referrer_tenant_id: string
          status?: string
          subscription_id?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          level?: number
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          rate_percent?: number
          referred_tenant_id?: string
          referrer_tenant_id?: string
          status?: string
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_commissions_referred_tenant_id_fkey"
            columns: ["referred_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_commissions_referrer_tenant_id_fkey"
            columns: ["referrer_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_commissions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          level: number
          referred_tenant_id: string
          referrer_tenant_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          level?: number
          referred_tenant_id: string
          referrer_tenant_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          level?: number
          referred_tenant_id?: string
          referrer_tenant_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referred_tenant_id_fkey"
            columns: ["referred_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_tenant_id_fkey"
            columns: ["referrer_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          appointment_id: string | null
          attempts: number
          channel: string
          contact_id: string | null
          created_at: string
          error_message: string | null
          id: string
          last_error_code: string | null
          locked_at: string | null
          payload_json: Json | null
          reminder_type: string
          sent_at: string | null
          status: string
          tenant_id: string
          when_ts: string
          worker_id: string | null
        }
        Insert: {
          appointment_id?: string | null
          attempts?: number
          channel: string
          contact_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          last_error_code?: string | null
          locked_at?: string | null
          payload_json?: Json | null
          reminder_type: string
          sent_at?: string | null
          status?: string
          tenant_id: string
          when_ts: string
          worker_id?: string | null
        }
        Update: {
          appointment_id?: string | null
          attempts?: number
          channel?: string
          contact_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          last_error_code?: string | null
          locked_at?: string | null
          payload_json?: Json | null
          reminder_type?: string
          sent_at?: string | null
          status?: string
          tenant_id?: string
          when_ts?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reminders_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_tenant_appointment_fkey"
            columns: ["tenant_id", "appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "reminders_tenant_contact_fkey"
            columns: ["tenant_id", "contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "reminders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          active_facebook_form_id: string | null
          ai_data_processing_opt_in: boolean
          ai_prompt_json: Json | null
          allowed_origins: string[]
          auto_call_on_lead: boolean | null
          availability_json: Json | null
          booking_rules_json: Json | null
          calendar_enabled: boolean | null
          calendar_id: string | null
          caller_id_e164: string | null
          crm_tabs_json: Json | null
          default_meeting_provider: string | null
          do_not_contact_default: boolean | null
          facebook_webhook_secret: string | null
          formality: Database["public"]["Enums"]["formality_type"] | null
          language_voice: string | null
          language_whatsapp: string | null
          overage_mode_override: string | null
          recording_opt_in: boolean | null
          retention_days: number | null
          retry_config_json: Json | null
          tenant_id: string
          timezone: string
          tone: Database["public"]["Enums"]["tone_type"] | null
          twilio_number_sid: string | null
          updated_at: string
          voice_enabled: boolean | null
          voice_number: string | null
          voice_pack_id: string | null
          whatsapp_display_number: string | null
          whatsapp_enabled: boolean | null
          whatsapp_phone_number_id: string | null
          whatsapp_templates_json: Json | null
        }
        Insert: {
          active_facebook_form_id?: string | null
          ai_data_processing_opt_in?: boolean
          ai_prompt_json?: Json | null
          allowed_origins?: string[]
          auto_call_on_lead?: boolean | null
          availability_json?: Json | null
          booking_rules_json?: Json | null
          calendar_enabled?: boolean | null
          calendar_id?: string | null
          caller_id_e164?: string | null
          crm_tabs_json?: Json | null
          default_meeting_provider?: string | null
          do_not_contact_default?: boolean | null
          facebook_webhook_secret?: string | null
          formality?: Database["public"]["Enums"]["formality_type"] | null
          language_voice?: string | null
          language_whatsapp?: string | null
          overage_mode_override?: string | null
          recording_opt_in?: boolean | null
          retention_days?: number | null
          retry_config_json?: Json | null
          tenant_id: string
          timezone?: string
          tone?: Database["public"]["Enums"]["tone_type"] | null
          twilio_number_sid?: string | null
          updated_at?: string
          voice_enabled?: boolean | null
          voice_number?: string | null
          voice_pack_id?: string | null
          whatsapp_display_number?: string | null
          whatsapp_enabled?: boolean | null
          whatsapp_phone_number_id?: string | null
          whatsapp_templates_json?: Json | null
        }
        Update: {
          active_facebook_form_id?: string | null
          ai_data_processing_opt_in?: boolean
          ai_prompt_json?: Json | null
          allowed_origins?: string[]
          auto_call_on_lead?: boolean | null
          availability_json?: Json | null
          booking_rules_json?: Json | null
          calendar_enabled?: boolean | null
          calendar_id?: string | null
          caller_id_e164?: string | null
          crm_tabs_json?: Json | null
          default_meeting_provider?: string | null
          do_not_contact_default?: boolean | null
          facebook_webhook_secret?: string | null
          formality?: Database["public"]["Enums"]["formality_type"] | null
          language_voice?: string | null
          language_whatsapp?: string | null
          overage_mode_override?: string | null
          recording_opt_in?: boolean | null
          retention_days?: number | null
          retry_config_json?: Json | null
          tenant_id?: string
          timezone?: string
          tone?: Database["public"]["Enums"]["tone_type"] | null
          twilio_number_sid?: string | null
          updated_at?: string
          voice_enabled?: boolean | null
          voice_number?: string | null
          voice_pack_id?: string | null
          whatsapp_display_number?: string | null
          whatsapp_enabled?: boolean | null
          whatsapp_phone_number_id?: string | null
          whatsapp_templates_json?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "settings_active_facebook_form_id_fkey"
            columns: ["active_facebook_form_id"]
            isOneToOne: false
            referencedRelation: "facebook_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      site_chat_messages: {
        Row: {
          chatbot_id: string
          content: string
          created_at: string
          id: string
          input_tokens: number
          output_tokens: number
          role: string
          safety_status: string
          session_id: string
          source_ids: string[]
          tenant_id: string
        }
        Insert: {
          chatbot_id: string
          content: string
          created_at?: string
          id?: string
          input_tokens?: number
          output_tokens?: number
          role: string
          safety_status?: string
          session_id: string
          source_ids?: string[]
          tenant_id: string
        }
        Update: {
          chatbot_id?: string
          content?: string
          created_at?: string
          id?: string
          input_tokens?: number
          output_tokens?: number
          role?: string
          safety_status?: string
          session_id?: string
          source_ids?: string[]
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_chat_messages_chatbot_id_fkey"
            columns: ["chatbot_id"]
            isOneToOne: false
            referencedRelation: "site_chatbots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "site_chat_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_chat_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      site_chat_sessions: {
        Row: {
          chatbot_id: string
          consent_at: string | null
          contact_id: string | null
          created_at: string
          expires_at: string
          id: string
          ip_hash: string
          last_seen_at: string
          lead_id: string | null
          origin: string
          session_token_hash: string
          status: string
          tenant_id: string
          user_agent: string | null
        }
        Insert: {
          chatbot_id: string
          consent_at?: string | null
          contact_id?: string | null
          created_at?: string
          expires_at: string
          id?: string
          ip_hash: string
          last_seen_at?: string
          lead_id?: string | null
          origin: string
          session_token_hash: string
          status?: string
          tenant_id: string
          user_agent?: string | null
        }
        Update: {
          chatbot_id?: string
          consent_at?: string | null
          contact_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          ip_hash?: string
          last_seen_at?: string
          lead_id?: string | null
          origin?: string
          session_token_hash?: string
          status?: string
          tenant_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "site_chat_sessions_chatbot_id_fkey"
            columns: ["chatbot_id"]
            isOneToOne: false
            referencedRelation: "site_chatbots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_chat_sessions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_chat_sessions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_chat_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      site_chatbots: {
        Row: {
          accent_color: string
          allowed_origins: string[]
          calendar_enabled: boolean
          collect_email: boolean
          collect_name: boolean
          collect_phone: boolean
          consent_text: string
          create_crm_contact: boolean
          created_at: string
          display_name: string
          escalation_enabled: boolean
          human_label: string
          id: string
          is_enabled: boolean
          max_messages_per_session: number
          monthly_message_limit: number
          position: string
          public_key: string
          rate_limit_per_minute: number
          require_consent: boolean
          retention_days: number
          tenant_id: string
          updated_at: string
          welcome_message: string
        }
        Insert: {
          accent_color?: string
          allowed_origins?: string[]
          calendar_enabled?: boolean
          collect_email?: boolean
          collect_name?: boolean
          collect_phone?: boolean
          consent_text?: string
          create_crm_contact?: boolean
          created_at?: string
          display_name?: string
          escalation_enabled?: boolean
          human_label?: string
          id?: string
          is_enabled?: boolean
          max_messages_per_session?: number
          monthly_message_limit?: number
          position?: string
          public_key?: string
          rate_limit_per_minute?: number
          require_consent?: boolean
          retention_days?: number
          tenant_id: string
          updated_at?: string
          welcome_message?: string
        }
        Update: {
          accent_color?: string
          allowed_origins?: string[]
          calendar_enabled?: boolean
          collect_email?: boolean
          collect_name?: boolean
          collect_phone?: boolean
          consent_text?: string
          create_crm_contact?: boolean
          created_at?: string
          display_name?: string
          escalation_enabled?: boolean
          human_label?: string
          id?: string
          is_enabled?: boolean
          max_messages_per_session?: number
          monthly_message_limit?: number
          position?: string
          public_key?: string
          rate_limit_per_minute?: number
          require_consent?: boolean
          retention_days?: number
          tenant_id?: string
          updated_at?: string
          welcome_message?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_chatbots_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      stages: {
        Row: {
          color: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          pipeline_id: string
          position: number
          stage_type: string
          tenant_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          pipeline_id: string
          position?: number
          stage_type?: string
          tenant_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          pipeline_id?: string
          position?: number
          stage_type?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          id: string
          period_end: string | null
          period_start: string | null
          plan_code: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          period_end?: string | null
          period_start?: string | null
          plan_code: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          period_end?: string | null
          period_start?: string | null
          plan_code?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_code_fkey"
            columns: ["plan_code"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_knowledge: {
        Row: {
          content_summary: string | null
          content_text: string | null
          crawled_pages: number | null
          created_at: string
          error_message: string | null
          id: string
          page_count: number | null
          source_name: string
          source_type: string
          source_url: string | null
          status: string
          storage_path: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          content_summary?: string | null
          content_text?: string | null
          crawled_pages?: number | null
          created_at?: string
          error_message?: string | null
          id?: string
          page_count?: number | null
          source_name: string
          source_type: string
          source_url?: string | null
          status?: string
          storage_path?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          content_summary?: string | null
          content_text?: string | null
          crawled_pages?: number | null
          created_at?: string
          error_message?: string | null
          id?: string
          page_count?: number | null
          source_name?: string
          source_type?: string
          source_url?: string | null
          status?: string
          storage_path?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_knowledge_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_phone_numbers: {
        Row: {
          country_code: string | null
          created_at: string
          id: string
          monthly_cost_cents: number | null
          phone_number: string
          phone_type: string
          provider_account_owner: string
          provider_status: string
          provisioning_error: string | null
          status: string
          tenant_id: string
          twilio_sid: string | null
          twilio_subaccount_sid: string | null
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          country_code?: string | null
          created_at?: string
          id?: string
          monthly_cost_cents?: number | null
          phone_number: string
          phone_type: string
          provider_account_owner?: string
          provider_status?: string
          provisioning_error?: string | null
          status?: string
          tenant_id: string
          twilio_sid?: string | null
          twilio_subaccount_sid?: string | null
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          country_code?: string | null
          created_at?: string
          id?: string
          monthly_cost_cents?: number | null
          phone_number?: string
          phone_type?: string
          provider_account_owner?: string
          provider_status?: string
          provisioning_error?: string | null
          status?: string
          tenant_id?: string
          twilio_sid?: string | null
          twilio_subaccount_sid?: string | null
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_phone_numbers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_secrets: {
        Row: {
          created_at: string
          facebook_webhook_secret: string | null
          metadata_json: Json
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          facebook_webhook_secret?: string | null
          metadata_json?: Json
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          facebook_webhook_secret?: string | null
          metadata_json?: Json
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_secrets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          country: string | null
          created_at: string
          id: string
          name: string
          slug: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          id?: string
          name: string
          slug?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string
          id?: string
          name?: string
          slug?: string | null
        }
        Relationships: []
      }
      usage_alerts: {
        Row: {
          alert_type: string
          channel: string
          created_at: string
          id: string
          message: string | null
          period_month: string
          resource: string
          sent_at: string
          tenant_id: string
          threshold_percent: number
        }
        Insert: {
          alert_type: string
          channel?: string
          created_at?: string
          id?: string
          message?: string | null
          period_month: string
          resource: string
          sent_at?: string
          tenant_id: string
          threshold_percent: number
        }
        Update: {
          alert_type?: string
          channel?: string
          created_at?: string
          id?: string
          message?: string | null
          period_month?: string
          resource?: string
          sent_at?: string
          tenant_id?: string
          threshold_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "usage_alerts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_site_chat_daily: {
        Row: {
          date: string
          estimated_cost_cents: number
          input_tokens: number
          messages: number
          output_tokens: number
          tenant_id: string
        }
        Insert: {
          date?: string
          estimated_cost_cents?: number
          input_tokens?: number
          messages?: number
          output_tokens?: number
          tenant_id: string
        }
        Update: {
          date?: string
          estimated_cost_cents?: number
          input_tokens?: number
          messages?: number
          output_tokens?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_site_chat_daily_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_voice_daily: {
        Row: {
          connected_seconds: number | null
          date: string
          id: string
          tenant_id: string
        }
        Insert: {
          connected_seconds?: number | null
          date: string
          id?: string
          tenant_id: string
        }
        Update: {
          connected_seconds?: number | null
          date?: string
          id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_voice_daily_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_wa_daily: {
        Row: {
          date: string
          id: string
          template_counts_json: Json | null
          tenant_id: string
        }
        Insert: {
          date: string
          id?: string
          template_counts_json?: Json | null
          tenant_id: string
        }
        Update: {
          date?: string
          id?: string
          template_counts_json?: Json | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_wa_daily_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_events: {
        Row: {
          id: string
          payload_json: Json
          received_at: string
          tenant_id: string | null
        }
        Insert: {
          id?: string
          payload_json?: Json
          received_at?: string
          tenant_id?: string | null
        }
        Update: {
          id?: string
          payload_json?: Json
          received_at?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_integrations: {
        Row: {
          access_token: string
          created_at: string
          display_phone_number: string | null
          phone_number_id: string
          tenant_id: string
          token_expires_at: string | null
          updated_at: string
          verified_name: string | null
          waba_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          display_phone_number?: string | null
          phone_number_id: string
          tenant_id: string
          token_expires_at?: string | null
          updated_at?: string
          verified_name?: string | null
          waba_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          display_phone_number?: string | null
          phone_number_id?: string
          tenant_id?: string
          token_expires_at?: string | null
          updated_at?: string
          verified_name?: string | null
          waba_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_integrations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_message_statuses: {
        Row: {
          created_at: string
          error_code: number | null
          error_title: string | null
          id: string
          message_id: string
          recipient_id: string | null
          status: string
          tenant_id: string | null
          ts: string
        }
        Insert: {
          created_at?: string
          error_code?: number | null
          error_title?: string | null
          id?: string
          message_id: string
          recipient_id?: string | null
          status: string
          tenant_id?: string | null
          ts: string
        }
        Update: {
          created_at?: string
          error_code?: number | null
          error_title?: string | null
          id?: string
          message_id?: string
          recipient_id?: string | null
          status?: string
          tenant_id?: string | null
          ts?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_message_statuses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          appointment_id: string | null
          contact_id: string | null
          created_at: string
          delivery_status: string | null
          direction: string | null
          id: string
          lead_id: string | null
          message_id: string
          message_type: string | null
          tenant_id: string | null
          text: string | null
          ts: string
          wa_from: string
        }
        Insert: {
          appointment_id?: string | null
          contact_id?: string | null
          created_at?: string
          delivery_status?: string | null
          direction?: string | null
          id?: string
          lead_id?: string | null
          message_id: string
          message_type?: string | null
          tenant_id?: string | null
          text?: string | null
          ts: string
          wa_from: string
        }
        Update: {
          appointment_id?: string | null
          contact_id?: string | null
          created_at?: string
          delivery_status?: string | null
          direction?: string | null
          id?: string
          lead_id?: string | null
          message_id?: string
          message_type?: string | null
          tenant_id?: string | null
          text?: string | null
          ts?: string
          wa_from?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_tenant_appointment_fkey"
            columns: ["tenant_id", "appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "whatsapp_messages_tenant_contact_fkey"
            columns: ["tenant_id", "contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "whatsapp_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          body_text: string
          created_at: string
          id: string
          meta_template_id: string | null
          rejection_reason: string | null
          status: string
          template_name: string
          template_type: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          body_text: string
          created_at?: string
          id?: string
          meta_template_id?: string | null
          rejection_reason?: string | null
          status?: string
          template_name: string
          template_type: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          body_text?: string
          created_at?: string
          id?: string
          meta_template_id?: string | null
          rejection_reason?: string | null
          status?: string
          template_name?: string
          template_type?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_call_queue_batch: {
        Args: { p_limit?: number; p_worker_id?: string }
        Returns: {
          attempt_count: number | null
          callback_source: string | null
          callback_time: string | null
          contact_id: string
          created_at: string
          id: string
          last_attempt_at: string | null
          last_call_sid: string | null
          last_error_code: string | null
          last_voice_outcome: string | null
          last_wa_outcome: string | null
          last_wa_sent_at: string | null
          locked_at: string | null
          max_attempts: number | null
          next_action_channel: string | null
          next_attempt_at: string | null
          notes: string | null
          outcome: string | null
          priority: number | null
          retry_after: string | null
          status: string
          tenant_id: string
          updated_at: string
          wa_available: boolean | null
          worker_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "call_queue"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_reminder_batch: {
        Args: { p_limit?: number; p_worker_id?: string }
        Returns: {
          appointment_id: string | null
          attempts: number
          channel: string
          contact_id: string | null
          created_at: string
          error_message: string | null
          id: string
          last_error_code: string | null
          locked_at: string | null
          payload_json: Json | null
          reminder_type: string
          sent_at: string | null
          status: string
          tenant_id: string
          when_ts: string
          worker_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "reminders"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      expire_knowledge_approvals: { Args: never; Returns: number }
      fix_contacts_without_stage: { Args: never; Returns: number }
      generate_monthly_service_reports: {
        Args: { p_reference_date?: string }
        Returns: number
      }
      get_integration_status: { Args: never; Returns: Json }
      get_user_profile_tenant_id: {
        Args: { _user_id: string }
        Returns: string
      }
      get_user_tenant_id: { Args: { _user_id: string }; Returns: string }
      has_membership_role: {
        Args: {
          _role: Database["public"]["Enums"]["membership_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_call_queue_attempt: {
        Args: { p_queue_id: string; p_tenant_id: string }
        Returns: number
      }
      is_platform_admin: { Args: { _user_id: string }; Returns: boolean }
      lookup_referral_code: { Args: { input_code: string }; Returns: Json }
      record_site_chat_usage: {
        Args: {
          p_estimated_cost_cents?: number
          p_input_tokens: number
          p_output_tokens: number
          p_tenant_id: string
        }
        Returns: undefined
      }
      rotate_site_chatbot_key: {
        Args: { p_chatbot_id: string }
        Returns: string
      }
      set_knowledge_source_governance: {
        Args: {
          p_action: string
          p_checksum?: string
          p_expires_at?: string
          p_note?: string
          p_source_id: string
        }
        Returns: Json
      }
      user_belongs_to_tenant: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      user_has_profile_in_tenant: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      appointment_status:
        | "scheduled"
        | "rescheduled"
        | "canceled"
        | "confirmed"
        | "completed"
        | "no_show"
      call_direction: "inbound" | "outbound"
      contact_source: "facebook_leadads" | "contact_form" | "manual" | "import"
      form_provider: "facebook" | "internal"
      formality_type: "tu" | "lei"
      membership_role: "admin" | "customer"
      message_category: "utility" | "marketing" | "auth" | "service"
      message_status: "sent" | "failed" | "delivered" | "read"
      tone_type: "standard" | "formale" | "amichevole"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      appointment_status: [
        "scheduled",
        "rescheduled",
        "canceled",
        "confirmed",
        "completed",
        "no_show",
      ],
      call_direction: ["inbound", "outbound"],
      contact_source: ["facebook_leadads", "contact_form", "manual", "import"],
      form_provider: ["facebook", "internal"],
      formality_type: ["tu", "lei"],
      membership_role: ["admin", "customer"],
      message_category: ["utility", "marketing", "auth", "service"],
      message_status: ["sent", "failed", "delivered", "read"],
      tone_type: ["standard", "formale", "amichevole"],
    },
  },
} as const
