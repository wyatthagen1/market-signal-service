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
  accounting: {
    Tables: {
      sleeve_ledger: {
        Row: {
          balance_after_centicents: number | null
          balance_after_cents: number
          client_order_id: string | null
          created_at: string
          delta_centicents: number | null
          delta_cents: number
          event_type: Database["accounting"]["Enums"]["sleeve_event_type"]
          id: number
          market_ticker: string | null
          policy_id: number | null
          sleeve_id: number
          trade_id: string | null
          transfer_id: string | null
        }
        Insert: {
          balance_after_centicents?: number | null
          balance_after_cents: number
          client_order_id?: string | null
          created_at?: string
          delta_centicents?: number | null
          delta_cents: number
          event_type: Database["accounting"]["Enums"]["sleeve_event_type"]
          id?: number
          market_ticker?: string | null
          policy_id?: number | null
          sleeve_id: number
          trade_id?: string | null
          transfer_id?: string | null
        }
        Update: {
          balance_after_centicents?: number | null
          balance_after_cents?: number
          client_order_id?: string | null
          created_at?: string
          delta_centicents?: number | null
          delta_cents?: number
          event_type?: Database["accounting"]["Enums"]["sleeve_event_type"]
          id?: number
          market_ticker?: string | null
          policy_id?: number | null
          sleeve_id?: number
          trade_id?: string | null
          transfer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sleeve_ledger_sleeve_id_fkey"
            columns: ["sleeve_id"]
            isOneToOne: false
            referencedRelation: "sleeve_state"
            referencedColumns: ["sleeve_id"]
          },
          {
            foreignKeyName: "sleeve_ledger_sleeve_id_fkey"
            columns: ["sleeve_id"]
            isOneToOne: false
            referencedRelation: "sleeves"
            referencedColumns: ["id"]
          },
        ]
      }
      sleeves: {
        Row: {
          created_at: string
          execution_module_id: number | null
          id: number
          log_markets: boolean
          mode: Database["accounting"]["Enums"]["sleeve_mode"]
          name: string
          status: Database["accounting"]["Enums"]["sleeve_status"]
          url: string | null
        }
        Insert: {
          created_at?: string
          execution_module_id?: number | null
          id?: never
          log_markets?: boolean
          mode: Database["accounting"]["Enums"]["sleeve_mode"]
          name: string
          status?: Database["accounting"]["Enums"]["sleeve_status"]
          url?: string | null
        }
        Update: {
          created_at?: string
          execution_module_id?: number | null
          id?: never
          log_markets?: boolean
          mode?: Database["accounting"]["Enums"]["sleeve_mode"]
          name?: string
          status?: Database["accounting"]["Enums"]["sleeve_status"]
          url?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      sleeve_state: {
        Row: {
          balance_centicents: number | null
          balance_cents: number | null
          execution_module_id: number | null
          last_event_at: string | null
          log_markets: boolean | null
          markets_traded: string[] | null
          mode: Database["accounting"]["Enums"]["sleeve_mode"] | null
          num_events: number | null
          policy_ids: number[] | null
          sleeve_id: number | null
          sleeve_name: string | null
          status: Database["accounting"]["Enums"]["sleeve_status"] | null
          url: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      sleeve_event_type: "grant" | "fill" | "settlement" | "debit" | "netting"
      sleeve_mode: "mock" | "live" | "treasury"
      sleeve_status: "active" | "inactive" | "retired"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  kalshi_state: {
    Tables: {
      events: {
        Row: {
          available_on_brokers: boolean | null
          category: string
          collateral_return_type: string | null
          created_at: string
          event_ticker: string
          mutually_exclusive: boolean | null
          product_metadata: Json | null
          series_ticker: string
          strike_date: string | null
          strike_period: string | null
          sub_title: string | null
          title: string
          updated_at: string
        }
        Insert: {
          available_on_brokers?: boolean | null
          category: string
          collateral_return_type?: string | null
          created_at?: string
          event_ticker: string
          mutually_exclusive?: boolean | null
          product_metadata?: Json | null
          series_ticker: string
          strike_date?: string | null
          strike_period?: string | null
          sub_title?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          available_on_brokers?: boolean | null
          category?: string
          collateral_return_type?: string | null
          created_at?: string
          event_ticker?: string
          mutually_exclusive?: boolean | null
          product_metadata?: Json | null
          series_ticker?: string
          strike_date?: string | null
          strike_period?: string | null
          sub_title?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_series_ticker_fkey"
            columns: ["series_ticker"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["ticker"]
          },
        ]
      }
      markets: {
        Row: {
          can_close_early: boolean | null
          cap_strike: number | null
          category: string
          close_time: string
          created_time: string
          custom_strike: Json | null
          early_close_condition: string | null
          event_ticker: string
          expected_expiration_time: string | null
          expiration_time: string | null
          expiration_value: string | null
          floor_strike: number | null
          functional_strike: string | null
          latest_expiration_time: string | null
          liquidity_at_last_update: number | null
          market_type: string
          mve_collection_ticker: string | null
          mve_selected_legs: Json | null
          no_sub_title: string | null
          open_interest_at_last_update: number | null
          open_time: string
          price_level_structure: string | null
          price_ranges: Json | null
          primary_participant_key: string | null
          response_price_units: string | null
          result: string | null
          risk_limit_cents: number | null
          rules_primary: string | null
          rules_secondary: string | null
          settlement_timer_seconds: number | null
          settlement_ts: string | null
          status: string
          strike_type: string | null
          subtitle: string | null
          tick_size: number | null
          ticker: string
          title: string
          updated_at: string
          volume_24h_at_last_update: number | null
          volume_at_last_update: number | null
          yes_ask: number | null
          yes_bid: number | null
          yes_sub_title: string | null
        }
        Insert: {
          can_close_early?: boolean | null
          cap_strike?: number | null
          category?: string
          close_time: string
          created_time: string
          custom_strike?: Json | null
          early_close_condition?: string | null
          event_ticker: string
          expected_expiration_time?: string | null
          expiration_time?: string | null
          expiration_value?: string | null
          floor_strike?: number | null
          functional_strike?: string | null
          latest_expiration_time?: string | null
          liquidity_at_last_update?: number | null
          market_type: string
          mve_collection_ticker?: string | null
          mve_selected_legs?: Json | null
          no_sub_title?: string | null
          open_interest_at_last_update?: number | null
          open_time: string
          price_level_structure?: string | null
          price_ranges?: Json | null
          primary_participant_key?: string | null
          response_price_units?: string | null
          result?: string | null
          risk_limit_cents?: number | null
          rules_primary?: string | null
          rules_secondary?: string | null
          settlement_timer_seconds?: number | null
          settlement_ts?: string | null
          status: string
          strike_type?: string | null
          subtitle?: string | null
          tick_size?: number | null
          ticker: string
          title: string
          updated_at?: string
          volume_24h_at_last_update?: number | null
          volume_at_last_update?: number | null
          yes_ask?: number | null
          yes_bid?: number | null
          yes_sub_title?: string | null
        }
        Update: {
          can_close_early?: boolean | null
          cap_strike?: number | null
          category?: string
          close_time?: string
          created_time?: string
          custom_strike?: Json | null
          early_close_condition?: string | null
          event_ticker?: string
          expected_expiration_time?: string | null
          expiration_time?: string | null
          expiration_value?: string | null
          floor_strike?: number | null
          functional_strike?: string | null
          latest_expiration_time?: string | null
          liquidity_at_last_update?: number | null
          market_type?: string
          mve_collection_ticker?: string | null
          mve_selected_legs?: Json | null
          no_sub_title?: string | null
          open_interest_at_last_update?: number | null
          open_time?: string
          price_level_structure?: string | null
          price_ranges?: Json | null
          primary_participant_key?: string | null
          response_price_units?: string | null
          result?: string | null
          risk_limit_cents?: number | null
          rules_primary?: string | null
          rules_secondary?: string | null
          settlement_timer_seconds?: number | null
          settlement_ts?: string | null
          status?: string
          strike_type?: string | null
          subtitle?: string | null
          tick_size?: number | null
          ticker?: string
          title?: string
          updated_at?: string
          volume_24h_at_last_update?: number | null
          volume_at_last_update?: number | null
          yes_ask?: number | null
          yes_bid?: number | null
          yes_sub_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "markets_event_ticker_fkey"
            columns: ["event_ticker"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["event_ticker"]
          },
        ]
      }
      policy_markets: {
        Row: {
          id: number
          is_active: boolean
          market_ticker: string
          policy_id: number
          subscribed_at: string
          sync_status: number | null
          synced_at: string | null
          unsubscribed_at: string | null
          updated_at: string
        }
        Insert: {
          id?: number
          is_active?: boolean
          market_ticker: string
          policy_id: number
          subscribed_at?: string
          sync_status?: number | null
          synced_at?: string | null
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Update: {
          id?: number
          is_active?: boolean
          market_ticker?: string
          policy_id?: number
          subscribed_at?: string
          sync_status?: number | null
          synced_at?: string | null
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_markets_market_ticker_fkey"
            columns: ["market_ticker"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["ticker"]
          },
        ]
      }
      scraper_logs: {
        Row: {
          completed_at: string
          created_at: string
          duration_ms: number
          error_message: string | null
          id: number
          metadata: Json | null
          process: string
          records_failed: number | null
          records_fetched: number | null
          records_inserted: number | null
          records_updated: number | null
          started_at: string
          status: string
        }
        Insert: {
          completed_at: string
          created_at?: string
          duration_ms: number
          error_message?: string | null
          id?: number
          metadata?: Json | null
          process: string
          records_failed?: number | null
          records_fetched?: number | null
          records_inserted?: number | null
          records_updated?: number | null
          started_at: string
          status: string
        }
        Update: {
          completed_at?: string
          created_at?: string
          duration_ms?: number
          error_message?: string | null
          id?: number
          metadata?: Json | null
          process?: string
          records_failed?: number | null
          records_fetched?: number | null
          records_inserted?: number | null
          records_updated?: number | null
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      series: {
        Row: {
          additional_prohibitions: Json | null
          category: string
          contract_terms_url: string | null
          contract_url: string | null
          fee_multiplier: number | null
          fee_type: string | null
          first_seen: string
          frequency: string | null
          last_updated: string
          last_updated_ts: string | null
          settlement_sources: Json | null
          tags: Json | null
          ticker: string
          title: string
        }
        Insert: {
          additional_prohibitions?: Json | null
          category: string
          contract_terms_url?: string | null
          contract_url?: string | null
          fee_multiplier?: number | null
          fee_type?: string | null
          first_seen?: string
          frequency?: string | null
          last_updated?: string
          last_updated_ts?: string | null
          settlement_sources?: Json | null
          tags?: Json | null
          ticker: string
          title: string
        }
        Update: {
          additional_prohibitions?: Json | null
          category?: string
          contract_terms_url?: string | null
          contract_url?: string | null
          fee_multiplier?: number | null
          fee_type?: string | null
          first_seen?: string
          frequency?: string | null
          last_updated?: string
          last_updated_ts?: string | null
          settlement_sources?: Json | null
          tags?: Json | null
          ticker?: string
          title?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      events: {
        Row: {
          available_on_brokers: boolean | null
          category: string
          collateral_return_type: string | null
          created_at: string
          event_ticker: string
          mutually_exclusive: boolean | null
          product_metadata: Json | null
          series_ticker: string
          strike_date: string | null
          strike_period: string | null
          sub_title: string | null
          title: string
          updated_at: string
        }
        Insert: {
          available_on_brokers?: boolean | null
          category: string
          collateral_return_type?: string | null
          created_at?: string
          event_ticker: string
          mutually_exclusive?: boolean | null
          product_metadata?: Json | null
          series_ticker: string
          strike_date?: string | null
          strike_period?: string | null
          sub_title?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          available_on_brokers?: boolean | null
          category?: string
          collateral_return_type?: string | null
          created_at?: string
          event_ticker?: string
          mutually_exclusive?: boolean | null
          product_metadata?: Json | null
          series_ticker?: string
          strike_date?: string | null
          strike_period?: string | null
          sub_title?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_series_ticker_fkey"
            columns: ["series_ticker"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["ticker"]
          },
        ]
      }
      market_filters: {
        Row: {
          category: string[] | null
          created_at: string
          description: string | null
          dominant_yes: boolean | null
          event_mutually_exclusive: boolean | null
          filter_name: string
          id: number
          market_ticker_pattern: string | null
          max_volume: number | null
          max_volume_24h: number | null
          min_volume: number | null
          min_volume_24h: number | null
          time_since_open_max_hr: number | null
          time_since_open_min_hr: number | null
          time_until_expected_close_hr_max: number | null
          time_until_expected_close_hr_min: number | null
          updated_at: string
          yes_favored: boolean | null
          yes_probability_max: number | null
          yes_probability_min: number | null
        }
        Insert: {
          category?: string[] | null
          created_at?: string
          description?: string | null
          dominant_yes?: boolean | null
          event_mutually_exclusive?: boolean | null
          filter_name: string
          id?: number
          market_ticker_pattern?: string | null
          max_volume?: number | null
          max_volume_24h?: number | null
          min_volume?: number | null
          min_volume_24h?: number | null
          time_since_open_max_hr?: number | null
          time_since_open_min_hr?: number | null
          time_until_expected_close_hr_max?: number | null
          time_until_expected_close_hr_min?: number | null
          updated_at?: string
          yes_favored?: boolean | null
          yes_probability_max?: number | null
          yes_probability_min?: number | null
        }
        Update: {
          category?: string[] | null
          created_at?: string
          description?: string | null
          dominant_yes?: boolean | null
          event_mutually_exclusive?: boolean | null
          filter_name?: string
          id?: number
          market_ticker_pattern?: string | null
          max_volume?: number | null
          max_volume_24h?: number | null
          min_volume?: number | null
          min_volume_24h?: number | null
          time_since_open_max_hr?: number | null
          time_since_open_min_hr?: number | null
          time_until_expected_close_hr_max?: number | null
          time_until_expected_close_hr_min?: number | null
          updated_at?: string
          yes_favored?: boolean | null
          yes_probability_max?: number | null
          yes_probability_min?: number | null
        }
        Relationships: []
      }
      market_snapshots: {
        Row: {
          ask_depth_top5: number | null
          bid_depth_top5: number | null
          can_close_early: boolean | null
          category: string | null
          close_time: string | null
          collected_at: string
          collection_batch_id: string
          collection_order_in_batch: number | null
          created_time: string | null
          event_ticker: string
          id: number
          last_price: number | null
          liquidity: number | null
          market_type: string | null
          mid_price: number | null
          no_ask: number | null
          no_bid: number | null
          open_interest: number | null
          open_time: string | null
          order_imbalance: number | null
          previous_price: number | null
          previous_yes_ask: number | null
          previous_yes_bid: number | null
          spread: number | null
          spread_pct: number | null
          status: string | null
          ticker: string
          time_since_last_snapshot: number | null
          time_since_open_seconds: number | null
          time_to_close_seconds: number | null
          volume: number | null
          volume_24h: number | null
          weighted_ask: number | null
          weighted_bid: number | null
          yes_ask: number | null
          yes_bid: number | null
        }
        Insert: {
          ask_depth_top5?: number | null
          bid_depth_top5?: number | null
          can_close_early?: boolean | null
          category?: string | null
          close_time?: string | null
          collected_at: string
          collection_batch_id?: string
          collection_order_in_batch?: number | null
          created_time?: string | null
          event_ticker: string
          id?: number
          last_price?: number | null
          liquidity?: number | null
          market_type?: string | null
          mid_price?: number | null
          no_ask?: number | null
          no_bid?: number | null
          open_interest?: number | null
          open_time?: string | null
          order_imbalance?: number | null
          previous_price?: number | null
          previous_yes_ask?: number | null
          previous_yes_bid?: number | null
          spread?: number | null
          spread_pct?: number | null
          status?: string | null
          ticker: string
          time_since_last_snapshot?: number | null
          time_since_open_seconds?: number | null
          time_to_close_seconds?: number | null
          volume?: number | null
          volume_24h?: number | null
          weighted_ask?: number | null
          weighted_bid?: number | null
          yes_ask?: number | null
          yes_bid?: number | null
        }
        Update: {
          ask_depth_top5?: number | null
          bid_depth_top5?: number | null
          can_close_early?: boolean | null
          category?: string | null
          close_time?: string | null
          collected_at?: string
          collection_batch_id?: string
          collection_order_in_batch?: number | null
          created_time?: string | null
          event_ticker?: string
          id?: number
          last_price?: number | null
          liquidity?: number | null
          market_type?: string | null
          mid_price?: number | null
          no_ask?: number | null
          no_bid?: number | null
          open_interest?: number | null
          open_time?: string | null
          order_imbalance?: number | null
          previous_price?: number | null
          previous_yes_ask?: number | null
          previous_yes_bid?: number | null
          spread?: number | null
          spread_pct?: number | null
          status?: string | null
          ticker?: string
          time_since_last_snapshot?: number | null
          time_since_open_seconds?: number | null
          time_to_close_seconds?: number | null
          volume?: number | null
          volume_24h?: number | null
          weighted_ask?: number | null
          weighted_bid?: number | null
          yes_ask?: number | null
          yes_bid?: number | null
        }
        Relationships: []
      }
      markets: {
        Row: {
          can_close_early: boolean | null
          cap_strike: number | null
          category: string
          close_time: string
          created_time: string
          custom_strike: Json | null
          early_close_condition: string | null
          event_ticker: string
          expected_expiration_time: string | null
          expiration_time: string | null
          expiration_value: string | null
          floor_strike: number | null
          functional_strike: string | null
          latest_expiration_time: string | null
          liquidity_at_last_update: number | null
          market_type: string
          mve_collection_ticker: string | null
          mve_selected_legs: Json | null
          no_sub_title: string | null
          open_interest_at_last_update: number | null
          open_time: string
          price_level_structure: string | null
          price_ranges: Json | null
          primary_participant_key: string | null
          response_price_units: string | null
          result: string | null
          risk_limit_cents: number | null
          rules_primary: string | null
          rules_secondary: string | null
          settlement_timer_seconds: number | null
          status: string
          strike_type: string | null
          subtitle: string | null
          tick_size: number
          ticker: string
          title: string
          updated_at: string
          volume_24h_at_last_update: number | null
          volume_at_last_update: number | null
          yes_ask: number | null
          yes_bid: number | null
          yes_sub_title: string | null
        }
        Insert: {
          can_close_early?: boolean | null
          cap_strike?: number | null
          category?: string
          close_time: string
          created_time: string
          custom_strike?: Json | null
          early_close_condition?: string | null
          event_ticker: string
          expected_expiration_time?: string | null
          expiration_time?: string | null
          expiration_value?: string | null
          floor_strike?: number | null
          functional_strike?: string | null
          latest_expiration_time?: string | null
          liquidity_at_last_update?: number | null
          market_type: string
          mve_collection_ticker?: string | null
          mve_selected_legs?: Json | null
          no_sub_title?: string | null
          open_interest_at_last_update?: number | null
          open_time: string
          price_level_structure?: string | null
          price_ranges?: Json | null
          primary_participant_key?: string | null
          response_price_units?: string | null
          result?: string | null
          risk_limit_cents?: number | null
          rules_primary?: string | null
          rules_secondary?: string | null
          settlement_timer_seconds?: number | null
          status: string
          strike_type?: string | null
          subtitle?: string | null
          tick_size: number
          ticker: string
          title: string
          updated_at?: string
          volume_24h_at_last_update?: number | null
          volume_at_last_update?: number | null
          yes_ask?: number | null
          yes_bid?: number | null
          yes_sub_title?: string | null
        }
        Update: {
          can_close_early?: boolean | null
          cap_strike?: number | null
          category?: string
          close_time?: string
          created_time?: string
          custom_strike?: Json | null
          early_close_condition?: string | null
          event_ticker?: string
          expected_expiration_time?: string | null
          expiration_time?: string | null
          expiration_value?: string | null
          floor_strike?: number | null
          functional_strike?: string | null
          latest_expiration_time?: string | null
          liquidity_at_last_update?: number | null
          market_type?: string
          mve_collection_ticker?: string | null
          mve_selected_legs?: Json | null
          no_sub_title?: string | null
          open_interest_at_last_update?: number | null
          open_time?: string
          price_level_structure?: string | null
          price_ranges?: Json | null
          primary_participant_key?: string | null
          response_price_units?: string | null
          result?: string | null
          risk_limit_cents?: number | null
          rules_primary?: string | null
          rules_secondary?: string | null
          settlement_timer_seconds?: number | null
          status?: string
          strike_type?: string | null
          subtitle?: string | null
          tick_size?: number
          ticker?: string
          title?: string
          updated_at?: string
          volume_24h_at_last_update?: number | null
          volume_at_last_update?: number | null
          yes_ask?: number | null
          yes_bid?: number | null
          yes_sub_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "markets_event_ticker_fkey"
            columns: ["event_ticker"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["event_ticker"]
          },
        ]
      }
      policies: {
        Row: {
          created_at: string
          id: number
          is_active: boolean
          market_filter_id: number
          policy_description: string | null
          policy_name: string
          purchase_conditions_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: number
          is_active?: boolean
          market_filter_id: number
          policy_description?: string | null
          policy_name: string
          purchase_conditions_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          is_active?: boolean
          market_filter_id?: number
          policy_description?: string | null
          policy_name?: string
          purchase_conditions_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "policies_market_filter_id_fkey"
            columns: ["market_filter_id"]
            isOneToOne: false
            referencedRelation: "market_filters"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_markets: {
        Row: {
          id: number
          is_active: boolean
          market_ticker: string
          policy_id: number
          subscribed_at: string
          sync_success: number | null
          synced_at: string | null
          unsubscribed_at: string | null
          updated_at: string
        }
        Insert: {
          id?: number
          is_active?: boolean
          market_ticker: string
          policy_id: number
          subscribed_at?: string
          sync_success?: number | null
          synced_at?: string | null
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Update: {
          id?: number
          is_active?: boolean
          market_ticker?: string
          policy_id?: number
          subscribed_at?: string
          sync_success?: number | null
          synced_at?: string | null
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_markets_market_ticker_fkey"
            columns: ["market_ticker"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["ticker"]
          },
          {
            foreignKeyName: "policy_markets_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
        ]
      }
      scraper_logs: {
        Row: {
          completed_at: string
          created_at: string
          duration_ms: number
          error_message: string | null
          id: number
          metadata: Json | null
          process: string
          records_failed: number | null
          records_fetched: number | null
          records_inserted: number | null
          records_updated: number | null
          started_at: string
          status: string
        }
        Insert: {
          completed_at: string
          created_at?: string
          duration_ms: number
          error_message?: string | null
          id?: number
          metadata?: Json | null
          process: string
          records_failed?: number | null
          records_fetched?: number | null
          records_inserted?: number | null
          records_updated?: number | null
          started_at: string
          status: string
        }
        Update: {
          completed_at?: string
          created_at?: string
          duration_ms?: number
          error_message?: string | null
          id?: number
          metadata?: Json | null
          process?: string
          records_failed?: number | null
          records_fetched?: number | null
          records_inserted?: number | null
          records_updated?: number | null
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      series: {
        Row: {
          additional_prohibitions: Json | null
          category: string
          contract_terms_url: string | null
          contract_url: string | null
          fee_multiplier: number | null
          fee_type: string | null
          first_seen: string
          frequency: string | null
          last_updated: string
          settlement_sources: Json | null
          tags: Json | null
          ticker: string
          title: string
        }
        Insert: {
          additional_prohibitions?: Json | null
          category: string
          contract_terms_url?: string | null
          contract_url?: string | null
          fee_multiplier?: number | null
          fee_type?: string | null
          first_seen?: string
          frequency?: string | null
          last_updated?: string
          settlement_sources?: Json | null
          tags?: Json | null
          ticker: string
          title: string
        }
        Update: {
          additional_prohibitions?: Json | null
          category?: string
          contract_terms_url?: string | null
          contract_url?: string | null
          fee_multiplier?: number | null
          fee_type?: string | null
          first_seen?: string
          frequency?: string | null
          last_updated?: string
          settlement_sources?: Json | null
          tags?: Json | null
          ticker?: string
          title?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      filter_markets_by_series_category: {
        Args: { categories: string[]; market_tickers: string[] }
        Returns: string[]
      }
      get_active_markets_by_ticker_pattern: {
        Args: { p_pattern: string }
        Returns: Database["public"]["Tables"]["markets"]["Row"][]
        SetofOptions: {
          from: "*"
          to: "markets"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_brier_scores_aggregate: {
        Args: never
        Returns: {
          active_signal: string
          brier_calibration_mean: number
          brier_calibration_std: number
          brier_calibration_weighted_mean: number
          brier_market_mean: number
          brier_market_std: number
          brier_market_weighted_mean: number
          city: string
          n_days: number
          updated_at: string
        }[]
      }
      get_brier_scores_daily: {
        Args: { p_city: string; p_days?: number }
        Returns: {
          brier_calibration: number
          brier_calibration_weighted: number
          brier_market: number
          brier_market_weighted: number
          city: string
          event_date: string
          n_observations: number
        }[]
      }
      get_calibration_scores: {
        Args: {
          p_city: string
          p_price_cents_radius?: number
          p_time_min_radius?: number
          p_yes_ask_max?: number
          p_yes_ask_min?: number
        }
        Returns: {
          city: string
          delta: number
          measured_win_rate: number
          minutes_since_open: number
          n_markets: number
          n_yes: number
          yes_ask: number
        }[]
      }
      get_city_event_series: {
        Args: {
          p_city: string
          p_event_date: string
          p_from?: string
          p_require_all_markets?: boolean
          p_to?: string
        }
        Returns: {
          city: string
          collected_at: string
          event_date: string
          markets: Json
        }[]
      }
      get_latest_snapshots_for_tickers: {
        Args: { tickers: string[] }
        Returns: Database["public"]["Tables"]["market_snapshots"]["Row"][]
        SetofOptions: {
          from: "*"
          to: "market_snapshots"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_missing_event_tickers: {
        Args: { input_tickers: string[] }
        Returns: string[]
      }
      get_weather_price_calibration: {
        Args: {
          p_city: string
          p_min_markets?: number
          p_min_no?: number
          p_min_yes?: number
        }
        Returns: {
          band_ceil: number
          band_floor: number
          band_midpoint: number
          city: string
          computed_probability: number
          count_markets: number
          delta: number
          minutes_since_open: number
          resolved_yes: number
        }[]
      }
      refresh_sweep_config_summary: { Args: never; Returns: undefined }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  statistics: {
    Tables: {
      brier_scores_aggregate: {
        Row: {
          active_signal: string
          brier_calibration_mean: number
          brier_calibration_std: number
          brier_calibration_weighted_mean: number
          brier_market_mean: number
          brier_market_std: number
          brier_market_weighted_mean: number
          city: string
          id: string
          n_days: number
          updated_at: string
          window_days: number
        }
        Insert: {
          active_signal?: string
          brier_calibration_mean: number
          brier_calibration_std: number
          brier_calibration_weighted_mean: number
          brier_market_mean: number
          brier_market_std: number
          brier_market_weighted_mean: number
          city: string
          id?: string
          n_days: number
          updated_at?: string
          window_days?: number
        }
        Update: {
          active_signal?: string
          brier_calibration_mean?: number
          brier_calibration_std?: number
          brier_calibration_weighted_mean?: number
          brier_market_mean?: number
          brier_market_std?: number
          brier_market_weighted_mean?: number
          city?: string
          id?: string
          n_days?: number
          updated_at?: string
          window_days?: number
        }
        Relationships: []
      }
      brier_scores_daily: {
        Row: {
          brier_calibration: number
          brier_calibration_weighted: number
          brier_market: number
          brier_market_weighted: number
          city: string
          computed_at: string
          event_date: string
          id: string
          n_observations: number
          n_observations_trade_zone: number
          p_price_cents_radius: number
          p_time_min_radius: number
          p_yes_ask_max: number
          p_yes_ask_min: number
        }
        Insert: {
          brier_calibration: number
          brier_calibration_weighted: number
          brier_market: number
          brier_market_weighted: number
          city: string
          computed_at?: string
          event_date: string
          id?: string
          n_observations: number
          n_observations_trade_zone: number
          p_price_cents_radius?: number
          p_time_min_radius?: number
          p_yes_ask_max?: number
          p_yes_ask_min?: number
        }
        Update: {
          brier_calibration?: number
          brier_calibration_weighted?: number
          brier_market?: number
          brier_market_weighted?: number
          city?: string
          computed_at?: string
          event_date?: string
          id?: string
          n_observations?: number
          n_observations_trade_zone?: number
          p_price_cents_radius?: number
          p_time_min_radius?: number
          p_yes_ask_max?: number
          p_yes_ask_min?: number
        }
        Relationships: []
      }
      fade_calibration_aggregate: {
        Row: {
          id: string
          mean_no_price: number | null
          mean_p_weather: number | null
          n_days: number
          n_entries: number
          no_win_rate: number | null
          payoff_gap: number | null
          payoff_gap_ci95: number | null
          selector_gap: number | null
          updated_at: string
          window_days: number
          yes_rate: number | null
        }
        Insert: {
          id?: string
          mean_no_price?: number | null
          mean_p_weather?: number | null
          n_days: number
          n_entries: number
          no_win_rate?: number | null
          payoff_gap?: number | null
          payoff_gap_ci95?: number | null
          selector_gap?: number | null
          updated_at?: string
          window_days: number
          yes_rate?: number | null
        }
        Update: {
          id?: string
          mean_no_price?: number | null
          mean_p_weather?: number | null
          n_days?: number
          n_entries?: number
          no_win_rate?: number | null
          payoff_gap?: number | null
          payoff_gap_ci95?: number | null
          selector_gap?: number | null
          updated_at?: string
          window_days?: number
          yes_rate?: number | null
        }
        Relationships: []
      }
      fade_calibration_daily: {
        Row: {
          computed_at: string
          event_date: string
          id: string
          n_entries: number
          n_yes: number
          p_max_edge: number
          p_max_entry_price: number
          p_max_inter_model_spread: number
          p_max_model_revision: number
          p_min_edge: number
          p_min_entry_price: number
          p_min_p_weather: number
          p_model_count_max: number
          p_model_count_min: number
          p_window_end_hour: number
          p_window_start_hour: number
          payoff_gap: number | null
          selector_gap: number | null
          sum_no_price_cents: number
          sum_p_weather: number
          sum_yes_ask_cents: number
        }
        Insert: {
          computed_at?: string
          event_date: string
          id?: string
          n_entries: number
          n_yes: number
          p_max_edge: number
          p_max_entry_price: number
          p_max_inter_model_spread: number
          p_max_model_revision: number
          p_min_edge: number
          p_min_entry_price: number
          p_min_p_weather: number
          p_model_count_max: number
          p_model_count_min: number
          p_window_end_hour: number
          p_window_start_hour: number
          payoff_gap?: number | null
          selector_gap?: number | null
          sum_no_price_cents: number
          sum_p_weather: number
          sum_yes_ask_cents: number
        }
        Update: {
          computed_at?: string
          event_date?: string
          id?: string
          n_entries?: number
          n_yes?: number
          p_max_edge?: number
          p_max_entry_price?: number
          p_max_inter_model_spread?: number
          p_max_model_revision?: number
          p_min_edge?: number
          p_min_entry_price?: number
          p_min_p_weather?: number
          p_model_count_max?: number
          p_model_count_min?: number
          p_window_end_hour?: number
          p_window_start_hour?: number
          payoff_gap?: number | null
          selector_gap?: number | null
          sum_no_price_cents?: number
          sum_p_weather?: number
          sum_yes_ask_cents?: number
        }
        Relationships: []
      }
    }
    Views: {
      mv_weather_calibration_scores: {
        Row: {
          city: string | null
          delta: number | null
          measured_win_rate: number | null
          minutes_since_open: number | null
          n_markets: number | null
          n_yes: number | null
          yes_ask: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      compute_and_store_brier_scores: {
        Args: {
          p_city?: string
          p_event_date?: string
          p_price_cents_radius?: number
          p_time_min_radius?: number
          p_trade_zone_max?: number
          p_trade_zone_min?: number
          p_window_days?: number
          p_yes_ask_max?: number
          p_yes_ask_min?: number
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  trading: {
    Tables: {
      execution_modules: {
        Row: {
          created_at: string
          description: string | null
          external_data_source: Json | null
          id: number
          is_active: boolean
          liquidity_role: string
          name: string
          order_type: string
          required_store: Database["trading"]["Enums"]["store_key"] | null
          rules_config: Json
          sizing_config: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          external_data_source?: Json | null
          id?: number
          is_active?: boolean
          liquidity_role: string
          name: string
          order_type?: string
          required_store?: Database["trading"]["Enums"]["store_key"] | null
          rules_config: Json
          sizing_config?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          external_data_source?: Json | null
          id?: number
          is_active?: boolean
          liquidity_role?: string
          name?: string
          order_type?: string
          required_store?: Database["trading"]["Enums"]["store_key"] | null
          rules_config?: Json
          sizing_config?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      market_filters: {
        Row: {
          category: string[] | null
          created_at: string
          description: string | null
          dominant_yes: boolean | null
          event_mutually_exclusive: boolean | null
          filter_name: string
          id: number
          market_ticker_pattern: string | null
          max_volume: number | null
          max_volume_24h: number | null
          min_volume: number | null
          min_volume_24h: number | null
          time_since_open_max_hr: number | null
          time_since_open_min_hr: number | null
          time_until_expected_close_hr_max: number | null
          time_until_expected_close_hr_min: number | null
          updated_at: string
          yes_favored: boolean | null
          yes_probability_max: number | null
          yes_probability_min: number | null
        }
        Insert: {
          category?: string[] | null
          created_at?: string
          description?: string | null
          dominant_yes?: boolean | null
          event_mutually_exclusive?: boolean | null
          filter_name: string
          id?: number
          market_ticker_pattern?: string | null
          max_volume?: number | null
          max_volume_24h?: number | null
          min_volume?: number | null
          min_volume_24h?: number | null
          time_since_open_max_hr?: number | null
          time_since_open_min_hr?: number | null
          time_until_expected_close_hr_max?: number | null
          time_until_expected_close_hr_min?: number | null
          updated_at?: string
          yes_favored?: boolean | null
          yes_probability_max?: number | null
          yes_probability_min?: number | null
        }
        Update: {
          category?: string[] | null
          created_at?: string
          description?: string | null
          dominant_yes?: boolean | null
          event_mutually_exclusive?: boolean | null
          filter_name?: string
          id?: number
          market_ticker_pattern?: string | null
          max_volume?: number | null
          max_volume_24h?: number | null
          min_volume?: number | null
          min_volume_24h?: number | null
          time_since_open_max_hr?: number | null
          time_since_open_min_hr?: number | null
          time_until_expected_close_hr_max?: number | null
          time_until_expected_close_hr_min?: number | null
          updated_at?: string
          yes_favored?: boolean | null
          yes_probability_max?: number | null
          yes_probability_min?: number | null
        }
        Relationships: []
      }
      market_snapshots: {
        Row: {
          ask_depth_top5: number | null
          bid_depth_top5: number | null
          collected_at: string
          collection_batch_id: string
          id: number
          last_price: number | null
          liquidity: number | null
          market_ticker: string
          mid_price: number | null
          no_ask: number | null
          no_bid: number | null
          open_interest: number | null
          order_imbalance: number | null
          orderbook_no: Json | null
          orderbook_yes: Json | null
          policy_ids: number[] | null
          spread: number | null
          spread_pct: number | null
          time_since_open_seconds: number | null
          time_to_close_seconds: number | null
          volume: number | null
          volume_24h: number | null
          weighted_ask: number | null
          weighted_bid: number | null
          yes_ask: number | null
          yes_bid: number | null
        }
        Insert: {
          ask_depth_top5?: number | null
          bid_depth_top5?: number | null
          collected_at: string
          collection_batch_id?: string
          id?: number
          last_price?: number | null
          liquidity?: number | null
          market_ticker: string
          mid_price?: number | null
          no_ask?: number | null
          no_bid?: number | null
          open_interest?: number | null
          order_imbalance?: number | null
          orderbook_no?: Json | null
          orderbook_yes?: Json | null
          policy_ids?: number[] | null
          spread?: number | null
          spread_pct?: number | null
          time_since_open_seconds?: number | null
          time_to_close_seconds?: number | null
          volume?: number | null
          volume_24h?: number | null
          weighted_ask?: number | null
          weighted_bid?: number | null
          yes_ask?: number | null
          yes_bid?: number | null
        }
        Update: {
          ask_depth_top5?: number | null
          bid_depth_top5?: number | null
          collected_at?: string
          collection_batch_id?: string
          id?: number
          last_price?: number | null
          liquidity?: number | null
          market_ticker?: string
          mid_price?: number | null
          no_ask?: number | null
          no_bid?: number | null
          open_interest?: number | null
          order_imbalance?: number | null
          orderbook_no?: Json | null
          orderbook_yes?: Json | null
          policy_ids?: number[] | null
          spread?: number | null
          spread_pct?: number | null
          time_since_open_seconds?: number | null
          time_to_close_seconds?: number | null
          volume?: number | null
          volume_24h?: number | null
          weighted_ask?: number | null
          weighted_bid?: number | null
          yes_ask?: number | null
          yes_bid?: number | null
        }
        Relationships: []
      }
      mv_weather_snapshots: {
        Row: {
          ask_depth_top5: number | null
          bid_depth_top5: number | null
          city: string | null
          close_time: string | null
          collected_at: string | null
          collection_batch_id: string | null
          contract: string | null
          event_date: string | null
          event_ticker: string | null
          expiration_value: string | null
          id: number
          last_price: number | null
          liquidity: number | null
          market_ticker: string | null
          mid_price: number | null
          minutes_since_open: number | null
          no_ask: number | null
          no_bid: number | null
          open_interest: number | null
          order_imbalance: number | null
          orderbook_no: Json | null
          orderbook_yes: Json | null
          policy_ids: number[] | null
          result: string | null
          settlement_ts: string | null
          spread: number | null
          spread_pct: number | null
          time_since_open_seconds: number | null
          time_to_close_seconds: number | null
          volume: number | null
          volume_24h: number | null
          weighted_ask: number | null
          weighted_bid: number | null
          yes_ask: number | null
          yes_bid: number | null
        }
        Insert: {
          ask_depth_top5?: number | null
          bid_depth_top5?: number | null
          city?: string | null
          close_time?: string | null
          collected_at?: string | null
          collection_batch_id?: string | null
          contract?: string | null
          event_date?: string | null
          event_ticker?: string | null
          expiration_value?: string | null
          id: number
          last_price?: number | null
          liquidity?: number | null
          market_ticker?: string | null
          mid_price?: number | null
          minutes_since_open?: number | null
          no_ask?: number | null
          no_bid?: number | null
          open_interest?: number | null
          order_imbalance?: number | null
          orderbook_no?: Json | null
          orderbook_yes?: Json | null
          policy_ids?: number[] | null
          result?: string | null
          settlement_ts?: string | null
          spread?: number | null
          spread_pct?: number | null
          time_since_open_seconds?: number | null
          time_to_close_seconds?: number | null
          volume?: number | null
          volume_24h?: number | null
          weighted_ask?: number | null
          weighted_bid?: number | null
          yes_ask?: number | null
          yes_bid?: number | null
        }
        Update: {
          ask_depth_top5?: number | null
          bid_depth_top5?: number | null
          city?: string | null
          close_time?: string | null
          collected_at?: string | null
          collection_batch_id?: string | null
          contract?: string | null
          event_date?: string | null
          event_ticker?: string | null
          expiration_value?: string | null
          id?: number
          last_price?: number | null
          liquidity?: number | null
          market_ticker?: string | null
          mid_price?: number | null
          minutes_since_open?: number | null
          no_ask?: number | null
          no_bid?: number | null
          open_interest?: number | null
          order_imbalance?: number | null
          orderbook_no?: Json | null
          orderbook_yes?: Json | null
          policy_ids?: number[] | null
          result?: string | null
          settlement_ts?: string | null
          spread?: number | null
          spread_pct?: number | null
          time_since_open_seconds?: number | null
          time_to_close_seconds?: number | null
          volume?: number | null
          volume_24h?: number | null
          weighted_ask?: number | null
          weighted_bid?: number | null
          yes_ask?: number | null
          yes_bid?: number | null
        }
        Relationships: []
      }
      order_ledger: {
        Row: {
          acquisition_id: string | null
          action: string | null
          available_balance: number | null
          available_balance_centicents: number | null
          book_yes_ask: number | null
          book_yes_bid: number | null
          client_order_id: string
          count: number | null
          count_hundredths: number | null
          created_at: string
          created_time: string | null
          event_ticker: string | null
          event_ts: string | null
          event_type: Database["trading"]["Enums"]["order_event_type"]
          execution_module_id: number | null
          exit_type: string | null
          expiration_time: string | null
          fee_centicents: number | null
          fee_cents: number
          id: number
          initial_count: number | null
          initial_count_hundredths: number | null
          is_taker: boolean | null
          market_ticker: string
          mock_trade: boolean
          no_price: number | null
          order_id: string
          order_role: string | null
          policy_id: number
          price_cents: number | null
          reason: string | null
          side: string | null
          status: string | null
          subaccount: number | null
          time_in_force: string | null
          trade_id: string | null
          type: string | null
          user_id: string | null
          yes_price: number | null
        }
        Insert: {
          acquisition_id?: string | null
          action?: string | null
          available_balance?: number | null
          available_balance_centicents?: number | null
          book_yes_ask?: number | null
          book_yes_bid?: number | null
          client_order_id: string
          count?: number | null
          count_hundredths?: number | null
          created_at?: string
          created_time?: string | null
          event_ticker?: string | null
          event_ts?: string | null
          event_type: Database["trading"]["Enums"]["order_event_type"]
          execution_module_id?: number | null
          exit_type?: string | null
          expiration_time?: string | null
          fee_centicents?: number | null
          fee_cents?: number
          id?: number
          initial_count?: number | null
          initial_count_hundredths?: number | null
          is_taker?: boolean | null
          market_ticker: string
          mock_trade?: boolean
          no_price?: number | null
          order_id: string
          order_role?: string | null
          policy_id: number
          price_cents?: number | null
          reason?: string | null
          side?: string | null
          status?: string | null
          subaccount?: number | null
          time_in_force?: string | null
          trade_id?: string | null
          type?: string | null
          user_id?: string | null
          yes_price?: number | null
        }
        Update: {
          acquisition_id?: string | null
          action?: string | null
          available_balance?: number | null
          available_balance_centicents?: number | null
          book_yes_ask?: number | null
          book_yes_bid?: number | null
          client_order_id?: string
          count?: number | null
          count_hundredths?: number | null
          created_at?: string
          created_time?: string | null
          event_ticker?: string | null
          event_ts?: string | null
          event_type?: Database["trading"]["Enums"]["order_event_type"]
          execution_module_id?: number | null
          exit_type?: string | null
          expiration_time?: string | null
          fee_centicents?: number | null
          fee_cents?: number
          id?: number
          initial_count?: number | null
          initial_count_hundredths?: number | null
          is_taker?: boolean | null
          market_ticker?: string
          mock_trade?: boolean
          no_price?: number | null
          order_id?: string
          order_role?: string | null
          policy_id?: number
          price_cents?: number | null
          reason?: string | null
          side?: string | null
          status?: string | null
          subaccount?: number | null
          time_in_force?: string | null
          trade_id?: string | null
          type?: string | null
          user_id?: string | null
          yes_price?: number | null
        }
        Relationships: []
      }
      policies: {
        Row: {
          created_at: string
          id: number
          is_active: boolean
          market_filter_id: number
          policy_description: string | null
          policy_name: string
          purchase_conditions_id: string | null
          sleeve_id: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: number
          is_active?: boolean
          market_filter_id: number
          policy_description?: string | null
          policy_name: string
          purchase_conditions_id?: string | null
          sleeve_id?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          is_active?: boolean
          market_filter_id?: number
          policy_description?: string | null
          policy_name?: string
          purchase_conditions_id?: string | null
          sleeve_id?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "policies_market_filter_id_fkey"
            columns: ["market_filter_id"]
            isOneToOne: false
            referencedRelation: "market_filters"
            referencedColumns: ["id"]
          },
        ]
      }
      simulated_orders: {
        Row: {
          action: string
          available_balance: number | null
          city: string
          contract_strike: string
          created_at: string
          edge: number | null
          event_date: string
          exit_type: string | null
          expiration_value: string
          fill_count: number
          fill_count_hundredths: number | null
          fill_price_cents: number
          id: number
          maker_fees: number
          market_ticker: string
          result: string
          settlement_ts: string
          side: string
          simulation_run_id: number
          taker_fees: number
          total_cost_cents: number
          triggered_at: string
          updated_at: string
        }
        Insert: {
          action: string
          available_balance?: number | null
          city: string
          contract_strike: string
          created_at?: string
          edge?: number | null
          event_date: string
          exit_type?: string | null
          expiration_value: string
          fill_count: number
          fill_count_hundredths?: number | null
          fill_price_cents: number
          id?: number
          maker_fees?: number
          market_ticker: string
          result: string
          settlement_ts: string
          side: string
          simulation_run_id: number
          taker_fees?: number
          total_cost_cents: number
          triggered_at: string
          updated_at?: string
        }
        Update: {
          action?: string
          available_balance?: number | null
          city?: string
          contract_strike?: string
          created_at?: string
          edge?: number | null
          event_date?: string
          exit_type?: string | null
          expiration_value?: string
          fill_count?: number
          fill_count_hundredths?: number | null
          fill_price_cents?: number
          id?: number
          maker_fees?: number
          market_ticker?: string
          result?: string
          settlement_ts?: string
          side?: string
          simulation_run_id?: number
          taker_fees?: number
          total_cost_cents?: number
          triggered_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulated_orders_simulation_run_id_fkey"
            columns: ["simulation_run_id"]
            isOneToOne: false
            referencedRelation: "simulation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulated_orders_simulation_run_id_fkey"
            columns: ["simulation_run_id"]
            isOneToOne: false
            referencedRelation: "sweep_config_summary"
            referencedColumns: ["simulation_run_id"]
          },
        ]
      }
      simulated_settled_positions: {
        Row: {
          agg_pos_cost: number
          agg_revenue: number
          buy_count: number
          buy_count_hundredths: number | null
          created_at: string | null
          fees_paid_cents: number
          id: number
          market_ticker: string
          realized_pnl: number
          sell_count: number
          sell_count_hundredths: number | null
          side: string
          simulation_run_id: number
          updated_at: string | null
        }
        Insert: {
          agg_pos_cost?: number
          agg_revenue?: number
          buy_count?: number
          buy_count_hundredths?: number | null
          created_at?: string | null
          fees_paid_cents?: number
          id?: number
          market_ticker: string
          realized_pnl: number
          sell_count?: number
          sell_count_hundredths?: number | null
          side: string
          simulation_run_id: number
          updated_at?: string | null
        }
        Update: {
          agg_pos_cost?: number
          agg_revenue?: number
          buy_count?: number
          buy_count_hundredths?: number | null
          created_at?: string | null
          fees_paid_cents?: number
          id?: number
          market_ticker?: string
          realized_pnl?: number
          sell_count?: number
          sell_count_hundredths?: number | null
          side?: string
          simulation_run_id?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "simulated_settled_positions_simulation_run_id_fkey"
            columns: ["simulation_run_id"]
            isOneToOne: false
            referencedRelation: "simulation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulated_settled_positions_simulation_run_id_fkey"
            columns: ["simulation_run_id"]
            isOneToOne: false
            referencedRelation: "sweep_config_summary"
            referencedColumns: ["simulation_run_id"]
          },
        ]
      }
      simulation_runs: {
        Row: {
          cities: string[]
          completed_at: string | null
          created_at: string
          duration_ms: number | null
          end_date: string
          error_message: string | null
          holdout_dates: string[] | null
          id: number
          initial_balance_cents: number | null
          name: string | null
          re_entry_blocked: boolean
          risk_manager_config_snapshot: Json | null
          rules_config_snapshot: Json
          start_date: string
          started_at: string | null
          status: string
        }
        Insert: {
          cities: string[]
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          end_date: string
          error_message?: string | null
          holdout_dates?: string[] | null
          id?: number
          initial_balance_cents?: number | null
          name?: string | null
          re_entry_blocked?: boolean
          risk_manager_config_snapshot?: Json | null
          rules_config_snapshot: Json
          start_date: string
          started_at?: string | null
          status?: string
        }
        Update: {
          cities?: string[]
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          end_date?: string
          error_message?: string | null
          holdout_dates?: string[] | null
          id?: number
          initial_balance_cents?: number | null
          name?: string | null
          re_entry_blocked?: boolean
          risk_manager_config_snapshot?: Json | null
          rules_config_snapshot?: Json
          start_date?: string
          started_at?: string | null
          status?: string
        }
        Relationships: []
      }
      trade_signals: {
        Row: {
          action: string
          client_order_id: string | null
          count: number | null
          edge: number | null
          evaluated_at: string
          execution_module_id: number | null
          exit_type: string | null
          id: number
          kelly_fraction: number | null
          market_state: Json
          market_ticker: string
          metadata: Json | null
          mock_trade: boolean
          policy_id: number
          side: string
          simulation_run_id: number | null
          status: string | null
          target_price: number | null
          type: string | null
          uncertainty_multiplier: number | null
        }
        Insert: {
          action: string
          client_order_id?: string | null
          count?: number | null
          edge?: number | null
          evaluated_at?: string
          execution_module_id?: number | null
          exit_type?: string | null
          id?: number
          kelly_fraction?: number | null
          market_state: Json
          market_ticker: string
          metadata?: Json | null
          mock_trade?: boolean
          policy_id: number
          side: string
          simulation_run_id?: number | null
          status?: string | null
          target_price?: number | null
          type?: string | null
          uncertainty_multiplier?: number | null
        }
        Update: {
          action?: string
          client_order_id?: string | null
          count?: number | null
          edge?: number | null
          evaluated_at?: string
          execution_module_id?: number | null
          exit_type?: string | null
          id?: number
          kelly_fraction?: number | null
          market_state?: Json
          market_ticker?: string
          metadata?: Json | null
          mock_trade?: boolean
          policy_id?: number
          side?: string
          simulation_run_id?: number | null
          status?: string | null
          target_price?: number | null
          type?: string | null
          uncertainty_multiplier?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_signals_simulation_run_id_fkey"
            columns: ["simulation_run_id"]
            isOneToOne: false
            referencedRelation: "simulation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_signals_simulation_run_id_fkey"
            columns: ["simulation_run_id"]
            isOneToOne: false
            referencedRelation: "sweep_config_summary"
            referencedColumns: ["simulation_run_id"]
          },
        ]
      }
    }
    Views: {
      mv_calibration_base: {
        Row: {
          city: string | null
          market_ticker: string | null
          minutes_since_open: number | null
          result: string | null
          yes_ask: number | null
        }
        Relationships: []
      }
      order_acquisition_lifecycle: {
        Row: {
          acquisition_id: string | null
          avg_fill_price_cents: number | null
          cancel_count: number | null
          cancel_reason: string | null
          fees_cents: number | null
          fill_ratio: number | null
          filled_immediate: number | null
          filled_passive: number | null
          is_terminal: boolean | null
          last_fill_at: string | null
          market_ticker: string | null
          mock_trade: boolean | null
          open_count: number | null
          opened_at: string | null
          policy_id: number | null
          reprice_count: number | null
          target_count: number | null
          time_to_fill: string | null
          total_filled: number | null
          unfilled_remainder: number | null
        }
        Relationships: []
      }
      order_analytics: {
        Row: {
          acquisition_id: string | null
          avg_slippage_vs_limit_cents: number | null
          filled_count: number | null
          initial_count: number | null
          maker_fill_ratio: number | null
          market_ticker: string | null
          policy_id: number | null
          time_to_first_fill: string | null
          time_to_last_fill: string | null
        }
        Relationships: []
      }
      sweep_config_summary: {
        Row: {
          active_management_contribution_cents: number | null
          avg_edge_at_entry: number | null
          avg_entry_price: number | null
          avg_hold_time_seconds: number | null
          baseline_pnl_cents: number | null
          baseline_pnl_cents_no: number | null
          baseline_pnl_cents_yes: number | null
          baseline_win_rate: number | null
          buy_count: number | null
          capital_utilization_avg: number | null
          cities_with_any_activity: number | null
          cities_with_positive_pnl: number | null
          end_date: string | null
          error_message: string | null
          exits_hard_stop: number | null
          exits_profit_target: number | null
          exits_stop_loss: number | null
          exits_trailing_stop: number | null
          grace_period_ms: number | null
          gross_cost_cents: number | null
          gross_revenue_cents: number | null
          hard_stop_percent: number | null
          held_only_positive_pnl_share: number | null
          initial_balance_cents: number | null
          kelly_multiplier: number | null
          max_inter_model_spread: number | null
          max_model_revision: number | null
          min_edge: number | null
          min_p_weather: number | null
          model_count_max: number | null
          model_count_min: number | null
          months_with_any_activity: number | null
          months_with_positive_pnl: number | null
          name: string | null
          positions_held_to_settlement: number | null
          positions_with_residual_after_exit: number | null
          profit_target_capture: number | null
          re_entry_blocked: boolean | null
          revision_cap: number | null
          sell_count: number | null
          side: string | null
          simulation_run_id: number | null
          spread_cap: number | null
          start_date: string | null
          status: string | null
          stop_loss_percent: number | null
          time_in_market_pct: number | null
          total_fees_cents: number | null
          total_orders: number | null
          total_pnl_cents: number | null
          trailing_stop_arm_threshold: number | null
          trailing_stop_min_held_ms: number | null
          trailing_stop_retracement_floor: number | null
          unique_event_dates_traded: number | null
          unique_markets_traded: number | null
        }
        Relationships: []
      }
      v_city_event_minute: {
        Row: {
          city: string | null
          collected_at: string | null
          event_date: string | null
          markets: Json | null
        }
        Relationships: []
      }
      weather_snapshots_src: {
        Row: {
          ask_depth_top5: number | null
          bid_depth_top5: number | null
          city: string | null
          close_time: string | null
          collected_at: string | null
          collection_batch_id: string | null
          contract: string | null
          event_date: string | null
          event_ticker: string | null
          expiration_value: string | null
          id: number | null
          last_price: number | null
          liquidity: number | null
          market_ticker: string | null
          mid_price: number | null
          minutes_since_open: number | null
          no_ask: number | null
          no_bid: number | null
          open_interest: number | null
          order_imbalance: number | null
          orderbook_no: Json | null
          orderbook_yes: Json | null
          policy_ids: number[] | null
          result: string | null
          settlement_ts: string | null
          spread: number | null
          spread_pct: number | null
          time_since_open_seconds: number | null
          time_to_close_seconds: number | null
          volume: number | null
          volume_24h: number | null
          weighted_ask: number | null
          weighted_bid: number | null
          yes_ask: number | null
          yes_bid: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_city_event_series: {
        Args: {
          p_city: string
          p_event_date: string
          p_from?: string
          p_require_all_markets?: boolean
          p_to?: string
        }
        Returns: {
          city: string
          collected_at: string
          event_date: string
          markets: Json
        }[]
      }
      reconcile_weather_snapshots: {
        Args: { p_days?: number }
        Returns: {
          base_rows: number
          base_unsettled_settleable: number
          event_date: string
          result_mismatches: number
          source_rows: number
        }[]
      }
      refresh_weather_snapshots_incremental: {
        Args: { p_lookback?: string; p_retention?: string }
        Returns: {
          appended: number
          pruned: number
          settled: number
        }[]
      }
      weather_snapshots_lock_key: { Args: never; Returns: number }
    }
    Enums: {
      order_event_type: "open" | "fill" | "cancel" | "amend"
      store_key:
        | "weather_calibration"
        | "high_temp_probability"
        | "high_temp_model_confidence"
        | "high_temp_v2_signal"
        | "intraday_observation"
        | "high_temp_maker_state"
        | "rain_state"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  weather_v2: {
    Tables: {
      bucket_probabilities: {
        Row: {
          bias_corrected_mu: number
          cap_strike: number | null
          city: string
          computed_at: string
          floor_strike: number | null
          forecast_date: string
          forecast_high_f: number
          id: number
          lower_bound: number | null
          model: string
          p_weather: number
          sigma: number
          strike_type: string
          ticker: string
          upper_bound: number | null
        }
        Insert: {
          bias_corrected_mu: number
          cap_strike?: number | null
          city: string
          computed_at?: string
          floor_strike?: number | null
          forecast_date: string
          forecast_high_f: number
          id?: never
          lower_bound?: number | null
          model: string
          p_weather: number
          sigma: number
          strike_type: string
          ticker: string
          upper_bound?: number | null
        }
        Update: {
          bias_corrected_mu?: number
          cap_strike?: number | null
          city?: string
          computed_at?: string
          floor_strike?: number | null
          forecast_date?: string
          forecast_high_f?: number
          id?: never
          lower_bound?: number | null
          model?: string
          p_weather?: number
          sigma?: number
          strike_type?: string
          ticker?: string
          upper_bound?: number | null
        }
        Relationships: []
      }
      fastpath_watermarks: {
        Row: {
          last_avail_time: string
          last_init_time: string
          model_slug: string
          updated_at: string
        }
        Insert: {
          last_avail_time: string
          last_init_time: string
          model_slug: string
          updated_at?: string
        }
        Update: {
          last_avail_time?: string
          last_init_time?: string
          model_slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      forecast_run_samples: {
        Row: {
          city: string
          created_at: string
          delta_f: number | null
          fetched_at: string
          forecast_date: string
          forecast_high_at: string
          forecast_high_f: number
          id: number
          model: string
          model_slug: string
          prev_high_f: number | null
          run_avail_time: string
          run_init_time: string
          source: string
          vector_hash: string
        }
        Insert: {
          city: string
          created_at?: string
          delta_f?: number | null
          fetched_at: string
          forecast_date: string
          forecast_high_at: string
          forecast_high_f: number
          id?: never
          model: string
          model_slug: string
          prev_high_f?: number | null
          run_avail_time: string
          run_init_time: string
          source: string
          vector_hash: string
        }
        Update: {
          city?: string
          created_at?: string
          delta_f?: number | null
          fetched_at?: string
          forecast_date?: string
          forecast_high_at?: string
          forecast_high_f?: number
          id?: never
          model?: string
          model_slug?: string
          prev_high_f?: number | null
          run_avail_time?: string
          run_init_time?: string
          source?: string
          vector_hash?: string
        }
        Relationships: []
      }
      high_temp_model_forecasts: {
        Row: {
          abs_error_f: number | null
          city: string
          created_at: string | null
          error_f: number | null
          forecast_date: string
          forecast_high_at: string | null
          forecast_high_f: number
          forecast_issued_at: string
          id: number
          model: string
          observed_high_f: number | null
        }
        Insert: {
          abs_error_f?: number | null
          city: string
          created_at?: string | null
          error_f?: number | null
          forecast_date: string
          forecast_high_at?: string | null
          forecast_high_f: number
          forecast_issued_at: string
          id?: never
          model: string
          observed_high_f?: number | null
        }
        Update: {
          abs_error_f?: number | null
          city?: string
          created_at?: string | null
          error_f?: number | null
          forecast_date?: string
          forecast_high_at?: string | null
          forecast_high_f?: number
          forecast_issued_at?: string
          id?: never
          model?: string
          observed_high_f?: number | null
        }
        Relationships: []
      }
      hourly_features: {
        Row: {
          city: string
          cloud_cover_pct: number | null
          created_at: string
          dewpoint_f: number | null
          forecast_issued_at: string
          model: string
          relative_humidity: number | null
          valid_at: string
          wind_direction_deg: number | null
          wind_speed_mph: number | null
        }
        Insert: {
          city: string
          cloud_cover_pct?: number | null
          created_at?: string
          dewpoint_f?: number | null
          forecast_issued_at: string
          model: string
          relative_humidity?: number | null
          valid_at: string
          wind_direction_deg?: number | null
          wind_speed_mph?: number | null
        }
        Update: {
          city?: string
          cloud_cover_pct?: number | null
          created_at?: string
          dewpoint_f?: number | null
          forecast_issued_at?: string
          model?: string
          relative_humidity?: number | null
          valid_at?: string
          wind_direction_deg?: number | null
          wind_speed_mph?: number | null
        }
        Relationships: []
      }
      maker_state: {
        Row: {
          cap_strike: number | null
          city: string
          consensus_high_f: number | null
          consensus_model_count: number
          decided_side: string | null
          evaluated_at: string
          floor_strike: number | null
          forecast_date: string
          forecast_peak_at: string | null
          last_rev_at: string | null
          last_rev_f: number | null
          last_rev_model: string | null
          ob_ingested_at: string | null
          ob_observed_at: string | null
          peak_model_count: number
          running_max_f: number | null
          strike_type: string | null
          ticker: string
        }
        Insert: {
          cap_strike?: number | null
          city: string
          consensus_high_f?: number | null
          consensus_model_count?: number
          decided_side?: string | null
          evaluated_at: string
          floor_strike?: number | null
          forecast_date: string
          forecast_peak_at?: string | null
          last_rev_at?: string | null
          last_rev_f?: number | null
          last_rev_model?: string | null
          ob_ingested_at?: string | null
          ob_observed_at?: string | null
          peak_model_count?: number
          running_max_f?: number | null
          strike_type?: string | null
          ticker: string
        }
        Update: {
          cap_strike?: number | null
          city?: string
          consensus_high_f?: number | null
          consensus_model_count?: number
          decided_side?: string | null
          evaluated_at?: string
          floor_strike?: number | null
          forecast_date?: string
          forecast_peak_at?: string | null
          last_rev_at?: string | null
          last_rev_f?: number | null
          last_rev_model?: string | null
          ob_ingested_at?: string | null
          ob_observed_at?: string | null
          peak_model_count?: number
          running_max_f?: number | null
          strike_type?: string | null
          ticker?: string
        }
        Relationships: []
      }
      model_confidence_signals: {
        Row: {
          cap_strike: number | null
          city: string
          created_at: string
          evaluated_at: string
          floor_strike: number | null
          forecast_date: string
          forecast_issued_at: string | null
          hour_bucket: string
          id: number
          inter_model_spread: number
          max_model_revision: number
          model_count: number
          net_revision_f: number
          p_weather: number
          revision_lookback_hours: number
          strike_type: string
          ticker: string
        }
        Insert: {
          cap_strike?: number | null
          city: string
          created_at?: string
          evaluated_at: string
          floor_strike?: number | null
          forecast_date: string
          forecast_issued_at?: string | null
          hour_bucket: string
          id?: never
          inter_model_spread: number
          max_model_revision: number
          model_count: number
          net_revision_f?: number
          p_weather: number
          revision_lookback_hours: number
          strike_type: string
          ticker: string
        }
        Update: {
          cap_strike?: number | null
          city?: string
          created_at?: string
          evaluated_at?: string
          floor_strike?: number | null
          forecast_date?: string
          forecast_issued_at?: string | null
          hour_bucket?: string
          id?: never
          inter_model_spread?: number
          max_model_revision?: number
          model_count?: number
          net_revision_f?: number
          p_weather?: number
          revision_lookback_hours?: number
          strike_type?: string
          ticker?: string
        }
        Relationships: []
      }
      model_error_stats_bootstrap: {
        Row: {
          bias: number
          city: string
          lead_hours_bucket: number
          mae: number
          model: string
          row_count: number
          sigma: number
        }
        Insert: {
          bias: number
          city: string
          lead_hours_bucket: number
          mae: number
          model: string
          row_count: number
          sigma: number
        }
        Update: {
          bias?: number
          city?: string
          lead_hours_bucket?: number
          mae?: number
          model?: string
          row_count?: number
          sigma?: number
        }
        Relationships: []
      }
      nbm_pop06: {
        Row: {
          block_end: string
          ingested_at: string
          model_run: string
          p06: number
          station: string
        }
        Insert: {
          block_end: string
          ingested_at?: string
          model_run: string
          p06: number
          station: string
        }
        Update: {
          block_end?: string
          ingested_at?: string
          model_run?: string
          p06?: number
          station?: string
        }
        Relationships: []
      }
      observations: {
        Row: {
          city: string
          ingested_at: string
          lst_date: string
          observed_at: string
          oracle_source: string
          raw_metar: string | null
          running_max_f: number
          running_max_hourly_f: number
          six_hour_attributable: boolean
          six_hour_max_f: number | null
          source: string | null
          temp_f: number
          temp_precise: boolean
        }
        Insert: {
          city: string
          ingested_at?: string
          lst_date: string
          observed_at: string
          oracle_source: string
          raw_metar?: string | null
          running_max_f: number
          running_max_hourly_f: number
          six_hour_attributable?: boolean
          six_hour_max_f?: number | null
          source?: string | null
          temp_f: number
          temp_precise: boolean
        }
        Update: {
          city?: string
          ingested_at?: string
          lst_date?: string
          observed_at?: string
          oracle_source?: string
          raw_metar?: string | null
          running_max_f?: number
          running_max_hourly_f?: number
          six_hour_attributable?: boolean
          six_hour_max_f?: number | null
          source?: string | null
          temp_f?: number
          temp_precise?: boolean
        }
        Relationships: []
      }
      rain_state: {
        Row: {
          city: string
          day_end: string
          day_start: string
          evaluated_at: string
          model_run: string | null
          obs_latest_at: string | null
          q_raw: number | null
          q_remaining: number | null
          rain_observed_at: string | null
          station: string
          ticker: string
          trace_observed_at: string | null
        }
        Insert: {
          city: string
          day_end: string
          day_start: string
          evaluated_at: string
          model_run?: string | null
          obs_latest_at?: string | null
          q_raw?: number | null
          q_remaining?: number | null
          rain_observed_at?: string | null
          station: string
          ticker: string
          trace_observed_at?: string | null
        }
        Update: {
          city?: string
          day_end?: string
          day_start?: string
          evaluated_at?: string
          model_run?: string | null
          obs_latest_at?: string | null
          q_raw?: number | null
          q_remaining?: number | null
          rain_observed_at?: string | null
          station?: string
          ticker?: string
          trace_observed_at?: string | null
        }
        Relationships: []
      }
      twc_observations: {
        Row: {
          first_seen_at: string
          icao_id: string
          local_date: string
          local_hour: number | null
          report_time_utc: string
          station_name: string | null
          status: string | null
          temp_c: number | null
          temp_f: number | null
        }
        Insert: {
          first_seen_at?: string
          icao_id: string
          local_date: string
          local_hour?: number | null
          report_time_utc: string
          station_name?: string | null
          status?: string | null
          temp_c?: number | null
          temp_f?: number | null
        }
        Update: {
          first_seen_at?: string
          icao_id?: string
          local_date?: string
          local_hour?: number | null
          report_time_utc?: string
          station_name?: string | null
          status?: string | null
          temp_c?: number | null
          temp_f?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      effective_error_stats: {
        Row: {
          bias: number | null
          city: string | null
          lead_hours_bucket: number | null
          mae: number | null
          model: string | null
          row_count: number | null
          sigma: number | null
        }
        Relationships: []
      }
      model_error_daily: {
        Row: {
          city: string | null
          forecast_date: string | null
          lead_hours_bucket: number | null
          model: string | null
          n: number | null
          sum_abs_error: number | null
          sum_error: number | null
          sum_sq_error: number | null
        }
        Relationships: []
      }
      model_error_stats: {
        Row: {
          bias: number | null
          city: string | null
          lead_hours_bucket: number | null
          mae: number | null
          model: string | null
          row_count: number | null
          sigma: number | null
        }
        Relationships: []
      }
      observation_current: {
        Row: {
          city: string | null
          ingested_at: string | null
          lst_date: string | null
          observed_at: string | null
          oracle_source: string | null
          running_max_f: number | null
          running_max_hourly_f: number | null
          six_hour_attributable: boolean | null
          six_hour_max_f: number | null
          temp_f: number | null
          temp_precise: boolean | null
        }
        Relationships: []
      }
    }
    Functions: {
      refresh_model_error_stats: { Args: never; Returns: undefined }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  accounting: {
    Enums: {
      sleeve_event_type: ["grant", "fill", "settlement", "debit", "netting"],
      sleeve_mode: ["mock", "live", "treasury"],
      sleeve_status: ["active", "inactive", "retired"],
    },
  },
  kalshi_state: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
  statistics: {
    Enums: {},
  },
  trading: {
    Enums: {
      order_event_type: ["open", "fill", "cancel", "amend"],
      store_key: [
        "weather_calibration",
        "high_temp_probability",
        "high_temp_model_confidence",
        "high_temp_v2_signal",
        "intraday_observation",
        "high_temp_maker_state",
        "rain_state",
      ],
    },
  },
  weather_v2: {
    Enums: {},
  },
} as const
