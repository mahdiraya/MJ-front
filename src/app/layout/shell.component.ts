import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  Router,
  NavigationEnd,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './shell.component.html',
  styleUrls: ['./shell.component.css'],
})
export class ShellComponent {
  isCollapsed = this.readCollapsed();
  isMobile = window.innerWidth < 900;
  mobileOpen = false;

  constructor(private auth: AuthService, private router: Router) {
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationEnd && this.isMobile) this.mobileOpen = false;
    });
  }

  @HostListener('window:resize')
  onResize() {
    const nowMobile = window.innerWidth < 900;
    if (nowMobile !== this.isMobile) {
      this.isMobile = nowMobile;
      if (!this.isMobile) this.mobileOpen = false;
    }
  }

  toggleDrawer() {
    // if (this.isMobile) {
    //   this.mobileOpen = !this.mobileOpen;
    // } else {
    this.isCollapsed = !this.isCollapsed;
    localStorage.setItem('drawer_collapsed', JSON.stringify(this.isCollapsed));
  }
  // }

  logout() {
    this.auth.logout();
    if (this.isMobile) this.mobileOpen = false;
  }

  private readCollapsed(): boolean {
    try {
      return JSON.parse(localStorage.getItem('drawer_collapsed') || 'false');
    } catch {
      return false;
    }
  }
}
