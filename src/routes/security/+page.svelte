<script lang="ts">
    import AppShell from '$lib/components/AppShell.svelte';
    import TabBar from '$lib/components/TabBar.svelte';
    import ApplicationCard from '$lib/components/ApplicationCard.svelte';
    import ActionBar from '$lib/components/ActionBar.svelte';

    let { data } = $props();
    let userRole = $derived(data.userRole || 'security');

    let tab = $state('monitoring');
    const tabs = ['monitoring', 'Vehicle Log', 'History'];

    // ── Vehicle Monitoring ──────────────────────────────────────────────────
    let vehicles = $state(data.vehicles);
    let searchQuery = $state('');
    let vehicleTypeFilter = $state('all'); // 'all', '2-Wheeler / Motorcycle', '4-Wheeler / Car'

    // ── Photo modal ──────────────────────────────────────────────────────────
    let showModal  = $state(false);
    let modalImage = $state('');
    function openPhoto(url: string | null) { if (!url) return; modalImage = url; showModal = true; }

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

    // For History tab - gate logs from vehicle_log table
    let logs = $state<any[]>([]);
    let totalLogs = $state(0);
    let currentPage = $state(1);
    let totalPages = $state(1);
    const pageSize = 25;
    let loading = $state(false);

    let selectedDate  = $state(new Date().toISOString().split('T')[0]);
    let boundFilter   = $state('all');
    let selectedCampus = $state('all');
    
    const allRoles = ['student', 'employee', 'visitor', 'concessionaire', 'guest', 'vip'];
    let selectedRoles = $state([...allRoles]);
    let roleDropdownOpen = $state(false);

    let searchTimer: ReturnType<typeof setTimeout> | null = null;

    // Vehicles filtering
    const filteredVehicles = $derived(
        vehicles.filter((v: any) => {
            const matchesSearch = 
                (v.first_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
                (v.last_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
                (v.vehicle_plate?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
                (v.id || '').toLowerCase().includes(searchQuery.toLowerCase());
            
            const matchesType = vehicleTypeFilter === 'all' || v.vehicle_type === vehicleTypeFilter;
            
            return matchesSearch && matchesType;
        })
    );



    let displayedApps = $derived.by(() => {
        let filtered = [...vehicles];

        if (tab === 'monitoring') {
            // Show distributed vehicles that are in process
            filtered = filtered.filter((v: any) => ['distributed', 'completed', 'dept_val', 'osa_val', 'scheduled'].includes(v.status));
        }

        if (vehicleTypeFilter !== 'all') {
            filtered = filtered.filter((v: any) => v.vehicle_type === vehicleTypeFilter);
        }

        if (selectedCampus !== 'all') {
            filtered = filtered.filter((v: any) => v.campus === selectedCampus);
        }

        if (searchQuery) {
            const terms = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
            filtered = filtered.filter((v: any) => {
                const fullString = Object.values(v)
                    .filter(val => val !== null && val !== undefined)
                    .map(val => String(val).toLowerCase())
                    .join(' ');
                return terms.every(term => fullString.includes(term));
            });
        }

        return filtered;
    });

    async function revokeQR(vehicleId: number) {
        if (!confirm('Are you sure you want to revoke this QR code? The vehicle will be denied access.')) return;
        try {
            const res = await fetch(`/api/monitor/revoke`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ vehicle_id: vehicleId })
            });
            if (res.ok) {
                vehicles = vehicles.map((v: any) => v.vehicle_id === vehicleId ? { ...v, status: 'revoked' } : v);
            } else {
                alert('Failed to revoke QR code.');
            }
        } catch (e) {
            console.error(e);
            alert('Error revoking QR code.');
        }
    }

    async function unrevokeQR(vehicleId: number) {
        if (!confirm('Restore access for this vehicle? Their QR code will be reactivated.')) return;
        try {
            const res = await fetch(`/api/monitor/revoke`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ vehicle_id: vehicleId })
            });
            if (res.ok) {
                vehicles = vehicles.map((v: any) => v.vehicle_id === vehicleId ? { ...v, status: 'distributed' } : v);
            } else {
                alert('Failed to restore QR code.');
            }
        } catch (e) {
            console.error(e);
            alert('Error restoring QR code.');
        }
    }

    // Gate logs functions for History and Vehicle Log tabs
    function toggleRole(role: string) {
        if (selectedRoles.includes(role)) {
            selectedRoles = selectedRoles.filter(r => r !== role);
        } else {
            selectedRoles = [...selectedRoles, role];
        }
        currentPage = 1; fetchLogs();
    }
    
    function getRoleDropdownLabel() {
        if (selectedRoles.length === allRoles.length) return 'All Roles';
        if (selectedRoles.length === 0) return 'No Roles';
        if (selectedRoles.length === 1) return selectedRoles[0].charAt(0).toUpperCase() + selectedRoles[0].slice(1);
        return `${selectedRoles.length} Roles`;
    }

    function onSearchInput() {
        if (searchTimer) clearTimeout(searchTimer);
        searchTimer = setTimeout(() => { 
            currentPage = 1; 
            fetchLogs(); 
        }, 300);
    }

    // Reset pagination when switching tabs
    $effect(() => {
        if (tab === 'Vehicle Log' || tab === 'History') {
            currentPage = 1;
            fetchLogs();
        }
    });

    async function fetchLogs() {
        loading = true;
        try {
            // Fetch gate logs from vehicle_log table for both History and Vehicle Log tabs
            const roleParam = selectedRoles.length === allRoles.length ? 'all' : selectedRoles.join(',');
            const params = new URLSearchParams({
                date:   selectedDate,
                search: searchQuery,
                type:   'all',
                bound:  boundFilter,
                campus: selectedCampus,
                role:   roleParam,
                page:   String(currentPage),
                limit:  String(pageSize),
            });
            const res = await fetch(`/api/gate/logs?${params}`);
            if (res.ok) {
                const json = await res.json();
                logs = json.logs;
                totalLogs = json.total;
                currentPage = json.page;
                totalPages = json.totalPages;
            }
        } catch (e) { console.error(e); }
        loading = false;
    }

    function prevPage() { if (currentPage > 1) { currentPage--; fetchLogs(); } }
    function nextPage() { if (currentPage < totalPages) { currentPage++; fetchLogs(); } }


