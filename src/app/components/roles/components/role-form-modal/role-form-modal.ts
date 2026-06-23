import { Component, input, output, signal, effect, inject } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';

@Component({
  selector: 'app-role-form-modal',
  imports: [FormsModule, ReactiveFormsModule],
  templateUrl: './role-form-modal.html',
  styleUrl: './role-form-modal.scss',
})
export class RoleFormModal {
  role = input<any>(null);
  allPermissions = input<any[]>([]);
  close = output<void>();
  save = output<any>();

  private fb = inject(FormBuilder);

  form = this.fb.group({
    name: ['', Validators.required],
    description: [''],
  });

  selectedPermissions = signal<string[]>([]);
  dropdownOpen = signal(false);
  permSearch = signal('');

  constructor() {
    effect(() => {
      const r = this.role();
      if (r) {
        this.form.patchValue({
          name: r.name || '',
          description: r.description || '',
        });
        this.selectedPermissions.set(r.permissions || []);
      } else {
        this.form.reset();
        this.selectedPermissions.set([]);
      }
    });
  }

  toggleDropdown(): void {
    this.dropdownOpen.update((v) => !v);
    if (this.dropdownOpen()) {
      this.permSearch.set('');
    }
  }

  togglePermission(permName: string): void {
    this.selectedPermissions.update((list) =>
      list.includes(permName) ? list.filter((p) => p !== permName) : [...list, permName]
    );
  }

  filteredPermissions(): any[] {
    const s = this.permSearch().toLowerCase();
    return this.allPermissions().filter((p: any) => p.name?.toLowerCase().includes(s));
  }

  onSave(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.value;
    this.save.emit({
      name: v.name,
      description: v.description || undefined,
      permissions: this.selectedPermissions(),
    });
  }
}
