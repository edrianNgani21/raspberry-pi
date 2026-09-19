<script lang="ts">
    import AppShell from '$lib/components/AppShell.svelte';
    import NavBar from '$lib/components/NavBar.svelte';

    let { data } = $props();

    const navLinks = [
        { label: 'Add Admin', href: '/osa/admin' },
        { label: 'Departments', href: '/osa/departments' }
    ];

    // ── OSA Stats ────────────────────────────────────────────────────────────────
    let statsData = $state((data.stats as any) || { 
        totalApplications: 0, 
        pendingValidation: 0, 
        pendingDistribution: 0, 
        completedToday: 0, 
        rejectedToday: 0, 
        totalDepartments: 0 
    });
    let statusBreakdown = $state(data.statusBreakdown || {
        pending: 0, dept_val: 0, osa_val: 0, distributed: 0, completed: 0, rejected: 0, revoked: 0
    });
    let recentApplications = $state(data.recentApplications || []);

    const statCards = $derived([
        {
            label: 'Total Applications',
            value: statsData.totalApplications,
            desc: 'All vehicle registration applications',
            icon: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>`,
            color: '#6b1a2a',
            bg: 'rgba(107,26,42,0.08)'
        },
        {
            label: 'Pending Validation',
            value: statsData.pendingValidation,
            desc: 'Applications awaiting department validation',
            icon: `<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>`,
            color: '#d97706',
            bg: 'rgba(217,119,6,0.08)'
        },
        {
            label: 'Pending Distribution',
            value: statsData.pendingDistribution,
            desc: 'Applications ready for sticker distribution',
            icon: `<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>`,
            color: '#059669',
            bg: 'rgba(5,150,105,0.08)'
        },
        {
            label: 'Completed Today',
            value: statsData.completedToday,
            desc: 'Applications processed today',
            icon: `<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>`,
            color: '#2563eb',
            bg: 'rgba(37,99,235,0.08)'
        }
    ]);

    const statusLabels: Record<string, string> = {
        pending: 'Pending',
        dept_val: 'Dept Validated',
        osa_val: 'OSA Validated',
        distributed: 'Distributed',
        completed: 'Completed',
        rejected: 'Rejected',
        revoked: 'Revoked'
    };

    const maxStatusCount = $derived(Math.max(...Object.values(statusBreakdown), 1));
</script>

<AppShell showSidebar={true}>
    <NavBar {navLinks} />
    
    <div class="dashboard-container">
        <div class="dashboard-header">
            <div class="header-content">
                <h1>OSA Dashboard</h1>
                <p class="header-subtitle">Overview of vehicle registration applications and system status</p>
            </div>
            <div class="header-actions">
                <a href="/osa" class="action-btn primary">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <line x1="12" y1="18" x2="12" y2="12"/>
                        <line x1="9" y1="15" x2="15" y2="15"/>
                    </svg>
                    View Applications
                </a>
            </div>
        </div>
        
        <!-- Stats Grid -->
        <div class="stats-grid">
            {#each statCards as card}
                <div class="stat-card" style="--card-bg: {card.bg}; --card-color: {card.color}">
                    <div class="stat-icon" style="color: {card.color}">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            {@html card.icon}
                        </svg>
                    </div>
                    <div class="stat-content">
                        <div class="stat-value">{card.value}</div>
                        <div class="stat-label">{card.label}</div>
                        <div class="stat-desc">{card.desc}</div>
                    </div>
                </div>
            {/each}
        </div>

        <div class="dashboard-grid">
            <!-- Application Status Breakdown -->
            <div class="breakdown-section">
                <div class="section-header">
                    <h2>Application Status</h2>
                    <span class="section-badge">Overview</span>
                </div>
                <div class="breakdown-grid">
                    {#each Object.entries(statusBreakdown) as [status, count]}
                        <div class="breakdown-item">
                            <div class="breakdown-label">{statusLabels[status] || status}</div>
                            <div class="breakdown-bar">
                                <div class="breakdown-fill" style="width: {(count / maxStatusCount) * 100}%"></div>
                            </div>
                            <div class="breakdown-value">{count}</div>
                        </div>
                    {/each}
                </div>
            </div>

            <!-- Recent Applications -->
            <div class="recent-section">
                <div class="section-header">
                    <h2>Recent Activity</h2>
                    <span class="section-badge">Latest</span>
                </div>
                {#if recentApplications.length > 0}
                    <div class="recent-list">
                        {#each recentApplications as app}
                            <div class="recent-item">
                                <div class="recent-info">
                                    <div class="recent-email">{app.user?.email || 'Unknown'}</div>
                                    <div class="recent-dept">{app.department?.department_name || 'No Department'}</div>
                                </div>
                                <div class="recent-status" class:status-pending={app.status === 'pending'} class:status-dept_val={app.status === 'dept_val'} class:status-osa_val={app.status === 'osa_val'} class:status-distributed={app.status === 'distributed'} class:status-completed={app.status === 'completed'} class:status-rejected={app.status === 'rejected'} class:status-revoked={app.status === 'revoked'}>
                                    {statusLabels[app.status] || app.status}
                                </div>
                            </div>
                        {/each}
                    </div>
                {:else}
                    <div class="no-data">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                            <line x1="12" y1="18" x2="12" y2="12"/>
                            <line x1="9" y1="15" x2="15" y2="15"/>
                        </svg>
                        <p>No recent applications</p>
                    </div>
                {/if}
            </div>
        </div>
    </div>
</AppShell>

<style>
    .dashboard-container {
        padding: 2rem;
        max-width: 1400px;
        margin: 0 auto;
    }

    .dashboard-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 2rem;
        gap: 1rem;
    }

    .header-content h1 {
        font-size: 2rem;
        font-weight: 700;
        margin: 0 0 0.5rem 0;
        color: var(--text-primary);
    }

    .header-subtitle {
        font-size: 0.95rem;
        color: var(--text-secondary);
        margin: 0;
    }

    .header-actions {
        display: flex;
        gap: 0.75rem;
    }

    .action-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1.25rem;
        border-radius: 8px;
        font-size: 0.875rem;
        font-weight: 600;
        text-decoration: none;
        transition: all 0.2s;
        border: none;
        cursor: pointer;
    }

    .action-btn.primary {
        background: var(--maroon);
        color: white;
    }

    .action-btn.primary:hover {
        background: var(--maroon-light);
        transform: translateY(-1px);
    }

    h2 {
        font-size: 1.25rem;
        font-weight: 600;
        margin: 0;
        color: var(--text-primary);
    }

    .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 1.5rem;
        margin-bottom: 2rem;
    }

    .stat-card {
        background: var(--card-bg);
        border: 1px solid rgba(0,0,0,0.05);
        border-radius: 16px;
        padding: 1.5rem;
        display: flex;
        align-items: flex-start;
        gap: 1rem;
        transition: transform 0.2s, box-shadow 0.2s;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }

    .stat-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 16px rgba(0,0,0,0.1);
    }

    .stat-icon {
        padding: 0.75rem;
        border-radius: 12px;
        background: var(--card-bg);
    }

    .stat-content {
        flex: 1;
    }

    .stat-value {
        font-size: 2.25rem;
        font-weight: 700;
        color: var(--card-color);
        line-height: 1;
        margin-bottom: 0.25rem;
    }

    .stat-label {
        font-size: 0.95rem;
        font-weight: 600;
        color: var(--text-primary);
        margin-bottom: 0.25rem;
    }

    .stat-desc {
        font-size: 0.8rem;
        color: var(--text-secondary);
    }

    .dashboard-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1.5rem;
        margin-bottom: 2rem;
    }

    @media (max-width: 1024px) {
        .dashboard-grid {
            grid-template-columns: 1fr;
        }
    }

    .breakdown-section,
    .recent-section {
        background: var(--card-bg);
        border: 1px solid rgba(0,0,0,0.05);
        border-radius: 16px;
        padding: 1.5rem;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }

    .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5rem;
    }

    .section-badge {
        font-size: 0.75rem;
        font-weight: 600;
        padding: 0.25rem 0.75rem;
        background: var(--maroon-muted);
        color: var(--maroon);
        border-radius: 9999px;
        text-transform: uppercase;
    }

    .breakdown-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 1rem;
    }

    .breakdown-item {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .breakdown-label {
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--text-primary);
    }

    .breakdown-bar {
        height: 6px;
        background: #e5e7eb;
        border-radius: 3px;
        overflow: hidden;
    }

    .breakdown-fill {
        height: 100%;
        background: var(--maroon);
        border-radius: 3px;
        transition: width 0.3s ease;
    }

    .breakdown-value {
        font-size: 1.125rem;
        font-weight: 700;
        color: var(--text-primary);
    }

    .recent-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .recent-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 12px;
        transition: all 0.2s;
    }

    .recent-item:hover {
        border-color: var(--maroon);
        transform: translateX(2px);
    }

    .recent-info {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .recent-email {
        font-size: 0.9rem;
        font-weight: 600;
        color: var(--text-primary);
    }

    .recent-dept {
        font-size: 0.8rem;
        color: var(--text-secondary);
    }

    .recent-status {
        padding: 0.25rem 0.75rem;
        border-radius: 9999px;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
    }

    .status-pending { background: #fef3c7; color: #92400e; }
    .status-dept_val { background: #dbeafe; color: #1e40af; }
    .status-osa_val { background: #d1fae5; color: #065f46; }
    .status-distributed { background: #ecfdf5; color: #047857; }
    .status-completed { background: #d1fae5; color: #047857; }
    .status-rejected { background: #fee2e2; color: #b91c1c; }
    .status-revoked { background: #fef3c7; color: #92400e; }

    .no-data {
        text-align: center;
        padding: 2rem;
        color: var(--text-secondary);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
    }

    .no-data svg {
        color: var(--text-dim);
    }

    .no-data p {
        margin: 0;
        font-size: 0.9rem;
    }

    @media (max-width: 768px) {
        .dashboard-container {
            padding: 1rem;
        }

        .dashboard-header {
            flex-direction: column;
        }

        .header-content h1 {
            font-size: 1.5rem;
        }

        .stats-grid {
            grid-template-columns: 1fr;
        }

        .breakdown-grid {
            grid-template-columns: 1fr;
        }
    }
</style>