</script>

<svelte:head>
  <title>Dashboard — Security | GateQR</title>
  <meta name="description" content="Security vehicle monitoring dashboard for Liceo de Cagayan University." />
</svelte:head>

{#if showModal}
<div class="modal-backdrop" onclick={() => showModal = false} role="button" tabindex="0" onkeydown={(e) => e.key === 'Escape' && (showModal = false)}>
    <div class="modal-content" onclick={(e) => e.stopPropagation()} role="document">
        <button class="modal-close" onclick={() => showModal = false}>&times;</button>
        <img src={modalImage} alt="Snapshot" />
    </div>
</div>
{/if}

<AppShell showSidebar={true} userEmail={data.userEmail} userRole={userRole}>
  <div class="page-header">
    <h1>Vehicle Operations</h1>
    <div class="parking-info">
      <div class="parking-stat">
        <span class="parking-label">Capacity:</span>
        <span class="parking-value">{data.stats.maxCapacity}</span>
      </div>
      <div class="parking-stat">
        <span class="parking-label">Occupied:</span>
        <span class="parking-value occupied">{data.stats.slot_occupied}</span>
      </div>
      <div class="parking-stat">
        <span class="parking-label">Available:</span>
        <span class="parking-value available">{data.stats.slot_unoccupied}</span>
      </div>
    </div>
  </div>

  <TabBar {tabs} active={tab} onchange={(t) => tab = t} />

  {#if tab === 'monitoring'}
    <!-- Monitoring Tab - Registered Vehicles -->
    <div class="controls-row">
      <div class="search-wrap">
        <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          type="text"
          placeholder="Search name, plate, vehicle…"
          bind:value={searchQuery}
          class="search-input"
        />
        {#if searchQuery}
          <button class="search-clear" onclick={() => { searchQuery = ''; }}>×</button>
        {/if}
      </div>

      <div class="filters">
        <select bind:value={vehicleTypeFilter} class="filter-select">
          <option value="all">All Vehicles</option>
          <option value="2-Wheeler / Motorcycle">2-Wheelers</option>
          <option value="4-Wheeler / Car">4-Wheelers</option>
        </select>
        <select bind:value={selectedCampus} class="filter-select">
          <option value="all">All Campuses</option>
          <option value="Liceo Main">Liceo Main</option>
          <option value="RNP">RNP</option>
          <option value="PASEO">PASEO</option>
        </select>
      </div>
    </div>

    <div class="cards-list">
      {#each displayedApps as app}
        <ApplicationCard data={{
          id: app.registration_id || '-',
          name: `${app.first_name} ${app.last_name}`,
          role: app.role,
          campus: app.campus || '-',
          'year level': app.year_level || '-',
          email: app.user_email || '-',
          contact: app.mobile || '-',
          department: app.department_name || '-',
          'dept. email': app.department_email || '-',
          vehicle: app.vehicle_information?.brand || '-',
          'vehicle type': app.vehicle_information?.type || '-',
          plate: app.vehicle_information?.plate_number || '-',
          owner: app.is_owner ? 'Yes' : 'No',
          status: app.status,
          'dean status': app.dept_val_at ? 'Approved' : (app.status === 'rejected' ? 'Rejected' : (app.status === 'dept_val' ? 'Pending' : 'N/A')),
          crd: app.registration_id ? 'N/A' : '-',
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
            <ActionBar tab="monitoring" status={app.status} expiresAt={app.expires_at} onaction={(action, schedule) => {
              if (action === 'revoke') {
                revokeQR(app.registration_id);
              } else if (action === 'unrevoke') {
                unrevokeQR(app.registration_id);
              }
            }} />
          {/snippet}
        </ApplicationCard>
      {:else}
        <p class="empty-state">No vehicles found.</p>
      {/each}
    </div>
  {:else if tab === 'Vehicle Log'}
    <!-- Vehicle Log Tab - Gate Logs Only -->
    <div class="card">
      <div class="header">
        <div class="header-left">
          <h2 class="title">Gate History</h2>
        </div>
        <div class="filters">
          <div class="dropdown-wrap" use:clickOutside={() => roleDropdownOpen = false}>
            <button class="filter-select dropdown-btn" onclick={() => roleDropdownOpen = !roleDropdownOpen}>
              {getRoleDropdownLabel()}
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
          <select bind:value={boundFilter} onchange={() => { currentPage = 1; fetchLogs(); }} class="filter-select">
            <option value="all">In &amp; Out</option>
            <option value="in">Entry Only</option>
            <option value="out">Exit Only</option>
          </select>
          <input type="date" bind:value={selectedDate} onchange={() => { currentPage = 1; fetchLogs(); }} class="filter-select" />
          <select bind:value={selectedCampus} onchange={() => { currentPage = 1; fetchLogs(); }} class="filter-select">
            <option value="all">All Campuses</option>
            <option value="Liceo Main">Liceo Main</option>
            <option value="RNP">RNP</option>
            <option value="PASEO">PASEO</option>
          </select>
          <input type="text" placeholder="Search name, plate, vehicle…" bind:value={searchQuery} oninput={onSearchInput} class="search-box" />
        </div>
      </div>

      {#if loading}
        <div class="loading-row">
          <div class="spinner"></div>
          Loading…
        </div>
      {:else}
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Type</th>
                <th>Name / Role</th>
                <th>Vehicle</th>
                <th>Bound</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {#each logs as log}
              <tr>
                <td class="td-time">
                  <span class="time-main">{log.time}</span>
                  <span class="time-date">{log.date}</span>
                </td>
                <td>
                  <span class="chip {log.type === 'Guest' ? 'chip-guest' : (log.type === 'VIP' ? 'chip-vip' : 'chip-reg')}">{log.type}</span>
                </td>
                <td class="td-name">
                  <span class="name-text">{log.name}</span>
                  <span class="role-badge">{log.role}</span>
                </td>
                <td class="td-vehicle">
                  {log.make}
                  <span class="plate-tag">{log.plate}</span>
                </td>
                <td>
                  <span class="chip" class:chip-in={log.bound === 'In'} class:chip-out={log.bound === 'Out'}>{log.bound}</span>
                </td>
                <td>
                  {#if log.status}
                    <span class="chip chip-anomaly">{log.status}</span>
                  {:else}
                    <span class="chip chip-ok">OK</span>
                  {/if}
                </td>
              </tr>
              {:else}
              <tr>
                <td colspan="6" class="empty-cell">No logs found for the selected filters.</td>
              </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <!-- Paginator -->
        {#if totalPages > 1}
          <div class="paginator">
            <button class="page-btn" onclick={prevPage} disabled={currentPage <= 1}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
              Prev
            </button>
            <span class="page-info">Page {currentPage} of {totalPages}</span>
            <button class="page-btn" onclick={nextPage} disabled={currentPage >= totalPages}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
              Next
            </button>
          </div>
        {/if}
      {/if}
    </div>
  {:else if tab === 'History'}
    <!-- History Tab - Gate History from vehicle_log table -->
    <div class="card">
      <div class="header">
        <div class="header-left">
          <h2 class="title">Gate History</h2>
        </div>
        <div class="filters">
          <div class="dropdown-wrap" use:clickOutside={() => roleDropdownOpen = false}>
            <button class="filter-select dropdown-btn" onclick={() => roleDropdownOpen = !roleDropdownOpen}>
              {getRoleDropdownLabel()}
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
          <select bind:value={boundFilter} onchange={() => { currentPage = 1; fetchLogs(); }} class="filter-select">
            <option value="all">In & Out</option>
            <option value="in">In Only</option>
            <option value="out">Out Only</option>
          </select>
          <input type="date" bind:value={selectedDate} onchange={() => { currentPage = 1; fetchLogs(); }} class="filter-select" />
          <select bind:value={selectedCampus} onchange={() => { currentPage = 1; fetchLogs(); }} class="filter-select">
            <option value="all">All Campuses</option>
            <option value="Liceo Main">Liceo Main</option>
            <option value="RNP">RNP</option>
            <option value="PASEO">PASEO</option>
          </select>
          <input type="text" placeholder="Search name, plate, vehicle…" bind:value={searchQuery} oninput={onSearchInput} class="search-box" />
        </div>
      </div>

      {#if loading}
        <div class="loading-row">
          <div class="spinner"></div>
          Loading…
        </div>
      {:else}
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>TIME</th>
                <th>TYPE</th>
                <th>NAME / ROLE</th>
                <th>VEHICLE</th>
                <th>BOUND</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {#each logs as log}
              <tr>
                <td class="td-time">
                  <span class="time-main">{log.time}</span>
                  <span class="time-sub">{log.date}</span>
                </td>
                <td>
                  <span class="type-badge">{log.type}</span>
                </td>
                <td class="td-name">
                  <span class="name-text">{log.name}</span>
                  <span class="role-badge">{log.role}</span>
                </td>
                <td class="td-vehicle">
                  {log.make} {log.vehicle_type}
                  <span class="plate-tag">{log.plate}</span>
                </td>
                <td>
                  <span class="bound-badge {log.bound === 'In' ? 'in' : 'out'}">{log.bound}</span>
                </td>
                <td>
                  <span class="status-badge {log.status === 'Inside' ? 'success' : 'default'}">{log.status}</span>
                </td>
              </tr>
              {:else}
              <tr>
                <td colspan="6" class="empty-cell">No logs found for the selected filters.</td>
              </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <!-- Paginator -->
        {#if totalPages > 1}
          <div class="paginator">
            <button class="page-btn" onclick={prevPage} disabled={currentPage <= 1}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
              Prev
            </button>
            <span class="page-info">Page {currentPage} of {totalPages}</span>
            <button class="page-btn" onclick={nextPage} disabled={currentPage >= totalPages}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
              Next
            </button>
          </div>
        {/if}
      {/if}
    </div>
  {/if}
</AppShell>

<style>
  .page-header {
    margin-bottom: 1.5rem;
  }

  .page-header h1 {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
  }

  /* ── Stats grid ──────────────────────────────────────────────────────── */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
    margin-bottom: 1rem;
  }


  .stat-card {
    background: var(--surface);
    border: 1.5px solid var(--border);
    border-radius: var(--radius-md);
    padding: 1.125rem 1rem;
    display: flex;
    gap: 0.875rem;
    align-items: center;
    overflow: hidden;
    box-shadow: var(--shadow-sm);
    transition: transform 0.15s, box-shadow 0.15s;
  }
  .stat-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
  .stat-clickable { cursor: pointer; }

  .stat-icon {
    width: 36px; height: 36px;
    border-radius: var(--radius-sm);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }

  .stat-body { display: flex; flex-direction: column; gap: 3px; flex: 1; min-width: 0; overflow: hidden; }
  .stat-label { font-size: 0.72rem; font-weight: 600; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.05em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .stat-value { font-size: 1.5rem; font-weight: 800; line-height: 1.15; }
  .stat-desc  { font-size: 0.73rem; color: var(--text-dim); margin-top: 2px; line-height: 1.45; white-space: normal; word-break: break-word; }

  /* ── Tab bar ───────────────────────────────────────────────────────────── */
  .category-tabs {
    display: flex; gap: 0.5rem; padding: 0 1rem 0.5rem;
    border-bottom: 1px solid var(--border); background: var(--surface);
    overflow-x: auto;
  }
  .tab-btn {
    background: none; border: none; padding: 0.5rem 0.75rem;
    font-size: 0.8125rem; font-weight: 600; color: var(--text-dim);
    cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.15s;
  }
  .tab-btn:hover { color: var(--text); }
  .tab-btn.active { color: var(--maroon); border-bottom-color: var(--maroon); }

  /* ── Charts row ──────────────────────────────────────────────────────── */
  .charts-row {
    display: flex;
    gap: 0.75rem;
    margin-bottom: 1rem;
    align-items: stretch;
  }
  .flex-1 { flex: 1; }
  .flex-2 { flex: 2; }
  @media (max-width: 640px) { .charts-row { flex-direction: column; } }

  .chart-card {
    background: var(--surface);
    border: 1.5px solid var(--border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
  }

  .card-header {
    padding: 0.875rem 1rem;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .card-title { font-size: 0.9375rem; font-weight: 600; color: var(--text); }
  .card-badge {
    font-size: 0.75rem; color: var(--text-dim);
    background: var(--border); padding: 2px 7px; border-radius: 20px;
  }

  /* ── Hourly bar chart ────────────────────────────────────────────────── */
  .bar-chart {
    display: flex;
    align-items: flex-end;
    gap: 3px;
    height: 140px;
    padding: 1.25rem 1rem 0.5rem;
  }
  .bar-col {
    flex: 1; display: flex; flex-direction: column;
    align-items: center; height: 100%; justify-content: flex-end;
  }
  .bar-value {
    width: 100%; max-width: 14px;
    background: linear-gradient(to top, var(--maroon), #e05070);
    border-radius: 3px 3px 0 0;
    transition: height 0.4s ease;
    min-height: 2px;
    opacity: 0.65;
  }
  .bar-peak { opacity: 1; box-shadow: 0 0 6px rgba(107,26,42,0.4); }
  .bar-label { font-size: 0.55rem; color: var(--text-dim); margin-top: 3px; min-height: 10px; }

  /* ── Donut chart ─────────────────────────────────────────────────────── */
  .donut-wrap {
    padding: 1rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .donut-svg {
    width: 110px; height: 110px;
    flex-shrink: 0;
    filter: drop-shadow(0 2px 6px rgba(0,0,0,0.1));
  }
  .donut-num { font-size: 16px; font-weight: 800; fill: var(--text); }
  .donut-sub { font-size: 7px; fill: var(--text-dim); }
  .donut-empty { font-size: 0.85rem; color: var(--text-dim); padding: 1rem; }

  .donut-legend { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.4rem; }
  .donut-legend li { display: flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; }
  .legend-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .legend-label { color: var(--text-dim); flex: 1; }
  .legend-val { font-weight: 700; color: var(--text); }

  /* ── Table card ──────────────────────────────────────────────────────── */
  .table-card {
    background: var(--surface);
    border: 1.5px solid var(--border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm);
    margin-bottom: 1rem;
  }
  .table-header {
    padding: 0.875rem 1rem;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  .header-left { display: flex; align-items: center; gap: 0.5rem; }
  .header-right { display: flex; align-items: center; gap: 0.5rem; }

  /* ── Print / Tabs ────────────────────────────────────────────────────── */
  .print-btn {
    display: inline-flex; align-items: center; gap: 0.5rem;
    background: var(--maroon); color: white;
    border: none; border-radius: var(--radius-sm);
    padding: 0.5rem 0.875rem; font-size: 0.8125rem; font-weight: 600;
    cursor: pointer; transition: opacity 0.15s;
  }
  .print-btn:hover { opacity: 0.9; }

  .capacity-control {
    display: flex; flex-direction: column; gap: 1rem;
    background: var(--surface); padding: 1rem; border-radius: var(--radius-md);
    border: 1.5px solid var(--border); margin-bottom: 1rem; box-shadow: var(--shadow-sm);
  }

  .capacity-info {
    display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;
  }

  .capacity-stats {
    display: flex; gap: 2rem; padding-top: 0.75rem; border-top: 1px solid var(--border);
  }

  .parking-info {
    display: flex;
    gap: 2rem;
    align-items: center;
    margin-top: 0.5rem;
  }

  .parking-stat {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .parking-label {
    font-size: 0.875rem;
    color: var(--text-muted);
    font-weight: 500;
  }

  .parking-value {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .parking-value.occupied {
    color: #dc2626;
  }

  .parking-value.available {
    color: #16a34a;
  }

  .capacity-stat {
    display: flex; flex-direction: column; gap: 0.25rem;
  }

  .capacity-label {
    font-size: 0.75rem; font-weight: 600; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.05em;
  }

  .capacity-value {
    font-size: 1.25rem; font-weight: 800; color: var(--maroon);
  }

  .cap-title { font-weight: 600; font-size: 0.875rem; color: var(--text); }
  .cap-input {
    width: 100px; height: 32px; padding: 0 0.5rem; border: 1.5px solid var(--border);
    border-radius: var(--radius-sm); font-size: 0.875rem; outline: none;
  }
  .cap-input:focus { border-color: var(--maroon); }
  .cap-btn {
    background: var(--surface-hover); border: 1.5px solid var(--border);
    padding: 0 1rem; height: 32px; border-radius: var(--radius-sm); font-weight: 600;
    cursor: pointer; font-size: 0.8125rem;
  }
  .cap-btn:hover { background: var(--maroon); color: white; border-color: var(--maroon); }
  .cap-desc { font-size: 0.75rem; color: var(--text-dim); }

  .registration-status-control {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    background: var(--surface);
    border: 1.5px solid var(--border);
    border-radius: var(--radius-md);
    margin-bottom: 1rem;
    box-shadow: var(--shadow-sm);
  }

  .status-label {
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--text);
  }

  .status-toggle {
    padding: 0.5rem 1rem;
    border: 1.5px solid var(--border);
    border-radius: var(--radius-sm);
    font-weight: 600;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.15s;
    background: var(--surface);
    color: var(--text);
  }

  .status-toggle:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .status-toggle.status-open {
    background: rgba(5,150,105,0.1);
    border-color: #059669;
    color: #059669;
  }

  .status-toggle.status-closed {
    background: rgba(185,28,28,0.1);
    border-color: #b91c1c;
    color: #b91c1c;
  }

  .status-toggle:not(:disabled):hover {
    opacity: 0.8;
  }

  /* ── Controls ────────────────────────────────────────────────────────── */
  .controls-row {
    padding: 0.625rem 1rem;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
    background: var(--background);
  }

  .search-wrap {
    position: relative;
    flex: 1;
    min-width: 200px;
    display: flex;
    align-items: center;
  }
  .search-icon { position: absolute; left: 0.625rem; color: var(--text-dim); pointer-events: none; flex-shrink: 0; }
  .search-input {
    width: 100%;
    height: 32px;
    padding: 0 2rem 0 2.1rem;
    border: 1.5px solid var(--border); border-radius: var(--radius-sm);
    background: var(--surface); color: var(--text); font-size: 0.8125rem;
    font-family: inherit; outline: none; transition: border-color 0.15s;
    box-sizing: border-box;
  }
  .search-input:focus { border-color: var(--maroon); }
  .search-clear {
    position: absolute; right: 0.5rem;
    background: none; border: none; cursor: pointer;
    color: var(--text-dim); font-size: 1rem; line-height: 1; padding: 0;
  }
  .search-clear:hover { color: var(--text); }

  .filters { display: flex; gap: 0.5rem; align-items: center; flex-shrink: 0; }

  .filter-select, .ctrl-input {
    height: 32px;
    padding: 0 0.625rem;
    border: 1.5px solid var(--border); border-radius: var(--radius-sm);
    background: var(--surface); color: var(--text);
    font-size: 0.8125rem; font-family: inherit; outline: none;
    cursor: pointer; transition: border-color 0.15s;
    box-sizing: border-box;
  }
  .filter-select:focus, .ctrl-input:focus { border-color: var(--maroon); }

  .dropdown-wrap { position: relative; }
  .dropdown-btn { min-width: 130px; text-align: left; display: flex; justify-content: space-between; align-items: center; }
  .dropdown-menu {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    background: var(--surface);
    border: 1.5px solid var(--border);
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow-md);
    padding: 0.5rem;
    z-index: 100;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 140px;
  }
  .dropdown-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    color: var(--text);
    cursor: pointer;
    padding: 0.25rem 0.5rem;
    border-radius: var(--radius-sm);
    transition: background 0.15s;
  }
  .dropdown-item:hover { background: var(--surface-hover); }

  /* ── Loading ─────────────────────────────────────────────────────────── */
  .loading-row {
    display: flex; align-items: center; justify-content: center;
    gap: 0.5rem; padding: 3rem; color: var(--text-dim); font-size: 0.875rem;
  }
  .spinner {
    width: 16px; height: 16px;
    border: 2px solid var(--border);
    border-top-color: var(--maroon);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Table ───────────────────────────────────────────────────────────── */
  .table-wrap { overflow-x: auto; }
  .log-table {
    width: 100%; border-collapse: collapse;
    text-align: left; font-size: 0.875rem;
  }
  .log-table th, .log-table td {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
  }
  .log-table th {
    font-weight: 600; color: var(--text-dim);
    text-transform: uppercase; letter-spacing: 0.05em;
    font-size: 0.7rem; background: var(--surface); position: sticky; top: 0;
  }
  .log-table tbody tr:hover { background: var(--surface-hover); }

  .td-time { min-width: 80px; }
  .time-main { display: block; font-weight: 600; color: var(--text); }
  .time-date { display: block; font-size: 0.7rem; color: var(--text-dim); }

  .td-name { max-width: 180px; }
  .name-text { display: block; font-weight: 500; }
  .role-badge {
    display: inline-block; font-size: 0.65rem; font-weight: 600;
    padding: 1px 5px; border-radius: 4px; margin-top: 2px;
    background: var(--border); color: var(--text-dim); text-transform: capitalize;
  }
  .reason-text { font-size: 0.7rem; color: #d97706; margin-top: 2px; }

  .td-vehicle { color: var(--text); }
  .plate-tag {
    display: inline-block; font-size: 0.7rem; font-weight: 700;
    padding: 1px 5px; border-radius: 3px;
    background: var(--border); color: var(--text-dim); margin-left: 4px;
    font-family: monospace; letter-spacing: 0.05em;
  }

  .card-qr {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    margin-top: 1rem;
  }
  .card-qr img {
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 0.5rem;
    background: white;
  }
  .card-qr a {
    font-size: 0.75rem;
    color: var(--maroon);
    text-decoration: none;
    font-weight: 600;
  }
  .card-qr a:hover {
    text-decoration: underline;
  }

  /* ── Chips ───────────────────────────────────────────────────────────── */
  .chip {
    display: inline-flex; align-items: center;
    padding: 2px 8px; border-radius: 12px;
    font-size: 0.72rem; font-weight: 600;
  }
  .chip-in          { background: rgba(34,197,94,0.15);  color: #16a34a; }
  .chip-out         { background: rgba(239,68,68,0.15);  color: #dc2626; }
  .chip-guest       { background: rgba(245,158,11,0.15); color: #d97706; }
  .chip-vip         { background: rgba(245,158,11,0.15); color: #b45309; }
  .chip-reg         { background: rgba(59,130,246,0.15); color: #2563eb; }
  .chip-anomaly     { background: rgba(239,68,68,0.12);  color: #dc2626; border: 1px solid rgba(220,38,38,0.3); }
  .chip-ok          { background: rgba(34,197,94,0.12);  color: #16a34a; }

  .empty-cell { text-align: center; padding: 3rem; color: var(--text-dim); font-size: 0.875rem; }

  /* ── Paginator ───────────────────────────────────────────────────────── */
  .paginator {
    display: flex; align-items: center; justify-content: center;
    gap: 0.75rem; padding: 0.875rem;
    border-top: 1px solid var(--border);
  }
  .page-btn {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 0.4rem 0.875rem; border-radius: var(--radius-sm);
    border: 1.5px solid var(--border); background: var(--surface);
    color: var(--text); font-size: 0.8125rem; font-weight: 600;
    cursor: pointer; transition: all 0.15s; font-family: inherit;
  }
  .page-btn:hover:not(:disabled) { border-color: var(--maroon); color: var(--maroon); }
  .page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .page-info { font-size: 0.8125rem; color: var(--text-dim); }

  /* ── Photo modal ─────────────────────────────────────────────────────── */
  .modal-backdrop {
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.85);
    display: flex; align-items: center; justify-content: center;
    z-index: 9999;
  }
  .modal-content { position: relative; max-width: 90vw; max-height: 90vh; }
  .modal-content img { max-width: 100%; max-height: 90vh; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); }
  .modal-close {
    position: absolute; top: -40px; right: 0;
    background: none; border: none; color: white; font-size: 2rem; cursor: pointer;
  }

  /* ── Additional styles for monitoring/history tabs ──────────────────────── */
  .cards-list {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .vehicle-card {
    background: var(--surface);
    border: 1.5px solid var(--border);
    border-radius: var(--radius-md);
    padding: 1.25rem;
    box-shadow: var(--shadow-sm);
    transition: all 0.2s ease;
  }

  .vehicle-card:hover {
    box-shadow: var(--shadow-md);
    border-color: var(--maroon-light);
    transform: translateY(-2px);
  }

  .vehicle-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--border);
  }

  .vehicle-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .vehicle-title {
    font-size: 1rem;
    font-weight: 700;
    color: var(--text);
    margin: 0;
  }

  .vehicle-role {
    font-size: 0.75rem;
    color: var(--text-secondary);
    text-transform: capitalize;
  }

  .vehicle-status {
    flex-shrink: 0;
  }

  .vehicle-details {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
  }

  .detail-row {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .detail-label {
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .detail-value {
    font-size: 0.875rem;
    color: var(--text);
    font-weight: 500;
  }

  .font-mono {
    font-family: monospace;
  }

  .vehicle-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border);
  }

  .status-badge {
    padding: 0.25rem 0.6rem; border-radius: 1rem; font-size: 0.75rem; font-weight: 600; text-transform: uppercase;
  }

  .status-badge.osa_val  { background: rgba(59,130,246,0.15);  color: #2563eb; }
  .status-badge.dept_val { background: rgba(234,179,8,0.15);   color: #ca8a04; }
  .status-badge.revoked  { background: rgba(239,68,68,0.15);   color: #dc2626; }
  .status-badge.rejected { background: rgba(107,114,128,0.15); color: #4b5563; }
  .status-badge.expired  { background: rgba(107,114,128,0.15); color: #6b7280; }
  .status-badge.distributed { background: rgba(34,197,94,0.15);   color: #16a34a; }
  .status-badge.completed { background: rgba(34,197,94,0.15);   color: #16a34a; }
  .status-badge.scheduled { background: rgba(234,179,8,0.15);   color: #ca8a04; }

  .btn-danger {
    background: #dc2626; color: white; border: none; padding: 0.4rem 0.8rem;
    border-radius: var(--radius-sm); cursor: pointer; font-size: 0.75rem; font-weight: 600;
  }
  .btn-danger:hover { background: #b91c1c; }
  .btn-success {
    background: #16a34a; color: white; border: none; padding: 0.4rem 0.8rem;
    border-radius: var(--radius-sm); cursor: pointer; font-size: 0.75rem; font-weight: 600;
  }
  .btn-success:hover { background: #15803d; }

  .card {
    background: var(--surface);
    border: 1.5px solid var(--border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm);
  }

  .header {
    padding: 0.875rem 1rem;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--text);
    margin: 0;
  }

  .search-box {
    height: 32px;
    padding: 0 0.625rem;
    border: 1.5px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface);
    color: var(--text);
    font-size: 0.8125rem;
    font-family: inherit;
    outline: none;
    transition: border-color 0.15s;
    box-sizing: border-box;
  }

  .search-box:focus {
    border-color: var(--maroon);
  }

  .data-table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
    font-size: 0.875rem;
  }

  .data-table th, .data-table td {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
  }

  .data-table th {
    font-weight: 600;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-size: 0.7rem;
    background: var(--surface);
    position: sticky;
    top: 0;
  }

  .data-table tbody tr:hover {
    background: var(--surface-hover);
  }

  .empty-state {
    text-align: center;
    padding: 3rem 1rem;
    color: var(--text-muted);
    font-size: 0.9rem;
    background: var(--surface);
    border: 1.5px dashed var(--border);
    border-radius: var(--radius-md);
  }

  /* ── Additional styles for monitoring/history tabs ──────────────────────── */
  .cards-list {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .vehicle-card {
    background: var(--surface);
    border: 1.5px solid var(--border);
    border-radius: var(--radius-md);
    padding: 1.25rem;
    box-shadow: var(--shadow-sm);
    transition: all 0.2s ease;
  }

  .vehicle-card:hover {
    box-shadow: var(--shadow-md);
    border-color: var(--maroon-light);
    transform: translateY(-2px);
  }

  .vehicle-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--border);
  }

  .vehicle-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .vehicle-title {
    font-size: 1rem;
    font-weight: 700;
    color: var(--text);
    margin: 0;
  }

  .vehicle-role {
    font-size: 0.75rem;
    color: var(--text-secondary);
    text-transform: capitalize;
  }

  .vehicle-status {
    flex-shrink: 0;
  }

  .vehicle-details {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
  }

  .detail-row {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .detail-label {
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .detail-value {
    font-size: 0.875rem;
    color: var(--text);
    font-weight: 500;
  }

  .font-mono {
    font-family: monospace;
  }

  .vehicle-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border);
  }

  .status-badge {
    padding: 0.25rem 0.6rem; border-radius: 1rem; font-size: 0.75rem; font-weight: 600; text-transform: uppercase;
  }

  .status-badge.osa_val  { background: rgba(59,130,246,0.15);  color: #2563eb; }
  .status-badge.dept_val { background: rgba(234,179,8,0.15);   color: #ca8a04; }
  .status-badge.revoked  { background: rgba(239,68,68,0.15);   color: #dc2626; }
  .status-badge.rejected { background: rgba(107,114,128,0.15); color: #4b5563; }
  .status-badge.expired  { background: rgba(107,114,128,0.15); color: #6b7280; }
  .status-badge.distributed { background: rgba(34,197,94,0.15);   color: #16a34a; }
  .status-badge.completed { background: rgba(34,197,94,0.15);   color: #16a34a; }
  .status-badge.scheduled { background: rgba(234,179,8,0.15);   color: #ca8a04; }

  .btn-danger {
    background: #dc2626; color: white; border: none; padding: 0.4rem 0.8rem;
    border-radius: var(--radius-sm); cursor: pointer; font-size: 0.75rem; font-weight: 600;
  }
  .btn-danger:hover { background: #b91c1c; }
  .btn-success {
    background: #16a34a; color: white; border: none; padding: 0.4rem 0.8rem;
    border-radius: var(--radius-sm); cursor: pointer; font-size: 0.75rem; font-weight: 600;
  }
  .btn-success:hover { background: #15803d; }

  .card {
    background: var(--surface);
    border: 1.5px solid var(--border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm);
  }

  .header {
    padding: 0.875rem 1rem;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--text);
    margin: 0;
  }

  .search-box {
    height: 32px;
    padding: 0 0.625rem;
    border: 1.5px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface);
    color: var(--text);
    font-size: 0.8125rem;
    font-family: inherit;
    outline: none;
    transition: border-color 0.15s;
    box-sizing: border-box;
  }

  .search-box:focus {
    border-color: var(--maroon);
  }

  .data-table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
    font-size: 0.875rem;
  }

  .data-table th, .data-table td {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
  }

  .data-table th {
    font-weight: 600;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-size: 0.7rem;
    background: var(--surface);
    position: sticky;
    top: 0;
  }

  .data-table tbody tr:hover {
    background: var(--surface-hover);
  }

  /* ── Chips ───────────────────────────────────────────────────────────── */
  .chip {
    display: inline-flex; align-items: center;
    padding: 2px 8px; border-radius: 12px;
    font-size: 0.72rem; font-weight: 600;
  }
  .chip-in          { background: rgba(34,197,94,0.15);  color: #16a34a; }
  .chip-out         { background: rgba(239,68,68,0.15);  color: #dc2626; }
  .chip-guest       { background: rgba(245,158,11,0.15); color: #d97706; }
  .chip-vip         { background: rgba(245,158,11,0.15); color: #b45309; }
  .chip-reg         { background: rgba(59,130,246,0.15); color: #2563eb; }
  .chip-anomaly     { background: rgba(239,68,68,0.12);  color: #dc2626; border: 1px solid rgba(220,38,38,0.3); }
  .chip-ok          { background: rgba(34,197,94,0.12);  color: #16a34a; }

  .empty-cell { text-align: center; padding: 3rem; color: var(--text-dim); font-size: 0.875rem; }

  /* ── Paginator ───────────────────────────────────────────────────────── */
  .paginator {
    display: flex; align-items: center; justify-content: center;
    gap: 0.75rem; padding: 0.875rem;
    border-top: 1px solid var(--border);
  }
  .page-btn {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 0.4rem 0.8rem; border-radius: var(--radius-sm);
    border: 1.5px solid var(--border); background: var(--surface);
    color: var(--text); font-size: 0.8125rem; font-weight: 600;
    cursor: pointer; transition: all 0.15s; font-family: inherit;
  }
  .page-btn:hover:not(:disabled) { border-color: var(--maroon); color: var(--maroon); }
  .page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .page-info { font-size: 0.8125rem; color: var(--text-dim); }

  /* ── Photo modal ─────────────────────────────────────────────────────── */
  .modal-backdrop {
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.85);
    display: flex; align-items: center; justify-content: center;
    z-index: 9999;
  }
  .modal-content { position: relative; max-width: 90vw; max-height: 90vh; }
  .modal-content img { max-width: 100%; max-height: 90vh; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); }
  .modal-close {
    position: absolute; top: -40px; right: 0;
    background: none; border: none; color: white; font-size: 2rem; cursor: pointer;
  }

  .table-wrap { overflow-x: auto; }
  .td-time { min-width: 80px; }
  .time-main { display: block; font-weight: 600; color: var(--text); }
  .time-date { display: block; font-size: 0.7rem; color: var(--text-dim); }
  .td-name { max-width: 180px; }
  .name-text { display: block; font-weight: 500; }
  .role-badge {
    display: inline-block; font-size: 0.65rem; font-weight: 600;
    padding: 1px 5px; border-radius: 4px; margin-top: 2px;
    background: var(--border); color: var(--text-dim); text-transform: capitalize;
  }
  .td-vehicle { color: var(--text); }
  .plate-tag {
    display: inline-block; font-size: 0.7rem; font-weight: 700;
    padding: 1px 5px; border-radius: 3px;
    background: var(--border); color: var(--text-dim); margin-left: 4px;
    font-family: monospace; letter-spacing: 0.05em;
  }

  .log-table {
    width: 100%; border-collapse: collapse;
    text-align: left; font-size: 0.875rem;
  }
  .log-table th, .log-table td {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
  }
  .log-table th {
    font-weight: 600; color: var(--text-dim);
    text-transform: uppercase; letter-spacing: 0.05em;
    font-size: 0.7rem; background: var(--surface); position: sticky; top: 0;
  }
  .log-table tbody tr:hover { background: var(--surface-hover); }

  .card-qr {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    margin-top: 1rem;
  }
  .card-qr img {
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 0.5rem;
    background: white;
  }
  .card-qr a {
    font-size: 0.75rem;
    color: var(--maroon);
    text-decoration: none;
    font-weight: 600;
  }
  .card-qr a:hover {
    text-decoration: underline;
  }
</style>