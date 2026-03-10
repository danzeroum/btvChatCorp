import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface FeedbackEvent {
  messageId: string;
  rating: 'positive' | 'negative';
  correction: string | null;
  category: string;
}

@Component({
  selector: 'app-feedback-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="feedback-bar">
      <button (click)="quickFeedback('positive')" [class.active]="rating === 'positive'">👍</button>
      <button (click)="quickFeedback('negative')" [class.active]="rating === 'negative'">👎</button>

      @if (showDetails) {
        <div class="feedback-details">
          <p>O que poderia melhorar?</p>
          <div class="categories">
            <label><input type="checkbox" value="factual_error" (change)="toggleCategory($event)"> Informação incorreta</label>
            <label><input type="checkbox" value="incomplete" (change)="toggleCategory($event)"> Resposta incompleta</label>
            <label><input type="checkbox" value="tone" (change)="toggleCategory($event)"> Tom inadequado</label>
            <label><input type="checkbox" value="irrelevant" (change)="toggleCategory($event)"> Não usou o contexto certo</label>
          </div>
          <textarea
            placeholder="Como deveria ser a resposta ideal?"
            [(ngModel)]="correctedText"
            rows="4">
          </textarea>
          <button (click)="submitDetailed()">Enviar feedback</button>
        </div>
      }
    </div>
  `,
})
export class FeedbackPanelComponent {
  @Input() messageId!: string;
  @Output() feedbackSubmitted = new EventEmitter<FeedbackEvent>();

  rating: 'positive' | 'negative' | null = null;
  showDetails = false;
  categories: string[] = [];
  correctedText = '';

  quickFeedback(type: 'positive' | 'negative'): void {
    this.rating = type;
    if (type === 'negative') {
      this.showDetails = true;
    } else {
      this.feedbackSubmitted.emit({
        messageId: this.messageId,
        rating: 'positive',
        correction: null,
        category: 'approved',
      });
    }
  }

  toggleCategory(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.checked) {
      this.categories.push(input.value);
    } else {
      this.categories = this.categories.filter(c => c !== input.value);
    }
  }

  submitDetailed(): void {
    this.feedbackSubmitted.emit({
      messageId: this.messageId,
      rating: 'negative',
      correction: this.correctedText || null,
      category: this.categories.join(','),
    });
    this.showDetails = false;
  }
}
