/**
 * React hooks for the witsmith backend.
 *
 * Every hook talks to the live backend (`/api/...`). There is no mock
 * fallback anymore — when the backend is down or has no data, the hook
 * resolves with whatever the server returned (often `[]` or `null`) and
 * pages render an empty state instead of fixture data.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  api,
  adaptMemoryCard,
  adaptSafetyEvent,
  adaptContractRule,
  type ApiSessionFile,
  type ApiContextResult,
  type ApiStaleCheckResult,
} from "./api";
import type {
  MemoryCard,
  SafetyEvent,
  ContractRule,
} from "./display";

export type Source = "live" | "empty" | "error";

export type AsyncState<T> = {
  data: T;
  source: Source;
  loading: boolean;
  error: string | null;
  refresh: () => void;
};

function useAsync<T>(
  load: () => Promise<{ data: T; source: Source }>,
  initial: T
): AsyncState<T> {
  const [data, setData] = useState<T>(initial);
  const [source, setSource] = useState<Source>("empty");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    load()
      .then((res) => {
        if (cancelled || !mounted.current) return;
        setData(res.data);
        setSource(res.source);
        setError(null);
      })
      .catch((err) => {
        if (cancelled || !mounted.current) return;
        setError(err?.message ?? "unknown error");
        setSource("error");
      })
      .finally(() => {
        if (cancelled || !mounted.current) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, source, loading, error, refresh };
}

/* ------------------------------ Backend health ------------------------------ */

export function useApiHealth(): { live: boolean; checking: boolean } {
  const [live, setLive] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .health()
      .then((h) => {
        if (!cancelled) setLive(Boolean(h?.ok));
      })
      .catch(() => {
        if (!cancelled) setLive(false);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { live, checking };
}

/* ------------------------------ Memories ------------------------------ */

export function useMemories(sessionId?: string) {
  return useAsync<MemoryCard[]>(
    async () => {
      const remote = await api.memories(sessionId);
      const data = Array.isArray(remote) ? remote.map(adaptMemoryCard) : [];
      return { data, source: data.length > 0 ? "live" : "empty" };
    },
    []
  );
}

/* ------------------------------ Safety ------------------------------ */

export function useSafetyEvents(limit = 100) {
  return useAsync<SafetyEvent[]>(
    async () => {
      const remote = await api.safetyEvents(limit);
      const data = Array.isArray(remote) ? remote.map(adaptSafetyEvent) : [];
      return { data, source: data.length > 0 ? "live" : "empty" };
    },
    []
  );
}

export function useContractRules() {
  return useAsync<ContractRule[]>(
    async () => {
      const remote = await api.safetyRules();
      const data =
        remote && Array.isArray(remote.rules)
          ? remote.rules.map(adaptContractRule)
          : [];
      return { data, source: data.length > 0 ? "live" : "empty" };
    },
    []
  );
}

/* ------------------------------ Sessions ------------------------------ */

export type LiveSessionSummary = {
  id: string;
  task: string;
  branch: string;
  status: string;
  startedAt: string;
  finishedAt: string;
  changedFiles: string[];
  actionCount: number;
  memoryCardCount: number;
  baseCommit: string;
  endCommit: string;
  repoPath: string;
};

export function useLiveSessions() {
  return useAsync<LiveSessionSummary[]>(
    async () => {
      const remote = await api.sessions();
      const data = Array.isArray(remote)
        ? remote.map((s) => ({
            id: s.id,
            task: s.task,
            branch: s.branch,
            status: s.status,
            startedAt: s.startedAt,
            finishedAt: s.finishedAt,
            changedFiles: s.changedFiles,
            actionCount: s.actionCount,
            memoryCardCount: s.memoryCardCount,
            baseCommit: s.baseCommit,
            endCommit: s.endCommit,
            repoPath: s.repoPath,
          }))
        : [];
      return { data, source: data.length > 0 ? "live" : "empty" };
    },
    []
  );
}

/** Fetch one full SessionFile by id. */
export function useSessionDetail(id: string | undefined) {
  const [data, setData] = useState<ApiSessionFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!id) {
      setData(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      .session(id)
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message ?? "failed to load session");
        setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, refresh };
}

/* ------------------------------ Mutations ------------------------------ */

export function useStaleCheck() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ApiStaleCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      const r = await api.staleCheck();
      setResult(r);
      return r;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setRunning(false);
    }
  }, []);

  return { run, running, result, error };
}

export function useContext() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ApiContextResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (task: string, limit = 5) => {
    setRunning(true);
    setError(null);
    try {
      const r = await api.context(task, limit);
      setResult(r);
      return r;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setRunning(false);
    }
  }, []);

  return { run, running, result, error };
}
