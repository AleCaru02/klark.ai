import { useEffect, useRef, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SyncResult {
  success: boolean;
  imported_count: number;
  updated_count: number;
  canceled_count: number;
  rescheduled_count: number;
  skipped_count: number;
  errors: string[];
  last_sync_at: string;
}

interface UseSyncPollingOptions {
  tenantId: string | undefined;
  enabled: boolean;
  intervalMs?: number;
  onSyncComplete?: (result: SyncResult) => void;
}

export function useSyncPolling({
  tenantId,
  enabled,
  intervalMs = 15000, // Default 15 seconds for near real-time sync
  onSyncComplete,
}: UseSyncPollingOptions) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);

  const performSync = useCallback(async () => {
    if (!tenantId || isSyncing) return;

    setIsSyncing(true);
    setLastSyncError(null);
    
    try {
      console.log('[useSyncPolling] Starting sync...');
      const { data, error } = await supabase.functions.invoke("google-calendar-sync", {
        body: { tenant_id: tenantId },
      });

      if (error) {
        console.error('[useSyncPolling] Sync error:', error);
        setLastSyncError(error.message || 'Errore durante la sincronizzazione');
        return;
      }
      
      if (data?.success) {
        console.log('[useSyncPolling] Sync completed:', data);
        const result: SyncResult = {
          success: true,
          imported_count: data.imported_count || 0,
          updated_count: data.updated_count || 0,
          canceled_count: data.canceled_count || 0,
          rescheduled_count: data.rescheduled_count || 0,
          skipped_count: data.skipped_count || 0,
          errors: data.errors || [],
          last_sync_at: data.last_sync_at || new Date().toISOString(),
        };
        setLastSyncResult(result);
        onSyncComplete?.(result);
      } else if (data?.error) {
        setLastSyncError(data.error);
      }
    } catch (error) {
      console.error('[useSyncPolling] Sync error:', error);
      setLastSyncError(String(error));
    } finally {
      setIsSyncing(false);
    }
  }, [tenantId, isSyncing, onSyncComplete]);

  // Initial sync on mount
  useEffect(() => {
    if (enabled && tenantId) {
      // Delay initial sync by 1 second to let page load
      const initialTimeout = setTimeout(() => {
        performSync();
      }, 1000);

      return () => clearTimeout(initialTimeout);
    }
  }, [enabled, tenantId]); // Don't include performSync to avoid re-triggering

  // Polling interval
  useEffect(() => {
    if (enabled && tenantId) {
      intervalRef.current = setInterval(() => {
        performSync();
      }, intervalMs);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }
  }, [enabled, tenantId, intervalMs]); // Don't include performSync

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  return {
    syncNow: performSync,
    isSyncing,
    lastSyncResult,
    lastSyncError,
  };
}
