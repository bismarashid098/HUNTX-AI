/**
 * EventSource wrapper for SSE streaming
 */
export class SSEClient {
  constructor(sessionId, handlers = {}) {
    this.sessionId = sessionId;
    this.handlers = handlers;
    this.eventSource = null;
  }

  connect() {
    if (this.eventSource) this.disconnect();

    this.eventSource = new EventSource(`/api/chat/stream/${this.sessionId}`, {
      withCredentials: true,
    });

    this.eventSource.addEventListener('message', (e) => {
      try {
        const data = JSON.parse(e.data);
        this.handlers.onMessage?.(data);
      } catch {}
    });

    this.eventSource.addEventListener('progress', (e) => {
      try {
        const data = JSON.parse(e.data);
        this.handlers.onProgress?.(data);
      } catch {}
    });

    this.eventSource.addEventListener('approval_request', (e) => {
      try {
        const data = JSON.parse(e.data);
        this.handlers.onApprovalRequest?.(data);
      } catch {}
    });

    this.eventSource.addEventListener('complete', (e) => {
      try {
        const data = JSON.parse(e.data);
        this.handlers.onComplete?.(data);
      } catch {}
    });

    this.eventSource.addEventListener('error', (e) => {
      if (e.data) {
        try {
          const data = JSON.parse(e.data);
          this.handlers.onError?.(data);
        } catch {}
      }
    });

    this.eventSource.onerror = () => {
      this.handlers.onConnectionError?.();
    };

    return this;
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}
