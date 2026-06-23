import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { PermissionFormModal } from './components/permission-form-modal/permission-form-modal';

@Component({
  selector: 'app-permissions',
  imports: [CommonModule, FormsModule, PermissionFormModal],
  templateUrl: './permissions.html',
  styleUrl: './permissions.scss',
})
export class Permissions implements OnInit {
  private api = inject(ApiService);

  permissions = signal<any[]>([]);
  currentPage = signal(0);
  totalPages = signal(0);
  totalElements = signal(0);
  search = signal('');
  loading = signal(false);

  selectedIds = signal<Set<string>>(new Set());

  editPerm = signal<any | null>(null);
  showModal = signal(false);

  ngOnInit(): void {
    this.loadPermissions();
  }

  loadPermissions(): void {
    this.loading.set(true);
    this.api.getPermissions(this.search(), this.currentPage(), 10).then(
      (res) => {
        this.permissions.set(res.content);
        this.totalPages.set(res.totalPages);
        this.totalElements.set(res.totalElements);
        this.currentPage.set(res.number);
        this.selectedIds.set(new Set());
        this.loading.set(false);
      },
      () => this.loading.set(false)
    );
  }

  onSearch(value: string): void {
    this.search.set(value);
    this.currentPage.set(0);
    this.loadPermissions();
  }

  goToPage(page: number): void {
    if (page < 0 || page >= this.totalPages()) return;
    this.currentPage.set(page);
    this.loadPermissions();
  }

  toggleSelect(id: string): void {
    this.selectedIds.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  selectAll(): void {
    this.selectedIds.update((set) => {
      if (set.size === this.permissions().length) {
        return new Set();
      }
      return new Set(this.permissions().map((p) => p.id));
    });
  }

  allSelected(): boolean {
    return this.permissions().length > 0 && this.selectedIds().size === this.permissions().length;
  }

  deleteSelected(): void {
    const ids = Array.from(this.selectedIds());
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} permission(s)?`)) return;
    this.api.deletePermissions(ids).then(
      () => this.loadPermissions(),
      (err: any) => alert('Error deleting permissions. Any selected permission is associated to an existing role?')
    );
  }

  openAddModal(): void {
    this.editPerm.set(null);
    this.showModal.set(true);
  }

  openEditModal(perm: any): void {
    this.editPerm.set(perm);
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.editPerm.set(null);
  }

  savePerm(payload: any): void {
    const request = this.editPerm()
      ? this.api.updatePermission(this.editPerm()!.id, payload)
      : this.api.createPermission(payload);

    request.then(
      () => {
        this.closeModal();
        this.loadPermissions();
      },
      (err: any) => console.error('Error saving permission', err)
    );
  }

  deletePerm(perm: any): void {
    if (!confirm(`Delete permission "${perm.name}"?`)) return;
    this.api.deletePermission(perm.id).then(
      () => this.loadPermissions(),
      (err: any) => alert('Error deleting permissions. Selected permission is associated to an existing role?')
    );
  }
}
