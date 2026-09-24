import type { Request, Response } from 'express';

// Track active SSE client response objects
const activeClients = new Set<Response>();

// Periodic ping interval to keep HTTP connection alive through firewalls/proxies
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

function ensureHeartbeat() {
  if (!heartbeatInterval) {
    heartbeatInterval = setInterval(() => {
      if (activeClients.size === 0) {
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        heartbeatInterval = null;
        return;
      }
      for (const res of activeClients) {
        try {
          res.write(':ping\n\n');
        } catch {
          activeClients.delete(res);
        }
      }
    }, 25000);
  }
}

/**
 * Handle incoming Server-Sent Events (SSE) connection from client
 */
export function handleRealtimeSSE(req: Request, res: Response): void {
  // Set SSE response headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': '*',
  });

  if (typeof (res as any).flushHeaders === 'function') {
    (res as any).flushHeaders();
  }

  // Send initial welcome/connected frame
  res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected', timestamp: Date.now() })}\n\n`);

  activeClients.add(res);
  ensureHeartbeat();

  let serverlessTimer: NodeJS.Timeout | null = null;
  const isServerless = Boolean(
    process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NOW_REGION
  );
  if (isServerless) {
    // Vercel serverless has execution timeouts. Gracefully close before hard timeout so client reconnects seamlessly.
    serverlessTimer = setTimeout(() => {
      try {
        res.write(`event: ping\ndata: {"reconnect":true}\n\n`);
        activeClients.delete(res);
        res.end();
      } catch {
        // Ignore
      }
    }, 25000);
  }

  // Clean up when client disconnects
  req.on('close', () => {
    if (serverlessTimer) clearTimeout(serverlessTimer);
    activeClients.delete(res);
    try {
      res.end();
    } catch {
      // Ignore
    }
  });
}

/**
 * Broadcast an event to all connected realtime clients
 */
export function broadcastRealtimeEvent(eventType: string, data: any): void {
  if (activeClients.size === 0) return;

  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of activeClients) {
    try {
      client.write(payload);
    } catch {
      activeClients.delete(client);
    }
  }
}

/**
 * Get count of active realtime SSE clients
 */
export function getRealtimeClientsCount(): number {
  return activeClients.size;
}
