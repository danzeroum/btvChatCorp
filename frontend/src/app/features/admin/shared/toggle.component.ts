import { Component, forwardRef, Input } from '@angular/core';
import { NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';

@Component({
  selector: 'app-toggle',
  standalone: true,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => ToggleComponent), multi: true }],
  template: `
    <button type="button"
            class="toggle"
            [class.on]="checked"
            [class.disabled]="disabled"
            [attr.aria-checked]="checked"
            [attr.aria-disabled]="disabled"
            role="switch"
            (click)="toggle()"
            [attr.aria-label]="label || 'Toggle'">
      <span class="knob"></span>
    </button>
  `,
  styles: [`
    .toggle {
      display: inline-block;
      width: 34px;
      height: 20px;
      border-radius: 999px;
      background: var(--line);
      position: relative;
      cursor: pointer;
      border: none;
      padding: 0;
      flex-shrink: 0;
      transition: background 0.18s;
    }
    .toggle.on { background: var(--acc); }
    .toggle.disabled { opacity: 0.45; cursor: not-allowed; }
    .knob {
      position: absolute;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: var(--white);
      top: 3px;
      left: 3px;
      transition: left 0.18s;
      box-shadow: 0 1px 3px rgba(28,27,25,.2);
    }
    .toggle.on .knob { left: 17px; }
  `]
})
export class ToggleComponent implements ControlValueAccessor {
  @Input() label = '';
  @Input() disabled = false;

  checked = false;
  private onChange: (v: boolean) => void = () => {};
  private onTouched: () => void = () => {};

  toggle(): void {
    if (this.disabled) return;
    this.checked = !this.checked;
    this.onChange(this.checked);
    this.onTouched();
  }

  writeValue(v: boolean): void { this.checked = !!v; }
  registerOnChange(fn: (v: boolean) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled = d; }
}
