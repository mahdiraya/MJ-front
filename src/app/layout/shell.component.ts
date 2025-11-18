import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  Router,
  NavigationEnd,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ApiService } from '../services/api.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './shell.component.html',
  styleUrls: ['./shell.component.css'],
})
export class ShellComponent implements OnInit, OnDestroy {
  isCollapsed = this.readCollapsed();
  isMobile = window.innerWidth < 900;
  mobileOpen = false;
  pendingReturns = 0;
  private returnsInterval: any = null;
  private returnsFetchInFlight = false;

  constructor(
    private auth: AuthService,
    private router: Router,
    private api: ApiService
  ) {
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationEnd && this.isMobile) this.mobileOpen = false;
    });
  }

  ngOnInit(): void {
    this.refreshPendingReturns();
    this.returnsInterval = setInterval(() => this.refreshPendingReturns(), 60000);
  }

  ngOnDestroy(): void {
    if (this.returnsInterval) {
      clearInterval(this.returnsInterval);
      this.returnsInterval = null;
    }
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

  private refreshPendingReturns() {
    if (this.returnsFetchInFlight) return;
    this.returnsFetchInFlight = true;
    this.api.listInventoryReturns().subscribe({
      next: (rows) => {
        this.pendingReturns = (rows || []).filter(
          (entry) => entry.status === 'pending'
        ).length;
        this.returnsFetchInFlight = false;
      },
      error: () => {
        this.returnsFetchInFlight = false;
      },
    });
  }
}
