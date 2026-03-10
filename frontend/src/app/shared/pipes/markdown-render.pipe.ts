import { Pipe, PipeTransform, SecurityContext } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { inject } from '@angular/core';

/**
 * Converte Markdown para HTML sanitizado.
 * Suporta: bold, italic, código inline, blocos de código, listas, headers.
 * Uso: <div [innerHTML]="message.content | markdownRender"></div>
 */
@Pipe({
  name: 'markdownRender',
  standalone: true,
  pure: true,
})
export class MarkdownRenderPipe implements PipeTransform {
  private sanitizer = inject(DomSanitizer);

  transform(value: string | null | undefined): SafeHtml {
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
      // Links
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      // Quebras de linha
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');

    // Envolve em parágrafo se não tiver tags de bloco
    if (!html.startsWith('<h') && !html.startsWith('<pre') && !html.startsWith('<ul')) {
      html = `<p>${html}</p>`;
    }

    // Wrap li em ul
    html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');

    return this.sanitizer.bypassSecurityTrustHtml(
      this.sanitizer.sanitize(SecurityContext.HTML, html) ?? ''
    );
  }
}
