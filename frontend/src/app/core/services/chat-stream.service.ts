import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface StreamChunk {
  type: 'token' | 'sources' | 'error';
  data: any;
}

export interface ChatStreamRequest {
  message: string;
  project_id?: string;
  chat_id?: string;
  classification?: string;
  pii_detected?: boolean;
  eligible_for_training?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ChatStreamService {

  private baseUrl = '/api/v1';

  /**
   * Envia mensagem ao backend Rust e faz stream da resposta via SSE (fetch + ReadableStream).
   * Não usa EventSource pois precisamos de POST com Authorization header.
   */
  sendAndStream(request: ChatStreamRequest): Observable<StreamChunk> {
    return new Observable(observer => {
      const token = localStorage.getItem('jwt_token');
      let cancelled = false;

      fetch(`${this.baseUrl}/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token ?? ''}`,
        },
        body: JSON.stringify(request),
      }).then(response => {
        if (!response.ok || !response.body) {
          observer.error(new Error(`HTTP ${response.status}`));
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        const pump = (): Promise<void> => {
          if (cancelled) return Promise.resolve();
          return reader.read().then(({ done, value }) => {
            if (done) {
              observer.complete();
              return;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const raw = line.slice(6).trim();
              if (raw === '[DONE]') { observer.complete(); return; }
              try {
                const parsed = JSON.parse(raw);
                if (parsed.type === 'sources') {
                  observer.next({ type: 'sources', data: parsed.data });
                } else {
                  observer.next({ type: 'token', data: parsed.content ?? raw });
                }
              } catch {
                if (raw) observer.next({ type: 'token', data: raw });
              }
            }
            return pump();
          });
        };

        pump().catch(err => observer.error(err));
      }).catch(err => observer.error(err));

      // Teardown: cancela o stream se o Observable for unsubscribed
      return () => { cancelled = true; };
    });
  }
}
