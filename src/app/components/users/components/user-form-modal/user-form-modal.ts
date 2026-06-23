import { Component, input, output, signal, effect, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';

@Component({
  selector: 'app-user-form-modal',
  imports: [ReactiveFormsModule],
  templateUrl: './user-form-modal.html',
  styleUrl: './user-form-modal.scss',
})
export class UserFormModal {
  user = input<any>(null);
  allRoles = input<any[]>([]);
  close = output<void>();
  save = output<any>();

  private fb = inject(FormBuilder);

  form = this.fb.group({
    username: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: [''],
    name: [''],
    surname1: [''],
    surname2: [''],
    phone: [''],
    disabled: [false],
  });

  selectedRoles = signal<Record<string, boolean>>({});
  isEdit = signal(false);

  constructor() {
    effect(() => {
      const user = this.user();
      const roles = this.allRoles();
      const map: Record<string, boolean> = {};
      roles.forEach((r: any) => { map[r.name] = false; });
      this.isEdit.set(user !== null);
      if (user && user.roles) {
        user.roles.forEach((r: string) => { if (r in map) map[r] = true; });
      }
      this.selectedRoles.set({...map});
      if (user) {
        this.form.patchValue({
          username: user.username || '',
          email: user.email || '',
          name: user.name || '',
          surname1: user.surname1 || '',
          surname2: user.surname2 || '',
          phone: user.phone || '',
          disabled: !!user.disabled,
        });
        this.form.get('password')?.clearValidators();
      } else {
        this.form.reset({ disabled: false });
        this.form.get('password')?.setValidators(Validators.required);
      }
      this.form.get('password')?.updateValueAndValidity();
    });
  }

  onClose(): void {
    this.close.emit();
  }

  toggleRole(role: string): void {
    this.selectedRoles.update((r) => ({ ...r, [role]: !r[role] }));
  }

  onSave(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const user = this.form.value;
    const roles = Object.keys(this.selectedRoles()).filter((r) => this.selectedRoles()[r]);
    const payload: any = { username: user.username, email: user.email, roles };
    if (user.password) payload.password = user.password;
    if (user.name) payload.name = user.name;
    if (user.surname1) payload.surname1 = user.surname1;
    if (user.surname2) payload.surname2 = user.surname2;
    if (user.phone) payload.phone = user.phone;
    payload.disabled = user.disabled ?? false;
    this.save.emit(payload);
  }
}
