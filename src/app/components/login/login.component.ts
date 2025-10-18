import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  Validators,
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
} from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';

interface LoginForm {
  username: FormControl<string>;
  password: FormControl<string>;
  remember: FormControl<boolean>;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
})
export class LoginComponent {
  form: FormGroup<LoginForm>;
  showPassword = false;
  loading = false;
  error = '';

  constructor(
    private fb: NonNullableFormBuilder,
    private auth: AuthService,
    private router: Router
  ) {
    this.form = this.fb.group({
      username: this.fb.control('', { validators: [Validators.required] }),
      password: this.fb.control('', {
        validators: [Validators.required, Validators.minLength(4)],
      }),
      remember: this.fb.control(true),
    });

    const last = localStorage.getItem('last_username');
    if (last) this.form.patchValue({ username: last });
  }

  get c() {
    return this.form.controls;
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  login() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { username, password, remember } = this.form.getRawValue();
    this.loading = true;
    this.error = '';

    this.auth
      .login(username, password)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: () => {
          if (remember) localStorage.setItem('last_username', username);
          else localStorage.removeItem('last_username');
          this.router.navigate(['/items']);
        },
        error: (err) => {
          console.error('Login error:', err);
          const msg = Array.isArray(err?.error?.message)
            ? err.error.message.join(', ')
            : err?.error?.message || err?.message || 'Login failed';
          this.error = msg;
        },
      });
  }
}
