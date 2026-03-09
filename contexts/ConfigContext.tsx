import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface AppConfig {
  maxTournamentsPerUser: number;
  maxParticipantsPerTournament: number;
  pointsGuess1: number;
  pointsGuess2: number;
  pointsGuess3: number;
  pointsGuess4: number;
  pointsGuess5: number;
  pointsGuess6: number;
  pointsMissed: number;
  updatedAt: string;
}

interface ConfigContextType {
  config: AppConfig | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConfig = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.rpc('get_app_config');

    if (error) {
      setError(error.message || 'Unable to load configuration');
      setLoading(false);
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;

    if (!row) {
      setError('Configuration not found');
      setLoading(false);
      return;
    }

    setConfig({
      maxTournamentsPerUser: row.max_tournaments_per_user,
      maxParticipantsPerTournament: row.max_participants_per_tournament,
      pointsGuess1: row.points_guess_1,
      pointsGuess2: row.points_guess_2,
      pointsGuess3: row.points_guess_3,
      pointsGuess4: row.points_guess_4,
      pointsGuess5: row.points_guess_5,
      pointsGuess6: row.points_guess_6,
      pointsMissed: row.points_missed,
      updatedAt: row.updated_at,
    });

    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setConfig(null);
      return;
    }
    if (!config) {
      void loadConfig();
    }
  }, [user, authLoading, config, loadConfig]);

  const handleRefresh = useCallback(async () => {
    await loadConfig();
  }, [loadConfig]);

  return (
    <ConfigContext.Provider value={{ config, loading, error, refresh: handleRefresh }}>
      {children}
    </ConfigContext.Provider>
  );
}

export const useAppConfig = (): ConfigContextType => {
  const ctx = useContext(ConfigContext);
  if (!ctx) {
    throw new Error('useAppConfig must be used within a ConfigProvider');
  }
  return ctx;
};

