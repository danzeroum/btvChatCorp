/**
 * Gera UUID v4 sem depender de crypto.randomUUID,
 * que só funciona em contexto seguro (HTTPS ou localhost).
 */
export function genId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}
