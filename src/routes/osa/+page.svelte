<script lang="ts">
    import AppShell from '$lib/components/AppShell.svelte';
    import NavBar from '$lib/components/NavBar.svelte';
    import TabBar from '$lib/components/TabBar.svelte';
    import ApplicationCard from '$lib/components/ApplicationCard.svelte';
    import ActionBar from '$lib/components/ActionBar.svelte';
    import { invalidateAll } from '$app/navigation';

    let { data } = $props();
    let apps = $derived((data.applications as any[]) || []);

    let tab = $state('validation');
    const tabs = ['validation', 'distribution', 'monitoring', 'history'];
    const navLinks = [
        { label: 'Applications', href: '/osa' },
        { label: 'Add Admin', href: '/osa/admin' },
        { label: 'Departments', href: '/osa/departments' }
    ];

    let searchQuery = $state('');
    
    const allRoles = ['student', 'employee', 'visitor', 'concessionaire', 'guest'];
    let selectedRoles = $state([...allRoles]);
    let roleDropdownOpen = $state(false);

    let selectedCampus = $state('all');

    function toggleRole(role: string) {
        if (selectedRoles.includes(role)) {
            selectedRoles = selectedRoles.filter(r => r !== role);
        } else {
            selectedRoles = [...selectedRoles, role];
        }
    }
    
    function getRoleDropdownLabel() {
        if (selectedRoles.length === allRoles.length) return 'All Roles';
        if (selectedRoles.length === 0) return 'No Roles';
        if (selectedRoles.length === 1) return selectedRoles[0].charAt(0).toUpperCase() + selectedRoles[0].slice(1);
        return `${selectedRoles.length} Roles`;
    }

    function clickOutside(node: HTMLElement, callback: () => void) {
        const handleClick = (e: MouseEvent) => {
            if (node && !node.contains(e.target as Node) && !e.defaultPrevented) {
                callback();
            }
        };
        document.addEventListener('click', handleClick, true);
        return {
            destroy() {
                document.removeEventListener('click', handleClick, true);
            }
        };
    }

    $effect(() => {
        document.cookie = `osa_active_tab=${tab}; path=/osa; max-age=31536000; SameSite=Lax`;
    });

    let displayedApps = $derived.by(() => {
        let filtered = apps;

        if (tab === 'validation') filtered = filtered.filter(a => (a.status || '').toLowerCase() === 'dept_val' || (a.status || '').toLowerCase() === 'osa_val');
        else if (tab === 'distribution') filtered = filtered.filter(a => (a.status || '').toLowerCase() === 'distributed' && !a.osa_dist_at);
        else if (tab === 'monitoring') filtered = filtered.filter(a => (a.status || '').toLowerCase() === 'distributed' && a.osa_dist_at);
        else filtered = filtered.filter(a => ['rejected', 'revoked', 'expired'].includes((a.status || '').toLowerCase()));

        console.log('Filtered apps for tab', tab, ':', filtered.length, 'out of', apps.length);
        console.log('All apps before filtering:', apps.map(a => ({ id: a.id, status: a.status, role: a.role, campus: a.campus })));

        if (selectedRoles.length !== allRoles.length) {
            filtered = filtered.filter(a => a.role && selectedRoles.includes(a.role.toLowerCase()));
        }

        if (selectedCampus !== 'all') {
            filtered = filtered.filter(a => a.campus && a.campus.toLowerCase() === selectedCampus.toLowerCase());
        }

        if (searchQuery) {
            const terms = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
            filtered = filtered.filter(a => {
                const fullString = Object.values(a)
                    .filter(val => val !== null && val !== undefined)
                    .map(val => String(val).toLowerCase())
                    .join(' ');
                return terms.every(term => fullString.includes(term));
            });
        }

        return filtered;
    });

    let scheduleModalOpen = $state(false);
    let selectedSchedule = $state('');
    let pendingAction = $state<{ id: number; action: string; resolve: () => void } | null>(null);
    let confirmLoading = $state(false);

    async function handleAction(registration_id: number, action: string) {
        if (action === 'accept') {
            // Return a promise that stays pending until the modal resolves or is cancelled.
            // This keeps ActionBar's loadingAction active (spinner + disabled) the whole time.
            return new Promise<void>((resolve) => {
                pendingAction = { id: registration_id, action, resolve };
                scheduleModalOpen = true;
            });
        }

        let reason: string | null = '';
        if (action === 'reject' || action === 'revoke') {
            reason = prompt(`Please provide a reason to ${action}:`);
            if (reason === null) return;
        } else if (action === 'delete' || action === 'unrevoke') {
            if (!confirm(`Are you sure you want to ${action} this application?`)) return;
        }

        await submitAction(registration_id, action, reason);
    }

    async function submitSchedule() {
        if (!selectedSchedule) {
            alert('Please select a schedule');
            return;
        }
        if (pendingAction) {
            confirmLoading = true;
            try {
                await submitAction(pendingAction.id, pendingAction.action, '', selectedSchedule);
            } finally {
                confirmLoading = false;
                scheduleModalOpen = false;
                pendingAction.resolve(); // release ActionBar's loadingAction
            }
        }
        pendingAction = null;
        selectedSchedule = '';
    }

    function cancelSchedule() {
        if (confirmLoading) return;
        scheduleModalOpen = false;
        pendingAction?.resolve(); // release ActionBar so the button re-enables
        pendingAction = null;
        selectedSchedule = '';
    }

    async function submitAction(registration_id: number, action: string, reason: string = '', schedule: string = '') {
        try {
            const res = await fetch('/api/osa/applications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ registration_id, action, reason, schedule })
            });

            if (res.ok) {
                await invalidateAll();
            } else {
                const err = await res.json();
                alert(err.error || 'Action failed');
            }
        } catch (e) {
            alert('Network error');
        }
    }
