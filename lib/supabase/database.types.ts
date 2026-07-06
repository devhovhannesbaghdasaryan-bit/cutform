export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
          reason: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
          reason?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
          reason?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      admin_permissions: {
        Row: {
          created_at: string
          permission: string
          user_id: string
        }
        Insert: {
          created_at?: string
          permission: string
          user_id: string
        }
        Update: {
          created_at?: string
          permission?: string
          user_id?: string
        }
        Relationships: []
      }
      banner_manufacturing_instructions: {
        Row: {
          created_at: string
          created_by: string | null
          drawing_paths: string[]
          generated_item_id: string | null
          id: string
          instructions: Json
          order_id: string | null
          order_item_id: string | null
          source_image_path: string
          status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          drawing_paths?: string[]
          generated_item_id?: string | null
          id?: string
          instructions: Json
          order_id?: string | null
          order_item_id?: string | null
          source_image_path: string
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          drawing_paths?: string[]
          generated_item_id?: string | null
          id?: string
          instructions?: Json
          order_id?: string | null
          order_item_id?: string | null
          source_image_path?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "banner_manufacturing_instructions_generated_item_id_fkey"
            columns: ["generated_item_id"]
            isOneToOne: false
            referencedRelation: "generated_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banner_manufacturing_instructions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banner_manufacturing_instructions_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      banner_samples: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          image_path: string
          material_assumptions: string | null
          production_notes: string | null
          prompt: string | null
          reference_paths: string[]
          size_preset_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_path: string
          material_assumptions?: string | null
          production_notes?: string | null
          prompt?: string | null
          reference_paths?: string[]
          size_preset_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_path?: string
          material_assumptions?: string | null
          production_notes?: string | null
          prompt?: string | null
          reference_paths?: string[]
          size_preset_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "banner_samples_size_preset_id_fkey"
            columns: ["size_preset_id"]
            isOneToOne: false
            referencedRelation: "banner_size_presets"
            referencedColumns: ["id"]
          },
        ]
      }
      banner_size_presets: {
        Row: {
          created_at: string
          finish: string | null
          height_mm: number
          id: string
          is_active: boolean
          key: string
          material: string | null
          name: string
          sort_order: number
          width_mm: number
        }
        Insert: {
          created_at?: string
          finish?: string | null
          height_mm: number
          id?: string
          is_active?: boolean
          key: string
          material?: string | null
          name: string
          sort_order?: number
          width_mm: number
        }
        Update: {
          created_at?: string
          finish?: string | null
          height_mm?: number
          id?: string
          is_active?: boolean
          key?: string
          material?: string | null
          name?: string
          sort_order?: number
          width_mm?: number
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          banner_sample_id: string | null
          cart_id: string
          catalog_item_id: string | null
          configuration: Json
          created_at: string
          currency: string
          generated_item_id: string | null
          id: string
          quantity: number
          title: string
          unit_price_cents: number
          updated_at: string
        }
        Insert: {
          banner_sample_id?: string | null
          cart_id: string
          catalog_item_id?: string | null
          configuration?: Json
          created_at?: string
          currency?: string
          generated_item_id?: string | null
          id?: string
          quantity?: number
          title: string
          unit_price_cents: number
          updated_at?: string
        }
        Update: {
          banner_sample_id?: string | null
          cart_id?: string
          catalog_item_id?: string | null
          configuration?: Json
          created_at?: string
          currency?: string
          generated_item_id?: string | null
          id?: string
          quantity?: number
          title?: string
          unit_price_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_banner_sample_id_fkey"
            columns: ["banner_sample_id"]
            isOneToOne: false
            referencedRelation: "banner_samples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "cart_items_generated_item_id_fkey"
            columns: ["generated_item_id"]
            isOneToOne: false
            referencedRelation: "generated_items"
            referencedColumns: ["id"]
          },
        ]
      }
      carts: {
        Row: {
          created_at: string
          currency: string
          destination_country_code: string | null
          exchange_rate_context: Json
          id: string
          session_id: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          currency?: string
          destination_country_code?: string | null
          exchange_rate_context?: Json
          id?: string
          session_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          destination_country_code?: string | null
          exchange_rate_context?: Json
          id?: string
          session_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "carts_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "carts_destination_country_code_fkey"
            columns: ["destination_country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
        ]
      }
      catalog_item_market_rules: {
        Row: {
          catalog_item_id: string
          country_code: string | null
          created_at: string
          id: string
          region_id: string | null
          shipping_currency: string
          shipping_rate_cents: number | null
          updated_at: string
          visibility_override: boolean | null
        }
        Insert: {
          catalog_item_id: string
          country_code?: string | null
          created_at?: string
          id?: string
          region_id?: string | null
          shipping_currency?: string
          shipping_rate_cents?: number | null
          updated_at?: string
          visibility_override?: boolean | null
        }
        Update: {
          catalog_item_id?: string
          country_code?: string | null
          created_at?: string
          id?: string
          region_id?: string | null
          shipping_currency?: string
          shipping_rate_cents?: number | null
          updated_at?: string
          visibility_override?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "catalog_item_market_rules_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_item_market_rules_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "catalog_item_market_rules_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "market_regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_item_market_rules_shipping_currency_fkey"
            columns: ["shipping_currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      catalog_item_media: {
        Row: {
          alt_text: string | null
          catalog_item_id: string
          created_at: string
          created_by: string | null
          id: string
          is_primary: boolean
          media_type: string
          metadata: Json
          poster_path: string | null
          sort_order: number
          storage_path: string
          updated_at: string
        }
        Insert: {
          alt_text?: string | null
          catalog_item_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_primary?: boolean
          media_type: string
          metadata?: Json
          poster_path?: string | null
          sort_order?: number
          storage_path: string
          updated_at?: string
        }
        Update: {
          alt_text?: string | null
          catalog_item_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_primary?: boolean
          media_type?: string
          metadata?: Json
          poster_path?: string | null
          sort_order?: number
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_item_media_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_item_seo_metadata: {
        Row: {
          catalog_item_id: string
          created_at: string
          generated_by_ai: boolean
          keywords: string[]
          locale: string
          noindex: boolean
          og_description: string | null
          og_title: string | null
          reviewed_by_admin: boolean
          seo_description: string | null
          seo_slug: string | null
          seo_title: string | null
          social_image_path: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          catalog_item_id: string
          created_at?: string
          generated_by_ai?: boolean
          keywords?: string[]
          locale: string
          noindex?: boolean
          og_description?: string | null
          og_title?: string | null
          reviewed_by_admin?: boolean
          seo_description?: string | null
          seo_slug?: string | null
          seo_title?: string | null
          social_image_path?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          catalog_item_id?: string
          created_at?: string
          generated_by_ai?: boolean
          keywords?: string[]
          locale?: string
          noindex?: boolean
          og_description?: string | null
          og_title?: string | null
          reviewed_by_admin?: boolean
          seo_description?: string | null
          seo_slug?: string | null
          seo_title?: string | null
          social_image_path?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catalog_item_seo_metadata_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_item_translations: {
        Row: {
          catalog_item_id: string
          created_at: string
          description: string | null
          locale: string
          title: string
          updated_at: string
        }
        Insert: {
          catalog_item_id: string
          created_at?: string
          description?: string | null
          locale: string
          title: string
          updated_at?: string
        }
        Update: {
          catalog_item_id?: string
          created_at?: string
          description?: string | null
          locale?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_item_translations_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_items: {
        Row: {
          category_id: string
          characteristics: string | null
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          gallery_paths: string[]
          id: string
          is_customizable: boolean
          is_popular: boolean
          item_type: string
          manufacturing_notes: string | null
          price_cents: number
          product_source: string
          sizes: Json
          slug: string
          status: string
          subcategory_id: string | null
          thumbnail_path: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category_id: string
          characteristics?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          gallery_paths?: string[]
          id?: string
          is_customizable?: boolean
          is_popular?: boolean
          item_type?: string
          manufacturing_notes?: string | null
          price_cents: number
          product_source?: string
          sizes?: Json
          slug: string
          status?: string
          subcategory_id?: string | null
          thumbnail_path?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          characteristics?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          gallery_paths?: string[]
          id?: string
          is_customizable?: boolean
          is_popular?: boolean
          item_type?: string
          manufacturing_notes?: string | null
          price_cents?: number
          product_source?: string
          sizes?: Json
          slug?: string
          status?: string
          subcategory_id?: string | null
          thumbnail_path?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_items_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          description: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      countries: {
        Row: {
          code: string
          created_at: string
          default_currency_code: string | null
          is_active: boolean
          name: string
          region_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          default_currency_code?: string | null
          is_active?: boolean
          name: string
          region_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          default_currency_code?: string | null
          is_active?: boolean
          name?: string
          region_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "countries_default_currency_code_fkey"
            columns: ["default_currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "countries_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "market_regions"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_accounts: {
        Row: {
          balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      credit_ledger: {
        Row: {
          created_at: string
          delta: number
          id: string
          reason: string
          reference_id: string | null
          reference_type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          reason: string
          reference_id?: string | null
          reference_type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          reason?: string
          reference_id?: string | null
          reference_type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      currencies: {
        Row: {
          code: string
          created_at: string
          is_default: boolean
          is_enabled: boolean
          name: string
          payment_route: string
          sort_order: number
          symbol: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          is_default?: boolean
          is_enabled?: boolean
          name: string
          payment_route: string
          sort_order?: number
          symbol: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          is_default?: boolean
          is_enabled?: boolean
          name?: string
          payment_route?: string
          sort_order?: number
          symbol?: string
          updated_at?: string
        }
        Relationships: []
      }
      exchange_rates: {
        Row: {
          base_currency: string
          created_at: string
          fetched_at: string
          id: string
          is_stale: boolean
          metadata: Json
          provider: string
          rate: number
          rate_date: string
          target_currency: string
        }
        Insert: {
          base_currency: string
          created_at?: string
          fetched_at?: string
          id?: string
          is_stale?: boolean
          metadata?: Json
          provider: string
          rate: number
          rate_date: string
          target_currency: string
        }
        Update: {
          base_currency?: string
          created_at?: string
          fetched_at?: string
          id?: string
          is_stale?: boolean
          metadata?: Json
          provider?: string
          rate?: number
          rate_date?: string
          target_currency?: string
        }
        Relationships: [
          {
            foreignKeyName: "exchange_rates_base_currency_fkey"
            columns: ["base_currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "exchange_rates_target_currency_fkey"
            columns: ["target_currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      generated_item_artifacts: {
        Row: {
          artifact_type: string
          content_text: string | null
          created_at: string
          generated_item_id: string
          id: string
          metadata: Json
          storage_path: string | null
        }
        Insert: {
          artifact_type: string
          content_text?: string | null
          created_at?: string
          generated_item_id: string
          id?: string
          metadata?: Json
          storage_path?: string | null
        }
        Update: {
          artifact_type?: string
          content_text?: string | null
          created_at?: string
          generated_item_id?: string
          id?: string
          metadata?: Json
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generated_item_artifacts_generated_item_id_fkey"
            columns: ["generated_item_id"]
            isOneToOne: false
            referencedRelation: "generated_items"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_items: {
        Row: {
          category_id: string | null
          color: string | null
          created_at: string
          credit_cost: number
          custom_text: string | null
          generated_by: string | null
          generation_options: Json
          id: string
          manufacturing_file_path: string | null
          manufacturing_metadata: Json
          multi_color: boolean
          original_image_paths: string[]
          preview_path: string | null
          product_type: string
          prompt: string | null
          review_status: string
          selected_preview_path: string | null
          source_image_path: string | null
          subcategory_id: string | null
          svg_content: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id?: string | null
          color?: string | null
          created_at?: string
          credit_cost?: number
          custom_text?: string | null
          generated_by?: string | null
          generation_options?: Json
          id?: string
          manufacturing_file_path?: string | null
          manufacturing_metadata?: Json
          multi_color?: boolean
          original_image_paths?: string[]
          preview_path?: string | null
          product_type: string
          prompt?: string | null
          review_status?: string
          selected_preview_path?: string | null
          source_image_path?: string | null
          subcategory_id?: string | null
          svg_content: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string | null
          color?: string | null
          created_at?: string
          credit_cost?: number
          custom_text?: string | null
          generated_by?: string | null
          generation_options?: Json
          id?: string
          manufacturing_file_path?: string | null
          manufacturing_metadata?: Json
          multi_color?: boolean
          original_image_paths?: string[]
          preview_path?: string | null
          product_type?: string
          prompt?: string | null
          review_status?: string
          selected_preview_path?: string | null
          source_image_path?: string | null
          subcategory_id?: string | null
          svg_content?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_items_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_sessions: {
        Row: {
          id: string
          image_path: string
          input_units: number
          last_svg: string | null
          last_title: string | null
          output_units: number
          updated_at: string
          upload_rights_confirmed: boolean
          user_id: string
        }
        Insert: {
          id?: string
          image_path: string
          input_units?: number
          last_svg?: string | null
          last_title?: string | null
          output_units?: number
          updated_at?: string
          upload_rights_confirmed?: boolean
          user_id: string
        }
        Update: {
          id?: string
          image_path?: string
          input_units?: number
          last_svg?: string | null
          last_title?: string | null
          output_units?: number
          updated_at?: string
          upload_rights_confirmed?: boolean
          user_id?: string
        }
        Relationships: []
      }
      market_regions: {
        Row: {
          created_at: string
          default_currency_code: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_currency_code?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_currency_code?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_regions_default_currency_code_fkey"
            columns: ["default_currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      order_items: {
        Row: {
          banner_size_key: string | null
          catalog_item_id: string | null
          currency: string
          custom_text: string | null
          exchange_rate_context: Json
          generated_item_id: string | null
          id: string
          image_path: string | null
          item_snapshot: Json
          led_color: string | null
          manufacturing_file_path: string | null
          multi_color: boolean
          order_id: string
          original_image_paths: string[]
          personalization_snapshot: Json
          production_snapshot: Json
          quantity: number
          selected_preview_path: string | null
          shipping_rate_context: Json
          shipping_total_cents: number
          shipping_unit_cents: number
          title: string
          total_price_cents: number
          unit_price_cents: number
        }
        Insert: {
          banner_size_key?: string | null
          catalog_item_id?: string | null
          currency?: string
          custom_text?: string | null
          exchange_rate_context?: Json
          generated_item_id?: string | null
          id?: string
          image_path?: string | null
          item_snapshot?: Json
          led_color?: string | null
          manufacturing_file_path?: string | null
          multi_color?: boolean
          order_id: string
          original_image_paths?: string[]
          personalization_snapshot?: Json
          production_snapshot?: Json
          quantity?: number
          selected_preview_path?: string | null
          shipping_rate_context?: Json
          shipping_total_cents?: number
          shipping_unit_cents?: number
          title: string
          total_price_cents: number
          unit_price_cents: number
        }
        Update: {
          banner_size_key?: string | null
          catalog_item_id?: string | null
          currency?: string
          custom_text?: string | null
          exchange_rate_context?: Json
          generated_item_id?: string | null
          id?: string
          image_path?: string | null
          item_snapshot?: Json
          led_color?: string | null
          manufacturing_file_path?: string | null
          multi_color?: boolean
          order_id?: string
          original_image_paths?: string[]
          personalization_snapshot?: Json
          production_snapshot?: Json
          quantity?: number
          selected_preview_path?: string | null
          shipping_rate_context?: Json
          shipping_total_cents?: number
          shipping_unit_cents?: number
          title?: string
          total_price_cents?: number
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "order_items_generated_item_id_fkey"
            columns: ["generated_item_id"]
            isOneToOne: false
            referencedRelation: "generated_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          cart_id: string | null
          contact_email: string | null
          created_at: string
          currency: string
          destination_country_code: string | null
          exchange_rate_context: Json
          id: string
          locale: string | null
          payment_provider_route: string | null
          payment_status: string
          shipping_address: Json | null
          shipping_cents: number
          shipping_rate_context: Json
          status: string
          subtotal_cents: number
          total_cents: number
          transaction_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cart_id?: string | null
          contact_email?: string | null
          created_at?: string
          currency?: string
          destination_country_code?: string | null
          exchange_rate_context?: Json
          id?: string
          locale?: string | null
          payment_provider_route?: string | null
          payment_status?: string
          shipping_address?: Json | null
          shipping_cents?: number
          shipping_rate_context?: Json
          status?: string
          subtotal_cents: number
          total_cents: number
          transaction_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cart_id?: string | null
          contact_email?: string | null
          created_at?: string
          currency?: string
          destination_country_code?: string | null
          exchange_rate_context?: Json
          id?: string
          locale?: string | null
          payment_provider_route?: string | null
          payment_status?: string
          shipping_address?: Json | null
          shipping_cents?: number
          shipping_rate_context?: Json
          status?: string
          subtotal_cents?: number
          total_cents?: number
          transaction_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "orders_destination_country_code_fkey"
            columns: ["destination_country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
        ]
      }
      personalization_boilerplates: {
        Row: {
          admin_name: string
          created_at: string
          generate_hidden_svg: boolean
          generation_instruction: string
          id: string
          image_path: string
          is_active: boolean
          manufacturing_process: string
          model_id: string
          name_en: string | null
          name_hy: string | null
          name_ru: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          admin_name: string
          created_at?: string
          generate_hidden_svg?: boolean
          generation_instruction?: string
          id?: string
          image_path: string
          is_active?: boolean
          manufacturing_process?: string
          model_id: string
          name_en?: string | null
          name_hy?: string | null
          name_ru?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          admin_name?: string
          created_at?: string
          generate_hidden_svg?: boolean
          generation_instruction?: string
          id?: string
          image_path?: string
          is_active?: boolean
          manufacturing_process?: string
          model_id?: string
          name_en?: string | null
          name_hy?: string | null
          name_ru?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "personalization_boilerplates_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "personalization_models"
            referencedColumns: ["id"]
          },
        ]
      }
      personalization_models: {
        Row: {
          boilerplate_image_path: string | null
          category_id: string
          created_at: string
          form_schema: Json
          id: string
          mock_image_path: string | null
          slug: string
          sort_order: number
          status: string
          subcategory_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          boilerplate_image_path?: string | null
          category_id: string
          created_at?: string
          form_schema?: Json
          id?: string
          mock_image_path?: string | null
          slug: string
          sort_order?: number
          status?: string
          subcategory_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          boilerplate_image_path?: string | null
          category_id?: string
          created_at?: string
          form_schema?: Json
          id?: string
          mock_image_path?: string | null
          slug?: string
          sort_order?: number
          status?: string
          subcategory_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "personalization_models_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personalization_models_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      personalized_preview_options: {
        Row: {
          boilerplate_id: string | null
          created_at: string
          generated_item_id: string
          id: string
          manufacturing_file_path: string | null
          metadata: Json
          option_index: number
          preview_image_path: string
          status: string
          updated_at: string
        }
        Insert: {
          boilerplate_id?: string | null
          created_at?: string
          generated_item_id: string
          id?: string
          manufacturing_file_path?: string | null
          metadata?: Json
          option_index: number
          preview_image_path: string
          status?: string
          updated_at?: string
        }
        Update: {
          boilerplate_id?: string | null
          created_at?: string
          generated_item_id?: string
          id?: string
          manufacturing_file_path?: string | null
          metadata?: Json
          option_index?: number
          preview_image_path?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "personalized_preview_options_boilerplate_id_fkey"
            columns: ["boilerplate_id"]
            isOneToOne: false
            referencedRelation: "personalization_boilerplates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personalized_preview_options_generated_item_id_fkey"
            columns: ["generated_item_id"]
            isOneToOne: false
            referencedRelation: "generated_items"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          api_cost_cents: number
          created_at: string
          id: string
          input_units: number
          markup_cents: number
          output_units: number
          price_cents: number
          svg_content: string
          title: string
          user_id: string
        }
        Insert: {
          api_cost_cents?: number
          created_at?: string
          id?: string
          input_units?: number
          markup_cents?: number
          output_units?: number
          price_cents?: number
          svg_content: string
          title: string
          user_id: string
        }
        Update: {
          api_cost_cents?: number
          created_at?: string
          id?: string
          input_units?: number
          markup_cents?: number
          output_units?: number
          price_cents?: number
          svg_content?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          internal_notes: string | null
          preferred_country_code: string | null
          preferred_currency: string | null
          preferred_locale: string | null
          region_code: string | null
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          internal_notes?: string | null
          preferred_country_code?: string | null
          preferred_currency?: string | null
          preferred_locale?: string | null
          region_code?: string | null
          role?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          internal_notes?: string | null
          preferred_country_code?: string | null
          preferred_currency?: string | null
          preferred_locale?: string | null
          region_code?: string | null
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_preferred_country_code_fkey"
            columns: ["preferred_country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "profiles_preferred_currency_fkey"
            columns: ["preferred_currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      subcategories: {
        Row: {
          category_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          admin_reason: string | null
          amount_cents: number
          created_at: string
          created_by: string | null
          credit_ledger_id: string | null
          currency: string
          exchange_rate_context: Json
          id: string
          metadata: Json
          order_id: string | null
          payment_provider_route: string | null
          provider: string | null
          provider_reference: string | null
          status: string
          type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_reason?: string | null
          amount_cents?: number
          created_at?: string
          created_by?: string | null
          credit_ledger_id?: string | null
          currency?: string
          exchange_rate_context?: Json
          id?: string
          metadata?: Json
          order_id?: string | null
          payment_provider_route?: string | null
          provider?: string | null
          provider_reference?: string | null
          status?: string
          type: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_reason?: string | null
          amount_cents?: number
          created_at?: string
          created_by?: string | null
          credit_ledger_id?: string | null
          currency?: string
          exchange_rate_context?: Json
          id?: string
          metadata?: Json
          order_id?: string | null
          payment_provider_route?: string | null
          provider?: string | null
          provider_reference?: string | null
          status?: string
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_credit_ledger_id_fkey"
            columns: ["credit_ledger_id"]
            isOneToOne: false
            referencedRelation: "credit_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      next_ameria_order_id: { Args: never; Returns: number }
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

