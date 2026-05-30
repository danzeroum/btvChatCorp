import { Pipe, PipeTransform, SecurityContext } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { inject } from '@angular/core';

/**
 * Converte Markdown para HTML sanitizado.
 * Suporta: bold, italic, código inline, blocos de código, listas, headers.
 * Uso: <div [innerHTML]="message.content | markdownRender"></div>
 *
 * Segurança: NÃO usa bypassSecurityTrustHtml. O HTML gerado é sanitizado e
 * retornado como string — o binding [innerHTML] re-sanitiza automaticamente
 * (defesa em profundidade). URLs de links são restritas a http(s).
 */
@Pipe({
  name: 'markdownRender',
  standalone: true,
  pure: true,
})
export class MarkdownRenderPipe implements PipeTransform {
  private sanitizer = inject(DomSanitizer);

  transform(value: string | null | undefined): string {
    if (!value) return '';

    let html = value
      // Bloco de código (deve vir antes de inline)
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      // Código inline
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // Headers
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      // Bold + italic
      .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
      // Bold
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // Listas não ordenadas
      .replace(/^[\-\*] (.+)$/gm, '<li>$1</li>')
      // Listas ordenadas
      .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
      // Links — só permite http(s); bloqueia javascript:/data: e outros esquemas
      .replace(/\[(.+?)\]\((.+?)\)/g, (_match, text: string, url: string) => {
        const safeUrl = /^https?:\/\//i.test(url.trim()) ? url.trim() : '#';
        return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${text}</a>`;
      })
      // Quebras de linha
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');

    // Envolve em parágrafo se não tiver tags de bloco
    if (!html.startsWith('<h') && !html.startsWith('<pre') && !html.startsWith('<ul')) {
      html = `<p>${html}</p>`;
    }

    // Wrap li em ul
    html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');

    // Sem bypass: Angular sanitiza o HTML e o binding [innerHTML] re-sanitiza.
    return this.sanitizer.sanitize(SecurityContext.HTML, html) ?? '';
  }
}
