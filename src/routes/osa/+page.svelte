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

    // Schedule filter state for distribution tab
    let scheduleDropdownOpen = $state(false);
    let selectedScheduleDate = $state<string | null>(null);
    let schedulePanelOpen = $state(false);

    // Bulk selection state
    let selectedApplicationIds = $state<Set<number>>(new Set());
    let bulkActionModalOpen = $state(false);
    let bulkActionType = $state<'accept' | 'reject' | null>(null);
    let bulkSchedule = $state('');
    let bulkReason = $state('');
    let bulkLoading = $state(false);

    // Detailed scheduling state for bulk actions
    let scheduleDay = $state('');
    let scheduleMonth = $state('');
    let scheduleYear = $state('');
    let scheduleHour = $state('');
    let scheduleMinute = $state('00');
    let scheduleAmPm = $state('AM');

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

    // Bulk selection functions
    function toggleSelection(id: number, selected: boolean) {
        if (selected) {
            selectedApplicationIds = new Set([...selectedApplicationIds, id]);
        } else {
            selectedApplicationIds = new Set([...selectedApplicationIds].filter(x => x !== id));
        }
    }

    function selectAll() {
        displayedApps.forEach(app => selectedApplicationIds.add(app.id));
    }

    function deselectAll() {
        selectedApplicationIds.clear();
    }

    function isAllSelected() {
        return displayedApps.length > 0 && displayedApps.every(app => selectedApplicationIds.has(app.id));
    }

    function isSomeSelected() {
        return displayedApps.some(app => selectedApplicationIds.has(app.id));
    }

    async function handleBulkAction(action: 'accept' | 'reject') {
        if (selectedApplicationIds.size === 0) {
            alert('Please select at least one application');
            return;
        }
        bulkActionType = action;
        bulkActionModalOpen = true;
    }

    async function submitBulkAction() {
        if (selectedApplicationIds.size === 0) return;

        bulkLoading = true;
        try {
            const ids = Array.from(selectedApplicationIds);

            // Convert detailed schedule to datetime format for accept action
            let scheduleDateTime = null;
            if (bulkActionType === 'accept' && scheduleMonth && scheduleDay && scheduleYear && scheduleHour && scheduleMinute) {
                const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                const monthIndex = monthNames.indexOf(scheduleMonth);
                const hour24 = scheduleAmPm === 'PM' ? (parseInt(scheduleHour) % 12) + 12 : parseInt(scheduleHour) % 12;
                const date = new Date(parseInt(scheduleYear), monthIndex, parseInt(scheduleDay), hour24, parseInt(scheduleMinute));
                scheduleDateTime = date.toISOString();
            }

            const res = await fetch('/api/osa/bulk-actions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    registration_ids: ids,
                    action: bulkActionType,
                    schedule: bulkActionType === 'accept' ? scheduleDateTime : null,
                    reason: bulkActionType === 'reject' ? bulkReason : null
                })
            });

            if (res.ok) {
                alert(`Successfully ${bulkActionType === 'accept' ? 'accepted' : 'rejected'} ${ids.length} application(s)`);
                selectedApplicationIds.clear();
                bulkActionModalOpen = false;
                bulkSchedule = '';
                bulkReason = '';
                await invalidateAll();
            } else {
                const data = await res.json();
                alert(`Error: ${data.error || 'Failed to process bulk action'}`);
            }
        } catch (error) {
            alert('Network error during bulk action');
        } finally {
            bulkLoading = false;
        }
    }

    function cancelBulkAction() {
        if (bulkLoading) return;
        bulkActionModalOpen = false;
        bulkActionType = null;
        bulkSchedule = '';
        bulkReason = '';
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

        if (tab === 'distribution' && selectedScheduleDate) {
            filtered = filtered.filter(a => {
                if (!a.dist_sched) return false;
                const appDate = new Date(a.dist_sched).toDateString();
                const selectedDate = new Date(selectedScheduleDate).toDateString();
                return appDate === selectedDate;
            });
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

    // Get unique scheduled dates for distribution tab
    let scheduledDates = $derived.by(() => {
        if (tab !== 'distribution') return [];
        const distributionApps = apps.filter(a => 
            (a.status || '').toLowerCase() === 'distributed' && 
            !a.osa_dist_at && 
            a.dist_sched
        );
        const uniqueDates = new Set<string>();
        distributionApps.forEach(app => {
            if (app.dist_sched) {
                const date = new Date(app.dist_sched).toDateString();
                uniqueDates.add(date);
            }
        });
        return Array.from(uniqueDates).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    });

    let scheduleModalOpen = $state(false);
    let selectedSchedule = $state('');
    let pendingAction = $state<{ id: number; action: string; resolve: () => void } | null>(null);
    let confirmLoading = $state(false);

    // Detailed scheduling state for single application
    let singleScheduleDay = $state('');
    let singleScheduleMonth = $state('');
    let singleScheduleYear = $state('');
    let singleScheduleHour = $state('');
    let singleScheduleMinute = $state('00');
    let singleScheduleAmPm = $state('AM');

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
        // Convert detailed schedule to datetime format
        let scheduleDateTime = null;
        if (singleScheduleMonth && singleScheduleDay && singleScheduleYear && singleScheduleHour && singleScheduleMinute) {
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
            const monthIndex = monthNames.indexOf(singleScheduleMonth);
            const hour24 = singleScheduleAmPm === 'PM' ? (parseInt(singleScheduleHour) % 12) + 12 : parseInt(singleScheduleHour) % 12;
            const date = new Date(parseInt(singleScheduleYear), monthIndex, parseInt(singleScheduleDay), hour24, parseInt(singleScheduleMinute));
            scheduleDateTime = date.toISOString();
        }

        if (!scheduleDateTime) {
            alert('Please select a complete schedule');
            return;
        }
        if (pendingAction) {
            confirmLoading = true;
            try {
                await submitAction(pendingAction.id, pendingAction.action, '', scheduleDateTime);
            } finally {
                confirmLoading = false;
                scheduleModalOpen = false;
                pendingAction.resolve(); // release ActionBar's loadingAction
            }
        }
        pendingAction = null;
        selectedSchedule = '';
        singleScheduleMonth = '';
        singleScheduleDay = '';
        singleScheduleYear = '';
        singleScheduleHour = '';
        singleScheduleMinute = '00';
        singleScheduleAmPm = 'AM';
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

        {#if tab === 'distribution'}
          <button class="filter-btn schedule-btn" onclick={() => schedulePanelOpen = !schedulePanelOpen} class:active={schedulePanelOpen}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            Schedule
          </button>
        {/if}
      </div>
    </div>

    <div class="content-layout">
      <div class="applications-list" class:with-schedule-panel={schedulePanelOpen && tab === 'distribution'}>
      {#each displayedApps as app}
        <ApplicationCard
          data={{
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
          color: app.vehicle_color,
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
          qr_code: app.qr_code,
          qr_unique_code: app.qr_unique_code,
          documents: {
            id: app.doc_id,
            enrollment: app.doc_load,
            or: app.doc_or,
            cr: app.doc_cr,
            license: app.doc_license,
            letter: app.doc_letter
          }
        }}
        selectable={tab === 'validation'}
        selected={selectedApplicationIds.has(app.id)}
        onselect={(selected) => toggleSelection(app.id, selected)}
        showQR={app.qr_code != null && tab === 'monitoring'}
        {tab}>
          {#snippet children()}
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
          <button class="clear-filters-btn" onclick={() => { 
            searchQuery = ''; 
            selectedRoles = [...allRoles]; 
            selectedCampus = 'all'; 
            selectedScheduleDate = null; 
          }}>
            Clear all filters
          </button>
        </div>
      {/each}
    </div>

    <!-- Selected Applications Side Table -->
    {#if tab === 'validation' && selectedApplicationIds.size > 0}
      <div class="selected-apps-table">
        <div class="table-header">
          <span class="table-title">Selected Applications</span>
          <span class="table-count">{selectedApplicationIds.size}</span>
        </div>
        <table class="mini-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Department</th>
            </tr>
          </thead>
          <tbody>
            {#each displayedApps.filter(app => selectedApplicationIds.has(app.id)) as app}
              <tr>
                <td>{app.user_email}</td>
                <td>{app.department_name}</td>
              </tr>
            {/each}
          </tbody>
        </table>
        <div class="table-actions">
          <button class="table-btn table-accept" onclick={() => handleBulkAction('accept')}>
            Accept All
          </button>
          <button class="table-btn table-reject" onclick={() => handleBulkAction('reject')}>
            Reject All
          </button>
        </div>
      </div>
    {/if}

    <!-- Schedule Calendar Panel -->
    {#if tab === 'distribution' && schedulePanelOpen}
      <div class="schedule-calendar-panel">
        <div class="table-header">
          <span class="table-title">Scheduled Dates</span>
          <span class="table-count">{scheduledDates.length}</span>
        </div>
        <div class="calendar-list">
          {#if scheduledDates.length > 0}
            {#each scheduledDates as date}
              <div 
                class="calendar-item" 
                class:selected={selectedScheduleDate === date}
                onclick={() => selectedScheduleDate = selectedScheduleDate === date ? null : date}
              >
                <div class="calendar-date">
                  {new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </div>
                <div class="calendar-full-date">
                  {new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
              </div>
            {/each}
          {:else}
            <div class="calendar-empty">
              <p>No scheduled dates found</p>
            </div>
          {/if}
        </div>
        {#if selectedScheduleDate}
          <div class="calendar-actions">
            <button class="table-btn" onclick={() => selectedScheduleDate = null}>
              Clear Filter
            </button>
          </div>
        {/if}
      </div>
    {/if}
  </div>

  {#if scheduleModalOpen}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-overlay" onclick={() => { if (!confirmLoading) cancelSchedule(); }} onkeydown={(e) => { if (e.key === 'Escape' && !confirmLoading) cancelSchedule(); }} role="dialog" aria-modal="true" tabindex="-1">
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="modal-content" onclick={(e) => e.stopPropagation()}>
        <h3>Selected application</h3>
        <p>Set a pickup schedule for this application</p>
        <div class="schedule-form">
          <div class="schedule-row">
            <div class="schedule-field">
              <label class="schedule-label">DATE</label>
              <div class="date-picker-simple">
                <select bind:value={singleScheduleMonth} class="date-select-simple" disabled={confirmLoading}>
                  <option value="">MONTH</option>
                  <option value="January">January</option>
                  <option value="February">February</option>
                  <option value="March">March</option>
                  <option value="April">April</option>
                  <option value="May">May</option>
                  <option value="June">June</option>
                  <option value="July">July</option>
                  <option value="August">August</option>
                  <option value="September">September</option>
                  <option value="October">October</option>
                  <option value="November">November</option>
                  <option value="December">December</option>
                </select>
                <select bind:value={singleScheduleDay} class="date-select-simple" disabled={confirmLoading}>
                  <option value="">DAY</option>
                  {#each Array.from({length: 31}, (_, i) => i + 1) as day}
                    <option value={day}>{day}</option>
                  {/each}
                </select>
                <select bind:value={singleScheduleYear} class="date-select-simple" disabled={confirmLoading}>
                  <option value="">YEAR</option>
                  {#each Array.from({length: 5}, (_, i) => new Date().getFullYear() + i) as year}
                    <option value={year}>{year}</option>
                  {/each}
                </select>
              </div>
            </div>
          </div>
          <div class="schedule-row">
            <div class="schedule-field time-field">
              <label class="schedule-label">TIME</label>
              <div class="time-picker-simple">
                <select bind:value={singleScheduleHour} class="time-select-simple" disabled={confirmLoading}>
                  <option value="">HOUR</option>
                  {#each Array.from({length: 12}, (_, i) => i + 1) as hour}
                    <option value={hour}>{hour}</option>
                  {/each}
                </select>
                <select bind:value={singleScheduleMinute} class="time-select-simple" disabled={confirmLoading}>
                  <option value="">MIN</option>
                  {#each Array.from({length: 60}, (_, i) => i.toString().padStart(2, '0')) as minute}
                    <option value={minute}>{minute}</option>
                  {/each}
                </select>
                <select bind:value={singleScheduleAmPm} class="ampm-select-simple" disabled={confirmLoading}>
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </div>
            </div>
          </div>
        </div>
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

  {#if bulkActionModalOpen}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-overlay" onclick={() => { if (!bulkLoading) cancelBulkAction(); }} onkeydown={(e) => { if (e.key === 'Escape' && !bulkLoading) cancelBulkAction(); }} role="dialog" aria-modal="true" tabindex="-1">
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="modal-content" onclick={(e) => e.stopPropagation()}>
        <h3>Selected application</h3>
        <p>
          {#if bulkActionType === 'accept'}
            Set a pickup schedule for all selected applications
          {:else}
            Provide a reason for rejecting all selected applications.
          {/if}
        </p>

        {#if bulkActionType === 'accept'}
          <div class="schedule-form">
            <div class="schedule-row">
              <div class="schedule-field">
                <label class="schedule-label">DATE</label>
                <div class="date-picker-simple">
                  <select bind:value={scheduleMonth} class="date-select-simple" disabled={bulkLoading}>
                    <option value="">MONTH</option>
                    <option value="January">January</option>
                    <option value="February">February</option>
                    <option value="March">March</option>
                    <option value="April">April</option>
                    <option value="May">May</option>
                    <option value="June">June</option>
                    <option value="July">July</option>
                    <option value="August">August</option>
                    <option value="September">September</option>
                    <option value="October">October</option>
                    <option value="November">November</option>
                    <option value="December">December</option>
                  </select>
                  <select bind:value={scheduleDay} class="date-select-simple" disabled={bulkLoading}>
                    <option value="">DAY</option>
                    {#each Array.from({length: 31}, (_, i) => i + 1) as day}
                      <option value={day}>{day}</option>
                    {/each}
                  </select>
                  <select bind:value={scheduleYear} class="date-select-simple" disabled={bulkLoading}>
                    <option value="">YEAR</option>
                    {#each Array.from({length: 5}, (_, i) => new Date().getFullYear() + i) as year}
                      <option value={year}>{year}</option>
                    {/each}
                  </select>
                </div>
              </div>
            </div>
            <div class="schedule-row">
              <div class="schedule-field time-field">
                <label class="schedule-label">TIME</label>
                <div class="time-picker-simple">
                  <select bind:value={scheduleHour} class="time-select-simple" disabled={bulkLoading}>
                    <option value="">HOUR</option>
                    {#each Array.from({length: 12}, (_, i) => i + 1) as hour}
                      <option value={hour}>{hour}</option>
                    {/each}
                  </select>
                  <select bind:value={scheduleMinute} class="time-select-simple" disabled={bulkLoading}>
                    <option value="">MIN</option>
                    {#each Array.from({length: 60}, (_, i) => i.toString().padStart(2, '0')) as minute}
                      <option value={minute}>{minute}</option>
                    {/each}
                  </select>
                  <select bind:value={scheduleAmPm} class="ampm-select-simple" disabled={bulkLoading}>
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        {:else}
          <div class="form-group">
            <label class="form-label">Rejection Reason</label>
            <textarea bind:value={bulkReason} class="reason-input" placeholder="Enter rejection reason..." disabled={bulkLoading}></textarea>
          </div>
        {/if}

        <div class="modal-actions">
          <button class="btn-cancel" onclick={cancelBulkAction} disabled={bulkLoading}>Cancel</button>
          <button class="btn-confirm" onclick={submitBulkAction} disabled={bulkLoading} class:btn-confirming={bulkLoading}>
            {#if bulkLoading}
              <svg class="modal-spinner" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="2.5" stroke-dasharray="35 15" stroke-linecap="round"/>
              </svg>
              Processing…
            {:else if bulkActionType === 'accept'}
              Accept All
            {:else}
              Reject All
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
  }

  .filter-btn.active {
    background: var(--maroon);
    color: white;
    border-color: var(--maroon);
  }

  .content-layout {
    display: flex;
    gap: 2rem;
    align-items: flex-start;
    width: 100%;
  }

  .applications-list {
    flex: 1;
    min-width: 0;
    max-width: calc(100% - 320px);
  }

  .applications-list.with-schedule-panel {
    max-width: calc(100% - 420px);
  }

  .selected-apps-table {
    width: 380px;
    background: var(--surface);
    border: 2px solid var(--maroon);
    border-radius: 8px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    box-shadow: 0 4px 12px rgba(107, 26, 42, 0.15);
    flex-shrink: 0;
  }

  .table-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--border-light);
  }

  .table-title {
    font-size: 0.875rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .table-count {
    background: var(--maroon);
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 700;
  }

  .mini-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8rem;
  }

  .mini-table thead {
    background: var(--maroon);
    color: white;
  }

  .mini-table th {
    padding: 0.5rem;
    text-align: left;
    font-weight: 600;
    font-size: 0.75rem;
  }

  .mini-table td {
    padding: 0.5rem;
    border-bottom: 1px solid var(--border-light);
    color: var(--text-primary);
  }

  .mini-table tbody tr:last-child td {
    border-bottom: none;
  }

  .table-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: auto;
  }

  .table-btn {
    flex: 1;
    padding: 0.5rem;
    border: none;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .table-accept {
    background: var(--maroon);
    color: white;
  }

  .table-accept:hover {
    background: #8b1a2a;
  }

  .table-reject {
    background: #dc2626;
    color: white;
  }

  .table-reject:hover {
    background: #b91c1c;
  }

  .schedule-calendar-panel {
    width: 380px;
    background: var(--surface);
    border: 2px solid var(--maroon);
    border-radius: 8px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    box-shadow: 0 4px 12px rgba(107, 26, 42, 0.15);
    flex-shrink: 0;
    max-height: calc(100vh - 200px);
    overflow-y: auto;
  }

  .calendar-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .calendar-item {
    padding: 0.75rem;
    border: 1.5px solid var(--border);
    border-radius: 6px;
    background: var(--card-bg);
    cursor: pointer;
    transition: all 0.2s;
  }

  .calendar-item:hover {
    border-color: var(--maroon);
    background: var(--surface-hover);
  }

  .calendar-item.selected {
    border-color: var(--maroon);
    background: rgba(107, 26, 42, 0.1);
  }

  .calendar-date {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .calendar-full-date {
    font-size: 0.75rem;
    color: var(--text-secondary);
    margin-top: 0.25rem;
  }

  .calendar-empty {
    text-align: center;
    padding: 2rem;
    color: var(--text-dim);
  }

  .calendar-empty p {
    margin: 0;
    font-size: 0.875rem;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-label {
    display: block;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.5rem;
  }

  .reason-input {
    width: 100%;
    padding: 0.75rem;
    border: 1.5px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
    color: var(--text);
    font-size: 0.875rem;
    font-family: inherit;
    resize: vertical;
    min-height: 80px;
  }

  .reason-input:focus {
    outline: none;
    border-color: var(--maroon);
    box-shadow: 0 0 0 3px rgba(107, 26, 42, 0.1);
  }

  .schedule-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .schedule-row {
    display: flex;
    gap: 0.75rem;
  }

  .schedule-field {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .schedule-label {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .schedule-select {
    padding: 0.5rem;
    border: 1.5px solid var(--border);
    border-radius: 6px;
    background: var(--surface);
    color: var(--text);
    font-size: 0.875rem;
    font-family: inherit;
    outline: none;
    transition: border-color 0.2s;
  }

  .schedule-select:focus {
    border-color: var(--maroon);
    box-shadow: 0 0 0 3px rgba(107, 26, 42, 0.1);
  }

  .time-picker-simple {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .time-select-simple {
    flex: 1;
    padding: 0.5rem;
    border: 1.5px solid var(--border);
    border-radius: 6px;
    background: var(--surface);
    color: var(--text);
    font-size: 0.875rem;
    font-family: inherit;
    outline: none;
    transition: border-color 0.2s;
    min-width: 60px;
    max-width: 80px;
  }

  .time-select-simple:focus {
    border-color: var(--maroon);
    box-shadow: 0 0 0 3px rgba(107, 26, 42, 0.1);
  }

  .ampm-select-simple {
    padding: 0.5rem;
    border: 1.5px solid var(--border);
    border-radius: 6px;
    background: var(--surface);
    color: var(--text);
    font-size: 0.875rem;
    font-family: inherit;
    outline: none;
    transition: border-color 0.2s;
    min-width: 50px;
    max-width: 60px;
  }

  .ampm-select-simple:focus {
    border-color: var(--maroon);
    box-shadow: 0 0 0 3px rgba(107, 26, 42, 0.1);
  }

  .date-picker-simple {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .date-select-simple {
    flex: 1;
    padding: 0.5rem;
    border: 1.5px solid var(--border);
    border-radius: 6px;
    background: var(--surface);
    color: var(--text);
    font-size: 0.875rem;
    font-family: inherit;
    outline: none;
    transition: border-color 0.2s;
  }

  .date-select-simple:focus {
    border-color: var(--maroon);
    box-shadow: 0 0 0 3px rgba(107, 26, 42, 0.1);
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