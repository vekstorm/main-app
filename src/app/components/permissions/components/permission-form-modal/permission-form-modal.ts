import { Component, input, output, effect, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';

@Component({
  selector: 'app-permission-form-modal',
  imports: [ReactiveFormsModule],
  templateUrl: './permission-form-modal.html',
  styleUrl: './permission-form-modal.scss',
})
export class PermissionFormModal {
  permission = input<any>(null);
  close = output<void>();
  save = output<any>();

  private fb = inject(FormBuilder);

  form = this.fb.group({
    name: ['', Validators.required],
    description: [''],
  });

  constructor() {
    effect(() => {
      const p = this.permission();
      if (p) {
        this.form.patchValue({
          name: p.name || '',
          description: p.description || '',
        });
      } else {
        this.form.reset();
      }
    });
  }

  onSave(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.value;
    const payload: any = { name: v.name };
    if (v.description) payload.description = v.description;
    this.save.emit(payload);
  }
}
