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
      get_owners: {
        Args: never
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
        }[]
      }
      sync_applicants_for_project: {
        Args: { p_project_id: string }
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