</script>

<svelte:head>
  <title>Applications — OSA | GateQR</title>
  <meta name="description" content="Manage vehicle sticker applications at the Office of Student Affairs." />
</svelte:head>

<AppShell userEmail={data.userEmail} showSidebar={true}>
  <NavBar title="Applications" links={navLinks} />

  <div class="applications-container">
    <div class="page-header">
      <div class="header-content">
        <h1>Manage Application</h1>
        <p class="header-subtitle">Review and process vehicle registration applications</p>
      </div>
      <div class="header-stats">
        <div class="stat-badge">
          <span class="stat-value">{displayedApps.length}</span>
          <span class="stat-label">Showing</span>
        </div>
        <div class="stat-badge">
          <span class="stat-value">{apps.length}</span>
          <span class="stat-label">Total</span>
        </div>
      </div>
    </div>

    <TabBar {tabs} active={tab} onchange={(t) => tab = t} />

    <div class="filters-section">
      <div class="search-container">
        <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          type="text"
          placeholder="Search by name, plate, vehicle..."
          bind:value={searchQuery}
          class="search-input"
        />
        {#if searchQuery}
          <button class="search-clear" onclick={() => { searchQuery = ''; }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        {/if}
      </div>

      <div class="filter-group">
        <div class="dropdown-wrap" use:clickOutside={() => roleDropdownOpen = false}>
          <button class="filter-btn dropdown-btn" onclick={() => roleDropdownOpen = !roleDropdownOpen}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            </svg>
            {getRoleDropdownLabel()}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          {#if roleDropdownOpen}
            <div class="dropdown-menu">
              {#each allRoles as role}
                <label class="dropdown-item">
                  <input type="checkbox" checked={selectedRoles.includes(role)} onchange={() => toggleRole(role)} />
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </label>
              {/each}
            </div>
          {/if}
        </div>

        <select bind:value={selectedCampus} class="filter-btn">
          <option value="all">All Campuses</option>
          <option value="Liceo Main">Liceo Main</option>
          <option value="RNP">RNP</option>
          <option value="PASEO">PASEO</option>
        </select>
      </div>
    </div>

    <div class="applications-list">
      {#each displayedApps as app}
        <ApplicationCard data={{
          id: app.id || '-',
          name: `${app.first_name} ${app.last_name}`,
          role: app.role,
          campus: app.campus,
          'year level': app.year_level || '-',
          email: app.user_email,
          contact: app.contact_number,
          facebook: app.facebook || '-',
          department: app.department_name || '-',
          'dept. email': app.department_email || '-',
          vehicle: app.vehicle_make,
          'vehicle type': app.vehicle_type,
          plate: app.vehicle_plate,
          owner: app.is_owner ? 'Yes' : 'No',
          status: app.status,
          crd: app.created_at,
          sgn: app.dept_val_at,
          apv: app.osa_val_at,
          sch: app.dist_sched,
          exp: app.expires_at,
          dlv: app.osa_dist_at,
          rejection_reason: app.invalid_reason || null,
          documents: {
            id: app.doc_id,
            enrollment: app.doc_load,
            or: app.doc_or,
            cr: app.doc_cr,
            license: app.doc_license,
            letter: app.doc_letter
          }
        }} showQR={app.qr_code != null}>
          {#snippet children()}
            {#if app.qr_code}
              <div class="card-qr">
                <img src={app.qr_code} alt="QR" width="100"/>
                <a href={app.qr_code} download>Download</a>
              </div>
            {/if}
            <ActionBar {tab} status={app.status} expiresAt={app.expires_at} onaction={(action) => handleAction(app.id, action)} />
          {/snippet}
        </ApplicationCard>
      {:else}
        <div class="empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="12" y1="18" x2="12" y2="12"/>
            <line x1="9" y1="15" x2="15" y2="15"/>
          </svg>
          <h3>No applications found</h3>
          <p>There are no applications matching your current filters.</p>
          <button class="clear-filters-btn" onclick={() => { searchQuery = ''; selectedRoles = [...allRoles]; selectedCampus = 'all'; }}>
            Clear all filters
          </button>
        </div>
      {/each}
    </div>
  </div>

  {#if scheduleModalOpen}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-overlay" onclick={() => { if (!confirmLoading) cancelSchedule(); }} onkeydown={(e) => { if (e.key === 'Escape' && !confirmLoading) cancelSchedule(); }} role="dialog" aria-modal="true" tabindex="-1">
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="modal-content" onclick={(e) => e.stopPropagation()}>
        <h3>Schedule Sticker Pickup</h3>
        <p>Please select a date and time for the applicant to visit OSA.</p>
        <input type="datetime-local" bind:value={selectedSchedule} class="sched-input" disabled={confirmLoading} />
        <div class="modal-actions">
          <button class="btn-cancel" onclick={cancelSchedule} disabled={confirmLoading}>Cancel</button>
          <button class="btn-confirm" onclick={submitSchedule} disabled={confirmLoading} class:btn-confirming={confirmLoading}>
            {#if confirmLoading}
              <svg class="modal-spinner" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="2.5" stroke-dasharray="35 15" stroke-linecap="round"/>
              </svg>
              Confirming…
            {:else}
              Confirm Schedule
            {/if}
          </button>
        </div>
      </div>
    </div>
  {/if}
</AppShell>

<style>
  .applications-container {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 0.5rem;
  }

  .header-content h1 {
    font-size: 1.75rem;
    font-weight: 700;
    margin: 0 0 0.5rem 0;
    color: var(--text-primary);
  }

  .header-subtitle {
    font-size: 0.9rem;
    color: var(--text-secondary);
    margin: 0;
  }

  .header-stats {
    display: flex;
    gap: 0.75rem;
  }

  .stat-badge {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.75rem 1rem;
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 12px;
    min-width: 60px;
  }

  .stat-value {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--maroon);
    line-height: 1;
  }

  .stat-label {
    font-size: 0.7rem;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-top: 0.25rem;
  }

  .filters-section {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
    padding: 1rem;
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 12px;
  }

  .search-container {
    position: relative;
    flex: 1;
    min-width: 250px;
    display: flex;
    align-items: center;
  }

  .search-icon {
    position: absolute;
    left: 1rem;
    color: var(--text-dim);
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    padding: 0.75rem 2.5rem 0.75rem 2.5rem;
    border: 1.5px solid var(--border);
    border-radius: 10px;
    background: var(--surface);
    color: var(--text);
    font-size: 0.875rem;
    font-family: inherit;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .search-input:focus {
    border-color: var(--maroon);
    box-shadow: 0 0 0 3px rgba(107, 26, 42, 0.1);
  }

  .search-clear {
    position: absolute;
    right: 0.75rem;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--text-dim);
    padding: 0.25rem;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s, background 0.2s;
  }

  .search-clear:hover {
    color: var(--text);
    background: var(--surface-hover);
  }

  .filter-group {
    display: flex;
    gap: 0.75rem;
    align-items: center;
  }

  .filter-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border: 1.5px solid var(--border);
    border-radius: 10px;
    background: var(--surface);
    color: var(--text);
    font-size: 0.875rem;
    font-family: inherit;
    outline: none;
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s;
  }

  .filter-btn:hover {
    border-color: var(--maroon);
    background: var(--maroon-muted);
  }

  .filter-btn:focus {
    border-color: var(--maroon);
    box-shadow: 0 0 0 3px rgba(107, 26, 42, 0.1);
  }

  .dropdown-wrap {
    position: relative;
  }

  .dropdown-btn {
    min-width: 150px;
    justify-content: space-between;
  }

  .dropdown-menu {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    background: var(--surface);
    border: 1.5px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    padding: 0.5rem;
    z-index: 100;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 150px;
  }

  .dropdown-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: var(--text);
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 6px;
    transition: background 0.15s;
  }

  .dropdown-item:hover {
    background: var(--surface-hover);
  }

  .applications-list {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .empty-state {
    text-align: center;
    padding: 4rem 2rem;
    background: var(--card-bg);
    border: 2px dashed var(--border);
    border-radius: 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .empty-state svg {
    color: var(--text-dim);
    margin-bottom: 0.5rem;
  }

  .empty-state h3 {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }

  .empty-state p {
    font-size: 0.9rem;
    color: var(--text-secondary);
    margin: 0;
  }

  .clear-filters-btn {
    padding: 0.75rem 1.5rem;
    background: var(--maroon);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s, transform 0.2s;
  }

  .clear-filters-btn:hover {
    background: var(--maroon-light);
    transform: translateY(-1px);
  }

  .card-qr {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px dashed var(--border-light);
  }

  .modal-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal-content {
    background: var(--surface);
    padding: 1.5rem;
    border-radius: 16px;
    width: 90%;
    max-width: 400px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.2);
  }

  .modal-content h3 {
    margin-top: 0;
    color: var(--maroon);
    margin-bottom: 0.5rem;
    font-size: 1.125rem;
  }

  .modal-content p {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin-bottom: 0.5rem;
  }

  .sched-input {
    width: 100%;
    padding: 0.75rem;
    margin: 1rem 0;
    border: 1.5px solid var(--border);
    border-radius: 8px;
    font-family: inherit;
    font-size: 0.875rem;
  }

  .sched-input:focus {
    outline: none;
    border-color: var(--maroon);
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
  }

  .btn-cancel, .btn-confirm {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.625rem 1.25rem;
    border-radius: 8px;
    cursor: pointer;
    border: none;
    font-weight: 600;
    font-family: inherit;
    font-size: 0.875rem;
    transition: opacity 0.15s, transform 0.15s;
  }

  .btn-cancel {
    background: var(--surface);
    border: 1.5px solid var(--border);
    color: var(--text-primary);
  }

  .btn-cancel:hover {
    background: var(--surface-hover);
  }

  .btn-cancel:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-confirm {
    background: var(--maroon);
    color: white;
  }

  .btn-confirm:hover {
    background: var(--maroon-light);
    transform: translateY(-1px);
  }

  .btn-confirm:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .btn-confirming {
    cursor: wait !important;
  }

  .modal-spinner {
    width: 14px;
    height: 14px;
    animation: spin 0.75s linear infinite;
    flex-shrink: 0;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @media (max-width: 768px) {
    .page-header {
      flex-direction: column;
    }

    .filters-section {
      flex-direction: column;
      align-items: stretch;
    }

    .filter-group {
      flex-direction: column;
    }

    .filter-btn {
      width: 100%;
      justify-content: center;
    }

    .dropdown-btn {
      justify-content: center;
    }
  }
</style>