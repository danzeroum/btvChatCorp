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

  // Sentinela da Private Use Area (U+E000): nunca aparece em texto real e não é
  // tocada por nenhuma das regras de markdown abaixo. Usada para "proteger"
  // trechos de código das transformações de bold/italic/quebra-de-linha.
  private static readonly M = '';

  transform(value: string | null | undefined): string {
    if (!value) return '';

    const M = MarkdownRenderPipe.M;
    const codeBlocks: string[] = [];
    const inlineCodes: string[] = [];
    const escapeHtml = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    let html = value;

    // 1. Extrai PRIMEIRO os blocos de código cercados (```lang\n...```) e os
    //    substitui por placeholders, para que NÃO sofram as transformações de
    //    bold/italic/quebra-de-linha abaixo (que corromperiam o código). A
    //    linguagem opcional vira class="language-x" (pronta p/ highlight.js).
    html = html.replace(
      /```(\w+)?[ \t]*\r?\n?([\s\S]*?)```/g,
      (_m, lang: string | undefined, code: string) => {
        const cls = lang ? ` class="language-${lang.toLowerCase()}"` : '';
        const idx = codeBlocks.length;
        codeBlocks.push(`<pre><code${cls}>${escapeHtml(code.replace(/\n$/, ''))}</code></pre>`);
        return `${M}CB${idx}${M}`;
      },
    );

    // 2. Código inline (`code`) — também extraído antes das demais regras.
    html = html.replace(/`([^`]+)`/g, (_m, code: string) => {
      const idx = inlineCodes.length;
      inlineCodes.push(`<code>${escapeHtml(code)}</code>`);
      return `${M}IC${idx}${M}`;
    });

    html = html
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

    // Envolve em parágrafo se não começar com tag de bloco / bloco de código
    if (!html.startsWith('<h') && !html.startsWith('<pre') &&
        !html.startsWith('<ul') && !html.startsWith(`${M}CB`)) {
      html = `<p>${html}</p>`;
    }

    // Wrap li em ul
    html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');

    // 3. Reinsere os trechos de código já formatados (após todas as transformações).
    html = html.replace(new RegExp(`${M}CB(\\d+)${M}`, 'g'), (_m, i: string) => codeBlocks[+i] ?? '');
    html = html.replace(new RegExp(`${M}IC(\\d+)${M}`, 'g'), (_m, i: string) => inlineCodes[+i] ?? '');

    // Sem bypass: Angular sanitiza o HTML e o binding [innerHTML] re-sanitiza.
    return this.sanitizer.sanitize(SecurityContext.HTML, html) ?? '';
  }
}
