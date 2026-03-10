import { Pipe, PipeTransform } from '@angular/core';

/**
 * Pipe para renderizar Markdown em HTML seguro.
 * Uso: <div [innerHTML]="msg.content | markdownRender"></div>
 */
@Pipe({
  name: 'markdownRender',
  standalone: true,
  pure: true,
})
export class MarkdownRenderPipe implements PipeTransform {

  transform(value: string | null | undefined): string {
    if (!value) return '';
    return this.render(value);
  }

  private render(md: string): string {
    return md
      // Código inline
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // Bold
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      // Heading 3
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      // Heading 2
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      // Heading 1
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      // Bullet list
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      // Quebra de linha dupla = parágrafo
      .replace(/\n\n/g, '</p><p>')
      // Wrap em parágrafo
      .replace(/^(.+)$/, '<p>$1</p>');
  }
}
