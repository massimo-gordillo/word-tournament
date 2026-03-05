export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          display_name: string
          created_at: string
        }
        Insert: {
          id: string
          display_name: string
          created_at?: string
        }
        Update: {
          id?: string
          display_name?: string
          created_at?: string
        }
      }
      tournaments: {
        Row: {
          id: string
          name: string
          join_code: string
          start_date: string
          end_date: string
          status: 'draft' | 'active' | 'closed' | 'cancelled'
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          join_code?: string
          start_date: string
          end_date: string
          status?: 'draft' | 'active' | 'closed' | 'cancelled'
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          join_code?: string
          start_date?: string
          end_date?: string
          status?: 'draft' | 'active' | 'closed' | 'cancelled'
          created_by?: string
          created_at?: string
        }
      }
      tournament_participants: {
        Row: {
          id: string
          tournament_id: string
          user_id: string
          forfeited: boolean
          joined_at: string
        }
        Insert: {
          id?: string
          tournament_id: string
          user_id: string
          forfeited?: boolean
          joined_at?: string
        }
        Update: {
          id?: string
          tournament_id?: string
          user_id?: string
          forfeited?: boolean
          joined_at?: string
        }
      }
      daily_submissions: {
        Row: {
          id: string
          user_id: string
          submission_date: string
          submission_text: string
          wordle_score: number
          submitted_at: string
        }
        Insert: {
          id?: string
          user_id: string
          submission_date: string
          submission_text: string
          wordle_score: number
          submitted_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          submission_date?: string
          submission_text?: string
          wordle_score?: number
          submitted_at?: string
        }
      }
      tournament_scores: {
        Row: {
          id: string
          tournament_id: string
          user_id: string
          total_score: number
          last_updated: string
        }
        Insert: {
          id?: string
          tournament_id: string
          user_id: string
          total_score?: number
          last_updated?: string
        }
        Update: {
          id?: string
          tournament_id?: string
          user_id?: string
          total_score?: number
          last_updated?: string
        }
      }
    }
  }
}
