import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { FilteredMessage, WorkspaceContext } from '../../shared/models/data-classification.model';

export interface StreamChunk {
  type: 'token' | 'sources' | 'error';
  data: any;
}

@Injectable({ providedIn: 'root' })
export class ChatStreamService {

  private baseUrl = '/api/v1';

  /**
   * Envia mensagem e retorna Observable de chunks SSE (streaming)
   */
  sendAndStream(message: FilteredMessage, workspace: WorkspaceContext): Observable<StreamChunk> {
    return new Observable(observer => {
      const token = localStorage.getItem('jwt_token');

      const eventSource = new EventSource(
        `${this.baseUrl}/chat/stream?workspace=${workspace.workspaceId}`,
      );

      // Faz fetch POST para iniciar o stream
      fetch(`${this.baseUrl}/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Workspace-ID': workspace.workspaceId,
        },
        body: JSON.stringify({
          message: message.content,
          classification: message.classification,
          pii_detected: message.piiDetected,
          eligible_for_training: message.eligibleForTraining,
        }),
      }).then(response => {
        if (!response.ok) {
          observer.error(new Error(`HTTP ${response.status}`));
          return;
        }

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();

        const read = () => {
          reader.read().then(({ done, value }) => {
            if (done) {
              observer.complete();
              return;
            }

            const text = decoder.decode(value);
            const lines = text.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                  observer.complete();
                  return;
                }
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.type === 'sources') {
                    observer.next({ type: 'sources', data: parsed.data });
                  } else {
                    observer.next({ type: 'token', data: parsed.content || '' });
                  }
                } catch {
                  observer.next({ type: 'token', data: data });
                }
              }
            }
            read();
          });
        };
        read();
      }).catch(err => observer.error(err));

      return () => eventSource.close();
    });
  }
}
