type RealtimeListener<T = any> = (data: T) => void;

class RealtimeManager {
  private listeners: Map<string, Set<RealtimeListener>> = new Map();
  private eventSource: EventSource | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private statusListeners: Set<(connected: boolean) => void> = new Set();
  private isConnectedState = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isDestroyed = false;

  constructor() {
    this.initBroadcastChannel();
    this.initEventSource();
    this.initWindowListener();
  }

  private initBroadcastChannel() {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;
    try {
      this.broadcastChannel = new BroadcastChannel('aws_prep_realtime_bus');
      this.broadcastChannel.onmessage = (event) => {
        const { type, data } = event.data || {};
        if (type) {
          this.emitLocal(type, data);
        }
      };
    } catch {
      // Ignore broadcast channel errors
    }
  }

  private initWindowListener() {
    if (typeof window === 'undefined') return;
    window.addEventListener('aws_realtime_event', ((e: CustomEvent) => {
      if (e.detail?.type) {
        this.emitLocal(e.detail.type, e.detail.data);
      }
    }) as EventListener);
  }

  private initEventSource() {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;
    if (this.isDestroyed) return;

    try {
      if (this.eventSource) {
        this.eventSource.close();
      }

      this.eventSource = new EventSource('/api/realtime/events');

      this.eventSource.onopen = () => {
        this.setConnected(true);
      };

      this.eventSource.onerror = () => {
        this.setConnected(false);
        this.eventSource?.close();
        this.eventSource = null;

        // Auto reconnect with 4s backoff
        if (!this.reconnectTimer && !this.isDestroyed) {
          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.initEventSource();
          }, 4000);
        }
      };

      // Listen to specific server events
      const serverEventTypes = ['ai_query', 'ai_feedback', 'ai_queries_synced', 'session_heartbeat', 'learner_update', 'learner_registered', 'learner_screen_mirror'];
      for (const eventType of serverEventTypes) {
        this.eventSource.addEventListener(eventType, (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            this.emitLocal(eventType, data);
          } catch {
            this.emitLocal(eventType, e.data);
          }
        });
      }
    } catch {
      this.setConnected(false);
    }
  }

  private setConnected(status: boolean) {
    this.isConnectedState = status;
    for (const listener of this.statusListeners) {
      try {
        listener(status);
      } catch {
        // Ignore listener error
      }
    }
  }

  private emitLocal(type: string, data: any) {
    const handlers = this.listeners.get(type);
    if (handlers) {
      for (const fn of handlers) {
        try {
          fn(data);
        } catch (err) {
          console.error(`Error in realtime handler for [${type}]:`, err);
        }
      }
    }
    // Also trigger wildcard listeners
    const allHandlers = this.listeners.get('*');
    if (allHandlers) {
      for (const fn of allHandlers) {
        try {
          fn({ type, data });
        } catch (err) {
          console.error('Error in realtime wildcard handler:', err);
        }
      }
    }
  }

  /**
   * Subscribe to a realtime event
   * Returns unsubscribe function
   */
  public subscribe<T = any>(type: string, listener: RealtimeListener<T>): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);

    return () => {
      this.listeners.get(type)?.delete(listener);
    };
  }

  /**
   * Broadcast an event across all open tabs and locally
   */
  public broadcast(type: string, data: any) {
    // 1. Emit locally in current tab
    this.emitLocal(type, data);

    // 2. Broadcast to other tabs via BroadcastChannel
    try {
      this.broadcastChannel?.postMessage({ type, data });
    } catch {
      // Ignore
    }

    // 3. Dispatch window CustomEvent for components
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('aws_realtime_event', { detail: { type, data } }));
    }
  }

  public isConnected(): boolean {
    return this.isConnectedState;
  }

  public onStatusChange(callback: (connected: boolean) => void): () => void {
    this.statusListeners.add(callback);
    callback(this.isConnectedState);
    return () => {
      this.statusListeners.delete(callback);
    };
  }

  public destroy() {
    this.isDestroyed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.eventSource?.close();
    this.broadcastChannel?.close();
    this.listeners.clear();
    this.statusListeners.clear();
  }
}

export const realtimeManager = new RealtimeManager();
