/**
 * Reaching the Forecastle web UI from inside Headlamp.
 *
 * The catalog page does not need this — it reads ForecastleApp resources
 * straight from the API, so it works whether or not Forecastle's own frontend
 * is running. This is for when you want the real thing: rather than telling
 * someone to go and type `kubectl port-forward`, start the forward through
 * Headlamp's own backend and hand back a localhost URL.
 *
 * Headlamp exposes `/portforward` on its server, so this works in the desktop
 * app and against a running headlamp-server alike. It is not a browser-only
 * trick and it is not desktop-only.
 *
 * There is no watch for port forwards — the endpoint is plain REST — so the
 * list is polled. {@link POLL_MS} is the only reason this file has a timer.
 */
import { K8s } from '@kinvolk/headlamp-plugin/lib';
import {
  listPortForward,
  startPortForward,
  stopOrDeletePortForward,
} from '@kinvolk/headlamp-plugin/lib/ApiProxy';
import { useCluster } from '@kinvolk/headlamp-plugin/lib/k8s';
import React from 'react';

/** How often the active-forward list is re-read. */
const POLL_MS = 4000;

/**
 * Label the Stakater chart puts on both the Service and its Pods.
 * Selecting on it beats listing every Service in the cluster and filtering.
 */
const FORECASTLE_SELECTOR = 'app=forecastle';

/** Headlamp's port-forward record, narrowed to what this file uses. */
export interface ForwardRecord {
  id: string;
  service: string;
  serviceNamespace: string;
  pod: string;
  /** Local port Headlamp bound. */
  port: string;
  targetPort: string;
  status?: string;
  error?: string;
}

export interface ForecastleService {
  key: string;
  name: string;
  namespace: string;
  /** Port on the pod, which is what the forward actually targets. */
  targetPort: number | string;
  /** Active forward for this service, if one is running. */
  forward?: ForwardRecord;
  /** Where the UI is reachable while the forward is up. */
  url?: string;
}

export interface ForecastleUi {
  services: ForecastleService[];
  /** True while the first Service list is loading. */
  loading: boolean;
  /** Set while a start or stop is in flight, keyed by service. */
  busy: string | null;
  error: string | null;
  start: (svc: ForecastleService) => Promise<string | null>;
  stop: (svc: ForecastleService) => Promise<void>;
}

function isRunning(f?: ForwardRecord): boolean {
  // Headlamp marks a stopped forward on the record rather than dropping it.
  return !!f && f.status !== 'Stopped' && !f.error;
}

