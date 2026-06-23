import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { UserFormModal } from './components/user-form-modal/user-form-modal';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-users',
  imports: [CommonModule, FormsModule, UserFormModal],
  templateUrl: './users.html',
  styleUrl: './users.scss',
})
export class Users implements OnInit {
  private api = inject(ApiService);
  private authService = inject(AuthService);

  users = signal<any[]>([]);
  currentPage = signal(0);
  totalPages = signal(0);
  totalElements = signal(0);
  search = signal('');
  loading = signal(false);

  editUser = signal<any | null>(null);
  showModal = signal(false);
  allRoles = signal<any[]>([]);

  ngOnInit(): void {
    this.loadUsers();
  }

  loadRoles(): void {
    this.api.getRoles('', 0, 1000).then(
      (res: any) => this.allRoles.set(res.content || res),
      () => { }
    );
  }

  loadUsers(): void {
    this.loading.set(true);
    this.api.getUsers(this.search(), this.currentPage(), 10).then(
      (res) => {
        this.users.set(res.content);
        this.totalPages.set(res.totalPages);
        this.totalElements.set(res.totalElements);
        this.currentPage.set(res.number);
        this.loading.set(false);
      },
      () => this.loading.set(false)
    );
  }

  onSearch(value: string): void {
    this.search.set(value);
    this.currentPage.set(0);
    this.loadUsers();
  }

  goToPage(page: number): void {
    if (page < 0 || page >= this.totalPages()) return;
    this.currentPage.set(page);
    this.loadUsers();
  }

  openAddModal(): void {
    this.editUser.set(null);
    this.loadRoles();
    this.showModal.set(true);
  }

  openEditModal(user: any): void {
    this.editUser.set(user);
    this.loadRoles();
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.editUser.set(null);
  }

  saveUser(payload: any): void {
    const request = this.editUser()
      ? this.api.updateUser(this.editUser()!.id, payload)
      : this.api.createUser(payload);

    request.then(
      () => {
        this.closeModal();
        this.loadUsers();
      },
      (err: any) => console.error('Error saving user', err)
    );
  }

  resetPassword(user: any): void {
    const newPassword = prompt('Enter new password for ' + user.username);
    if (!newPassword) return;
    this.api.updateUser(user.id, { password: newPassword }).then(
      () => alert('Password reset successfully'),
      (err: any) => console.error('Error resetting password', err)
    );
  }

  deactivateUser(user: any): void {
    const confirmed = confirm(
      user.disabled
        ? `Activate user "${user.username}"?`
        : `Deactivate user "${user.username}"?`
    );
    if (!confirmed) return;
    this.api.updateUser(user.id, { disabled: !user.disabled }).then(
      () => this.loadUsers(),
      (err: any) => console.error('Error updating user status', err)
    );
  }

  deleteUser(user: any): void {
    if (!confirm(`Delete user "${user.username}"?`)) return;
    this.api.deleteUser(user.id).then(
      () => this.loadUsers(),
      (err: any) => console.error('Error deleting user', err)
    );
  }
}
