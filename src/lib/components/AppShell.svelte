<script lang="ts">
  let { title = 'GateQR', userEmail = '', children, showSidebar = false, userRole = 'osa' } = $props();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  const osaActions = [
    {
      label: 'OSA Dashboard',
      href: '/osa/dashboard',
      icon: `<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><line x1="10" y1="17" x2="10" y2="17"/>`,
      description: 'View dashboard and statistics'
    },
    {
      label: 'Manage Applications',
      href: '/osa',
      icon: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>`,
      description: 'Review and process vehicle registrations'
    },
    {
      label: 'Add Admin',
      href: '/osa/admin',
      icon: `<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`,
      description: 'Create new admin accounts'
    },
    {
      label: 'Departments',
      href: '/osa/departments',
      icon: `<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>`,
      description: 'Manage college departments'
    },
    {
      label: 'Dean Management',
      href: '/osa/deans',
      icon: `<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>`,
      description: 'Manage dean accounts and assignments'
    }
  ];

  const securityActions = [
    {
      label: 'Dashboard',
      href: '/security/dashboard',
      icon: `<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><line x1="10" y1="17" x2="10" y2="17"/>`,
      description: 'View security dashboard and stats'
    },
    {
      label: 'Vehicle Operations',
      href: '/security',
      icon: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>`,
      description: 'Manage registered vehicles'
    },
    {
      label: 'Complaints',
      href: '/security/complaints',
      icon: `<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>`,
      description: 'View and manage complaints'
    }
  ];

  const quickActions = userRole === 'security' ? securityActions : osaActions;
</script>

<!-- Header bar -->
<header class="app-header">
  <div class="header-inner">
    <div class="header-brand">
      <div class="brand-mark">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1"/>
          <rect x="14" y="3" width="7" height="7" rx="1"/>
          <rect x="3" y="14" width="7" height="7" rx="1"/>
          <circle cx="17.5" cy="17.5" r="2.5"/>
        </svg>
      </div>
      <span class="brand-name">GateQR</span>
    </div>
    <div class="header-actions">
      <span class="brand-sub">Liceo de Cagayan University</span>
      <button class="logout-btn" onclick={handleLogout}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
          <polyline points="16 17 21 12 16 7"></polyline>
          <line x1="21" y1="12" x2="9" y2="12"></line>
        </svg>
        Logout
      </button>
      {#if userEmail}
        <span class="logged-email">{userEmail}</span>
      {/if}
    </div>
  </div>
</header>

<!-- Page shell -->
<main class="app-shell">
  {#if showSidebar}
    <aside class="sidebar">
      <div class="sidebar-header">
        <h3>Quick Actions</h3>
      </div>
      <nav class="sidebar-nav">
        {#each quickActions as action}
          <a href={action.href} class="sidebar-link">
            <div class="sidebar-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                {@html action.icon}
              </svg>
            </div>
            <div class="sidebar-content">
              <div class="sidebar-label">{action.label}</div>
              <div class="sidebar-desc">{action.description}</div>
            </div>
          </a>
        {/each}
      </nav>
    </aside>
  {/if}
  <div class="shell-content">
    {@render children()}
  </div>
</main>

<style>
  .app-header {
    background: linear-gradient(135deg, var(--maroon-deep) 0%, var(--maroon-dark) 40%, var(--maroon) 100%);
    border-bottom: 2px solid var(--gold);
    position: sticky;
    top: 0;
    z-index: 50;
  }

  .header-inner {
    max-width: 900px;
    margin: 0 auto;
    padding: 0.75rem 1.25rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .header-brand {
    display: flex;
    align-items: center;
    gap: 0.625rem;
  }

  .brand-mark {
    width: 34px;
    height: 34px;
    background: rgba(255,255,255,0.12);
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
  }

  .brand-name {
    font-size: 1.1rem;
    font-weight: 700;
    color: #fff;
    letter-spacing: -0.02em;
  }

  .brand-sub {
    font-size: 0.7rem;
    color: rgba(255,255,255,0.55);
    font-weight: 400;
    letter-spacing: 0.01em;
    display: none;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .logged-email {
    max-width: 240px;
    overflow: hidden;
    color: rgba(255,255,255,0.8);
    font-size: 0.75rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .logout-btn {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 6px;
    padding: 0.375rem 0.625rem;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
  }

  .logout-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  @media (min-width: 480px) {
    .brand-sub { display: block; }
  }

  @media (max-width: 479px) {
    .header-actions { gap: 0.5rem; }
    .logged-email { max-width: 130px; }
  }

  .app-shell {
    min-height: calc(100vh - 58px);
    padding: 2rem 1.25rem 3rem;
    display: flex;
    gap: 2rem;
  }

  .sidebar {
    width: 300px;
    flex-shrink: 0;
    background: var(--card-bg);
    border: 2px solid var(--maroon);
    border-radius: 12px;
    padding: 1.5rem;
    height: fit-content;
    position: sticky;
    top: 5rem;
    display: block;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  }

  .sidebar-header {
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--border);
  }

  .sidebar-header h3 {
    font-size: 0.875rem;
    font-weight: 700;
    color: var(--maroon);
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .sidebar-nav {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .sidebar-link {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    text-decoration: none;
    transition: all 0.2s;
    min-height: 64px;
  }

  .sidebar-link:hover {
    border-color: var(--maroon);
    transform: translateX(4px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  }

  .sidebar-icon {
    width: 36px;
    height: 36px;
    background: var(--maroon-muted);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--maroon);
    flex-shrink: 0;
  }

  .sidebar-content {
    flex: 1;
    min-width: 0;
  }

  .sidebar-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
  }

  .sidebar-desc {
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .shell-content {
    flex: 1;
    max-width: 900px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  @media (max-width: 1024px) {
    .app-shell {
      flex-direction: column;
    }

    .sidebar {
      width: 100%;
      position: static;
    }
  }
</style>
