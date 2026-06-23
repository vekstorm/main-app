import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { RoleFormModal } from './components/role-form-modal/role-form-modal';

@Component({
  selector: 'app-roles',
  imports: [CommonModule, FormsModule, RoleFormModal],
  templateUrl: './roles.html',
  styleUrl: './roles.scss',
})
export class Roles implements OnInit {
  private api = inject(ApiService);

  roles = signal<any[]>([]);
  currentPage = signal(0);
  totalPages = signal(0);
  totalElements = signal(0);
  search = signal('');
  loading = signal(false);

  editRole = signal<any | null>(null);
  showModal = signal(false);

  allPermissions = signal<any[]>([]);

  ngOnInit(): void {
    this.loadRoles();
    this.loadPermissions();
  }

  loadRoles(): void {
    this.loading.set(true);
    this.api.getRoles(this.search(), this.currentPage(), 10).then(
      (res) => {
        this.roles.set(res.content);
        this.totalPages.set(res.totalPages);
        this.totalElements.set(res.totalElements);
        this.currentPage.set(res.number);
        this.loading.set(false);
      },
      () => this.loading.set(false)
    );
  }

  loadPermissions(): void {
    this.api.getAllPermissions().then(
      (res: any) => this.allPermissions.set(res.content || res),
      () => { }
    );
  }

  onSearch(value: string): void {
    this.search.set(value);
    this.currentPage.set(0);
    this.loadRoles();
  }

  goToPage(page: number): void {
    if (page < 0 || page >= this.totalPages()) return;
    this.currentPage.set(page);
    this.loadRoles();
  }

  openAddModal(): void {
    this.editRole.set(null);
    this.loadPermissions();
    this.showModal.set(true);
  }

  openEditModal(role: any): void {
    this.editRole.set(role);
    this.loadPermissions();
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.editRole.set(null);
  }

  saveRole(payload: any): void {
    const request = this.editRole()
      ? this.api.updateRole(this.editRole()!.id, payload)
      : this.api.createRole(payload);

    request.then(
      () => {
        this.closeModal();
        this.loadRoles();
      },
      (err: any) => console.error('Error saving role', err)
    );
  }

  deleteRole(role: any): void {
    if (!confirm(`Delete role "${role.name}"?`)) return;
    this.api.deleteRole(role.id).then(
      () => this.loadRoles(),
      (err: any) => alert('Error deleting role. Role is possibly assigned to any user/s.')
    );
  }
}
