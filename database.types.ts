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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      applications: {
        Row: {
          architect_signed_at: string | null
          architect_signed_by: string | null
          created_at: string
          department: string
          id: string
          owner_signed_at: string | null
          owner_signed_by: string | null
          permission_type: string
          project_id: string
          project_title: string
          updated_at: string
          workflow_stage: string
        }
        Insert: {
          architect_signed_at?: string | null
          architect_signed_by?: string | null
          created_at?: string
          department: string
          id?: string
          owner_signed_at?: string | null
          owner_signed_by?: string | null
          permission_type: string
          project_id: string
          project_title: string
          updated_at?: string
          workflow_stage?: string
        }
        Update: {
          architect_signed_at?: string | null
          architect_signed_by?: string | null
          created_at?: string
          department?: string
          id?: string
          owner_signed_at?: string | null
          owner_signed_by?: string | null
          permission_type?: string
          project_id?: string
          project_title?: string
          updated_at?: string
          workflow_stage?: string
        }
        Relationships: []
      }
      applicants: {
        Row: {
          applicant_details: Json
          created_at: string
          id: string
          project_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          applicant_details?: Json
          created_at?: string
          id: string
          project_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          applicant_details?: Json
          created_at?: string
          id?: string
          project_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "applicants_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      building_proposal_offices: {
        Row: {
          correspondence_type: string
          id: string
          line1: string
          line2: string
          line3: string
          officer_name: string
          organisation: string
          updated_at: string
        }
        Insert: {
          correspondence_type?: string
          id: string
          line1: string
          line2: string
          line3: string
          officer_name: string
          organisation?: string
          updated_at?: string
        }
        Update: {
          correspondence_type?: string
          id?: string
          line1?: string
          line2?: string
          line3?: string
          officer_name?: string
          organisation?: string
          updated_at?: string
        }
        Relationships: []
      }
      drawing_redlines: {
        Row: {
          author_user_id: string | null
          color: string | null
          created_at: string
          drawing_version_id: string
          geometry: Json
          id: string
          kind: string
          label: string | null
        }
        Insert: {
          author_user_id?: string | null
          color?: string | null
          created_at?: string
          drawing_version_id: string
          geometry?: Json
          id?: string
          kind: string
          label?: string | null
        }
        Update: {
          author_user_id?: string | null
          color?: string | null
          created_at?: string
          drawing_version_id?: string
          geometry?: Json
          id?: string
          kind?: string
          label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drawing_redlines_drawing_version_id_fkey"
            columns: ["drawing_version_id"]
            isOneToOne: false
            referencedRelation: "drawing_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      drawing_remarks: {
        Row: {
          author_name: string
          author_role: string
          author_user_id: string
          body: string
          created_at: string
          drawing_version_id: string
          id: string
          kind: string
        }
        Insert: {
          author_name?: string
          author_role?: string
          author_user_id: string
          body: string
          created_at?: string
          drawing_version_id: string
          id?: string
          kind?: string
        }
        Update: {
          author_name?: string
          author_role?: string
          author_user_id?: string
          body?: string
          created_at?: string
          drawing_version_id?: string
          id?: string
          kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "drawing_remarks_drawing_version_id_fkey"
            columns: ["drawing_version_id"]
            isOneToOne: false
            referencedRelation: "drawing_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      drawing_versions: {
        Row: {
          created_at: string
          file_name: string
          file_size_bytes: number | null
          id: string
          key_changes: Json
          project_id: string
          status: string
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size_bytes?: number | null
          id?: string
          key_changes?: Json
          project_id: string
          status?: string
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size_bytes?: number | null
          id?: string
          key_changes?: Json
          project_id?: string
          status?: string
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drawing_versions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          applicant_details: Json
          application_urls: Json
          architect_user_id: string | null
          area_details: Json
          area_details_json: Json
          bg_details: Json
          building_details: Json
          created_at: string
          fire_consultant_user_id: string | null
          id: string
          owner_html_templates: Json
          plumber_user_id: string | null
          project_info: Json
          project_library: Json
          save_plot_details: Json
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          applicant_details?: Json
          application_urls?: Json
          architect_user_id?: string | null
          area_details?: Json
          area_details_json?: Json
          bg_details?: Json
          building_details?: Json
          created_at?: string
          fire_consultant_user_id?: string | null
          id?: string
          owner_html_templates?: Json
          plumber_user_id?: string | null
          project_info?: Json
          project_library?: Json
          save_plot_details?: Json
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          applicant_details?: Json
          application_urls?: Json
          architect_user_id?: string | null
          area_details?: Json
          area_details_json?: Json
          bg_details?: Json
          building_details?: Json
          created_at?: string
          fire_consultant_user_id?: string | null
          id?: string
          owner_html_templates?: Json
          plumber_user_id?: string | null
          project_info?: Json
          project_library?: Json
          save_plot_details?: Json
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ready_reckoner_rates: {
        Row: {
          address: string
          commercial: number
          created_at: string
          district_id: string
          english_village: string
          id: string
          industrial: number
          marathi_village: string
          office: number
          open_land: number
          rate_unit: string
          residential: number
          survey_no: string
          updated_at: string
        }
        Insert: {
          address?: string
          commercial?: number
          created_at?: string
          district_id?: string
          english_village: string
          id?: string
          industrial?: number
          marathi_village: string
          office?: number
          open_land?: number
          rate_unit?: string
          residential?: number
          survey_no: string
          updated_at?: string
        }
        Update: {
          address?: string
          commercial?: number
          created_at?: string
          district_id?: string
          english_village?: string
          id?: string
          industrial?: number
          marathi_village?: string
          office?: number
          open_land?: number
          rate_unit?: string
          residential?: number
          survey_no?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          application_id: string
          body: string
          created_at: string
          id: string
          link_url: string
          project_id: string | null
          read_at: string | null
          stage: string
          title: string
          user_id: string
        }
        Insert: {
          application_id: string
          body?: string
          created_at?: string
          id?: string
          link_url?: string
          project_id?: string | null
          read_at?: string | null
          stage: string
          title: string
          user_id: string
        }
        Update: {
          application_id?: string
          body?: string
          created_at?: string
          id?: string
          link_url?: string
          project_id?: string | null
          read_at?: string | null
          stage?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      regulation_chat_messages: {
        Row: {
          chat_id: string
          compliance: Json | null
          content: string
          created_at: string
          error: boolean
          filename: string | null
          id: string
          kind: string
          reaction: string | null
          role: string
          sources: Json
        }
        Insert: {
          chat_id: string
          compliance?: Json | null
          content?: string
          created_at?: string
          error?: boolean
          filename?: string | null
          id?: string
          kind?: string
          reaction?: string | null
          role: string
          sources?: Json
        }
        Update: {
          chat_id?: string
          compliance?: Json | null
          content?: string
          created_at?: string
          error?: boolean
          filename?: string | null
          id?: string
          kind?: string
          reaction?: string | null
          role?: string
          sources?: Json
        }
        Relationships: [
          {
            foreignKeyName: "regulation_chat_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "regulation_chats"
            referencedColumns: ["id"]
          },
        ]
      }
      regulation_chats: {
        Row: {
          authorities: string[]
          created_at: string
          document_chars: number | null
          document_filename: string | null
          document_pages: number | null
          document_text: string | null
          id: string
          project_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          authorities?: string[]
          created_at?: string
          document_chars?: number | null
          document_filename?: string | null
          document_pages?: number | null
          document_text?: string | null
          id?: string
          project_id: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          authorities?: string[]
          created_at?: string
          document_chars?: number | null
          document_filename?: string | null
          document_pages?: number | null
          document_text?: string | null
          id?: string
          project_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "regulation_chats_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_logs: {
        Row: {
          created_at: string | null
          id: string
          message: string | null
          sender: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          message?: string | null
          sender?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string | null
          sender?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      user_can_access_project: {
        Args: { p_project_id: string }
        Returns: boolean
      }
      create_project: {
        Args: {
          p_applicant_details?: Json
          p_area_details?: Json
          p_bg_details?: Json
          p_building_details?: Json
          p_project_info?: Json
          p_project_library?: Json
          p_save_plot_details?: Json
          p_status?: string
          p_title: string
          p_user_id: string
        }
        Returns: {
          applicant_details: Json
          application_urls: Json
          architect_user_id: string | null
          area_details: Json
          area_details_json: Json
          bg_details: Json
          building_details: Json
          created_at: string
          fire_consultant_user_id: string | null
          id: string
          owner_html_templates: Json
          plumber_user_id: string | null
          project_info: Json
          project_library: Json
          save_plot_details: Json
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "projects"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_applicants_by_type:
        | {
            Args: { p_type: string }
            Returns: {
              address: string
              contact_number: string
              email: string
              first_name: string
              last_name: string
              license_issue_date: string
              middle_name: string
              pan: string
              registration_number: string
              user_id: string
            }[]
          }
        | {
            Args: { p_entity_type?: string; p_type: string }
            Returns: {
              address: string
              contact_number: string
              email: string
              first_name: string
              last_name: string
              license_issue_date: string
              middle_name: string
              pan: string
              registration_number: string
              user_id: string
            }[]
          }
      get_consultants_by_type: {
        Args: { p_type: string }
        Returns: {
          address: string
          address_line1: string
          address_line2: string
          address_line3: string
          city: string
          contact_number: string
          email: string
          entity_name: string
          first_name: string
          last_name: string
          license_issue_date: string
          middle_name: string
          pan: string
          pincode: string
          registration_number: string
          user_id: string
        }[]
      }
      get_owners: {
        Args: never
        Returns: {
          address: string
          address_line1: string
          address_line2: string
          address_line3: string
          city: string
          contact_number: string
          email: string
          entity_name: string
          first_name: string
          last_name: string
          license_issue_date: string
          middle_name: string
          pan: string
          pincode: string
          registration_number: string
          user_id: string
        }[]
      }
      get_owners_by_entity_type: {
        Args: { p_entity_type: string }
        Returns: {
          address: string
          contact_number: string
          email: string
          first_name: string
          last_name: string
          license_issue_date: string
          middle_name: string
          pan: string
          registration_number: string
          user_id: string
        }[]
      }
      get_user_email_by_user_id: {
        Args: { lookup_user_id: string }
        Returns: {
          consultant_type: string
          email: string
          user_id: string
        }[]
      }
      get_applicant_details_for_project: {
        Args: { p_project_id: string }
        Returns: Json
      }
      get_projects_for_consultant: {
        Args: { p_consultant_id: string }
        Returns: {
          id: string
          title: string
          status: string
          project_info: Json
          save_plot_details: Json
          user_id: string
          architect_user_id: string | null
        }[]
      }
      can_manage_project: {
        Args: { p_project_id: string }
        Returns: boolean
      }
      user_can_manage_project: {
        Args: { p_project_id: string; p_user_id: string }
        Returns: boolean
      }
      create_project_by_architect: {
        Args: {
          p_owner_user_id: string
          p_title: string
          p_status?: string
          p_project_info?: Json
          p_save_plot_details?: Json
          p_applicant_details?: Json
          p_building_details?: Json
          p_area_details?: Json
          p_project_library?: Json
          p_bg_details?: Json
        }
        Returns: Json
      }
      sync_applicants_for_project: {
        Args: { p_project_id: string }
        Returns: undefined
      }
      replace_applicants_for_project: {
        Args: { p_project_id: string; p_roster: Json }
        Returns: undefined
      }
      get_projects_for_owner: {
        Args: { p_owner_id: string }
        Returns: {
          id: string
          title: string
          status: string
          project_info: Json
          save_plot_details: Json
        }[]
      }
      get_applications_for_owner: {
        Args: {
          p_owner_id: string
          p_department: string
          p_project_ids?: string[]
        }
        Returns: {
          id: string
          project_id: string
          project_title: string
          permission_type: string
          created_at: string
          workflow_stage: string
          owner_signed_at: string | null
          architect_signed_at: string | null
        }[]
      }
      get_application_for_owner: {
        Args: { p_application_id: string; p_owner_id: string }
        Returns: {
          id: string
          project_id: string
          permission_type: string
          department: string
          created_at: string
          workflow_stage: string
          owner_signed_at: string | null
          architect_signed_at: string | null
        }[]
      }
      get_application_for_signing: {
        Args: { p_application_id: string }
        Returns: {
          id: string
          project_id: string
          permission_type: string
          department: string
          created_at: string
          workflow_stage: string
          owner_signed_at: string | null
          architect_signed_at: string | null
        }[]
      }
      update_application_for_signing: {
        Args: {
          p_application_id: string
          p_signer_id: string
          p_workflow_stage?: string
          p_owner_signed_at?: string
          p_owner_signed_by?: string
          p_architect_signed_at?: string
          p_architect_signed_by?: string
        }
        Returns: boolean
      }
      delete_application_for_owner: {
        Args: { p_application_id: string; p_owner_id: string }
        Returns: {
          project_id: string
          permission_type: string
        }[]
      }
      update_application_for_owner: {
        Args: {
          p_application_id: string
          p_owner_id: string
          p_workflow_stage?: string
          p_owner_signed_at?: string
          p_owner_signed_by?: string
          p_architect_signed_at?: string
          p_architect_signed_by?: string
        }
        Returns: boolean
      }
      create_application_for_owner: {
        Args: {
          p_owner_id: string
          p_project_id: string
          p_project_title: string
          p_department: string
          p_permission_type: string
          p_workflow_stage?: string
        }
        Returns: string
      }
      get_project_for_preview: {
        Args: { p_project_id: string }
        Returns: Json
      }
      get_project_by_id_for_owner: {
        Args: { p_project_id: string }
        Returns: Json
      }
      get_project_by_id_for_consultant: {
        Args: { p_project_id: string }
        Returns: Json
      }
      get_applications_for_consultant: {
        Args: {
          p_consultant_id: string
          p_department: string
          p_project_ids?: string[]
        }
        Returns: {
          id: string
          project_id: string
          project_title: string
          permission_type: string
          created_at: string
          workflow_stage: string
          owner_signed_at: string | null
          architect_signed_at: string | null
        }[]
      }
      update_auth_user_role: {
        Args: { new_role: string; user_uuid: string }
        Returns: undefined
      }
      update_user_metadata_and_role: {
        Args: {
          app_metadata?: Json
          new_role: string
          user_metadata?: Json
          user_uuid: string
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