export function useForecastleUi(): ForecastleUi {
  const cluster = useCluster() ?? '';
  const svcQuery = K8s.ResourceClasses.Service.useList({ labelSelector: FORECASTLE_SELECTOR });
  const podQuery = K8s.ResourceClasses.Pod.useList({ labelSelector: FORECASTLE_SELECTOR });

  const [forwards, setForwards] = React.useState<ForwardRecord[]>([]);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    if (!cluster) {
      return;
    }
    try {
      setForwards((await listPortForward(cluster)) ?? []);
    } catch (e) {
      // A backend without port-forward support is a missing feature, not a
      // page error — leave the list empty and let the control stay hidden.
      setForwards([]);
    }
  }, [cluster]);

  React.useEffect(() => {
    refresh();
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  const services: ForecastleService[] = React.useMemo(() => {
    return (svcQuery.items ?? []).map((svc: any) => {
      const name = svc.metadata.name;
      const namespace = svc.metadata.namespace;
      const port = svc.jsonData?.spec?.ports?.[0];
      const forward = forwards.find(f => f.service === name && f.serviceNamespace === namespace);
      const live = isRunning(forward);
      return {
        key: `${namespace}/${name}`,
        name,
        namespace,
        targetPort: port?.targetPort ?? port?.port ?? 3000,
        forward: live ? forward : undefined,
        url: live ? `http://localhost:${forward!.port}` : undefined,
      };
    });
  }, [svcQuery.items, forwards]);

  const start = React.useCallback(
    async (svc: ForecastleService): Promise<string | null> => {
      setBusy(svc.key);
      setError(null);
      try {
        // The forward attaches to a pod, not the Service, so resolve one behind
        // it — the same thing Headlamp's own Service port-forward UI does.
        const pod = (podQuery.items ?? []).find(
          (p: any) => p.metadata.namespace === svc.namespace && p.jsonData?.status?.phase === 'Running'
        ) as any;

        if (!pod) {
          setError(`No running Forecastle pod in ${svc.namespace}`);
          return null;
        }

        const result = await startPortForward(
          cluster,
          pod.metadata.namespace,
          pod.metadata.name,
          svc.targetPort,
          svc.name,
          svc.namespace
        );
        await refresh();
        return result?.port ? `http://localhost:${result.port}` : null;
      } catch (e: any) {
        setError(e?.message ?? String(e));
        return null;
      } finally {
        setBusy(null);
      }
    },
    [cluster, podQuery.items, refresh]
  );

  const stop = React.useCallback(
    async (svc: ForecastleService) => {
      if (!svc.forward) {
        return;
      }
      setBusy(svc.key);
      setError(null);
      try {
        await stopOrDeletePortForward(cluster, svc.forward.id, true);
        await refresh();
      } catch (e: any) {
        setError(e?.message ?? String(e));
      } finally {
        setBusy(null);
      }
    },
    [cluster, refresh]
  );

  return { services, loading: svcQuery.isLoading, busy, error, start, stop };
}

/* ------------------------------------------------- externally-run forwards */

const EXTERNAL_KEY = 'evocloud.forecastle.external-ports';

/** Ports a `kubectl port-forward` is commonly pointed at. */
const SCAN_PORTS = [8080, 8081, 8082, 8083, 8084, 8085, 8086, 8088, 8090, 9000, 9090];

/** Liveness re-check for known external ports. Slower than the forward poll —
 *  each check is two image loads, and these change far less often. */
const EXTERNAL_POLL_MS = 10000;

function loadPorts(): number[] {
  try {
    const raw = JSON.parse(localStorage.getItem(EXTERNAL_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((p: unknown) => Number.isInteger(p)) : [];
  } catch (e) {
    return [];
  }
}

function savePorts(ports: number[]) {
  try {
    localStorage.setItem(EXTERNAL_KEY, JSON.stringify(ports));
  } catch (e) {
    /* storage unavailable — the list just will not persist */
  }
}

function loadsAsImage(url: string, timeoutMs: number): Promise<boolean> {
  return new Promise(resolve => {
    const img = new Image();
    const done = (ok: boolean) => {
      img.onload = null;
      img.onerror = null;
      resolve(ok);
    };
    img.onload = () => done(true);
    img.onerror = () => done(false);
    setTimeout(() => done(false), timeoutMs);
    // Cache-buster, so a stopped forward does not keep answering from cache.
    img.src = `${url}?t=${Date.now()}`;
  });
}

/**
 * Best-effort check that a local port is serving Forecastle.
 *
 * A `kubectl port-forward` someone ran in a terminal is invisible to Headlamp —
 * it is a separate OS process, and no API enumerates arbitrary local listeners.
 * The browser can only knock on the door.
 *
 * Forecastle serves no CORS headers, so its manifest.json — which would name it
 * outright — cannot be read from script. Images are exempt from CORS for
 * display, so this loads two of them instead. Requiring both matters: nearly
 * every web server has a favicon, and Headlamp's own port would pass on that
 * alone. Only the pair rejects it.
 *
 * This is a heuristic, not proof. Another Create React App on the same port
 * would also match, which is why anything found is offered rather than assumed.
 */
export async function probeForecastle(port: number, timeoutMs = 2500): Promise<boolean> {
  const base = `http://localhost:${port}`;
  const [favicon, logo] = await Promise.all([
    loadsAsImage(`${base}/favicon.ico`, timeoutMs),
    loadsAsImage(`${base}/logo192.png`, timeoutMs),
  ]);
  return favicon && logo;
}

export interface ExternalForward {
  port: number;
  url: string;
  /** False once the forward is gone but the entry is still remembered. */
  alive: boolean;
}

export interface ExternalForwards {
  entries: ExternalForward[];
  scanning: boolean;
  add: (port: number) => Promise<void>;
  remove: (port: number) => void;
  /** Probe the common ports and remember whatever answers. */
  scan: () => Promise<number>;
}

/**
 * Port forwards started outside Headlamp — a terminal `kubectl port-forward`,
 * usually — remembered locally and re-probed so the row goes grey when the
 * forward stops.
 */
export function useExternalForwards(): ExternalForwards {
  const [ports, setPorts] = React.useState<number[]>(loadPorts);
  const [alive, setAlive] = React.useState<Record<number, boolean>>({});
  const [scanning, setScanning] = React.useState(false);

  const recheck = React.useCallback(async (list: number[]) => {
    const results = await Promise.all(list.map(async p => [p, await probeForecastle(p)] as const));
    setAlive(Object.fromEntries(results));
  }, []);

  React.useEffect(() => {
    if (ports.length === 0) {
      setAlive({});
      return undefined;
    }
    recheck(ports);
    const t = setInterval(() => recheck(ports), EXTERNAL_POLL_MS);
    return () => clearInterval(t);
  }, [ports, recheck]);

  const commit = React.useCallback((next: number[]) => {
    const unique = Array.from(new Set(next)).sort((a, b) => a - b);
    setPorts(unique);
    savePorts(unique);
  }, []);

  const add = React.useCallback(
    async (port: number) => {
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        return;
      }
      commit([...loadPorts(), port]);
    },
    [commit]
  );

  const remove = React.useCallback((port: number) => commit(loadPorts().filter(p => p !== port)), [commit]);

  const scan = React.useCallback(async (): Promise<number> => {
    setScanning(true);
    try {
      const hits = await Promise.all(SCAN_PORTS.map(async p => ((await probeForecastle(p)) ? p : null)));
      const found = hits.filter((p): p is number => p !== null);
      if (found.length > 0) {
        commit([...loadPorts(), ...found]);
      }
      return found.length;
    } finally {
      setScanning(false);
    }
  }, [commit]);

  const entries = ports.map(port => ({
    port,
    url: `http://localhost:${port}`,
    alive: !!alive[port],
  }));

  return { entries, scanning, add, remove, scan };
}
