import { useState } from 'react';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from '../lib/ai';

export const useDeleteAccount = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteAccount = async (): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      // Chiama l'endpoint API (stesso pattern BFF degli altri flussi mobile)
      const { error: apiError, status } = await apiFetch(
        '/api/delete-account',
        { method: 'DELETE' }
      );

      if (apiError || status !== 200) {
        throw new Error(apiError ?? 'Errore durante l\'eliminazione dell\'account');
      }

      // Pulisci la sessione locale
      await supabase.auth.signOut({ scope: 'local' });
      await AsyncStorage.clear();
      return true;
    } catch (e: any) {
      setError(e?.message ?? 'Errore sconosciuto.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { deleteAccount, loading, error };
};