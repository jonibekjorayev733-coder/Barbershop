/**
 * WebSocket Connection Diagnostics
 * Monitors and logs WebSocket health
 */

export interface WsDiagnostics {
  connected: boolean;
  reconnectAttempts: number;
  lastMessageTime: number;
  messagesReceived: number;
  messagesSent: number;
  errors: string[];
  latency: number;
}

class WsDiagnosticsTracker {
  private diagnostics: WsDiagnostics = {
    connected: false,
    reconnectAttempts: 0,
    lastMessageTime: 0,
    messagesReceived: 0,
    messagesSent: 0,
    errors: [],
    latency: 0,
  };

  private pingSentTime: number | null = null;

  recordConnect(): void {
    this.diagnostics.connected = true;
    this.diagnostics.reconnectAttempts = 0;
    console.log("[WS] Connected ✓");
  }

  recordDisconnect(): void {
    this.diagnostics.connected = false;
    console.log("[WS] Disconnected ✗");
  }

  recordReconnectAttempt(): void {
    this.diagnostics.reconnectAttempts += 1;
    console.log(`[WS] Reconnect attempt #${this.diagnostics.reconnectAttempts}`);
  }

  recordMessageReceived(): void {
    this.diagnostics.messagesReceived += 1;
    this.diagnostics.lastMessageTime = Date.now();
  }

  recordMessageSent(): void {
    this.diagnostics.messagesSent += 1;
  }

  recordError(error: string): void {
    this.diagnostics.errors.push(`${new Date().toISOString()}: ${error}`);
    if (this.diagnostics.errors.length > 50) {
      this.diagnostics.errors.shift(); // Keep last 50 errors
    }
    console.error(`[WS ERROR] ${error}`);
  }

  recordPingSent(): void {
    this.pingSentTime = Date.now();
  }

  recordPongReceived(): void {
    if (this.pingSentTime) {
      this.diagnostics.latency = Date.now() - this.pingSentTime;
      console.log(`[WS] Latency: ${this.diagnostics.latency}ms`);
    }
  }

  getDiagnostics(): WsDiagnostics {
    return { ...this.diagnostics };
  }

  getHealthStatus(): "healthy" | "degraded" | "critical" {
    if (!this.diagnostics.connected) return "critical";
    if (this.diagnostics.latency > 1000 || this.diagnostics.reconnectAttempts > 3) return "degraded";
    return "healthy";
  }

  printDiagnostics(): void {
    const diag = this.getDiagnostics();
    const status = this.getHealthStatus();
    console.table({
      status: `[${status.toUpperCase()}]`,
      connected: diag.connected ? "✓" : "✗",
      reconnectAttempts: diag.reconnectAttempts,
      messagesReceived: diag.messagesReceived,
      latency: `${diag.latency}ms`,
      lastMessage: new Date(diag.lastMessageTime).toLocaleTimeString(),
    });

    if (diag.errors.length > 0) {
      console.log("[WS] Recent Errors:");
      diag.errors.slice(-5).forEach((err) => console.log(`  - ${err}`));
    }
  }
}

export const wsDialostics = new WsDiagnosticsTracker();
