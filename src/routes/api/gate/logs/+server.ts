import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/server/supabase';
import { GATE_API_KEY } from '$env/static/private';

export const GET: RequestHandler = async ({ request, url, locals }) => {
    const isGate = request.headers.get('X-Gate-Key') === GATE_API_KEY;
    const isOsa = locals.user && (locals.user.role === 'osa' || locals.user.role === 'security');
    
    if (!isGate && !isOsa) {
        return json({ error: 'Unauthorized' }, { status: 403 });
    }

    const dateParam  = url.searchParams.get('date') || '';
    const search     = (url.searchParams.get('search') || '').trim().toLowerCase();
    const typeFilter = url.searchParams.get('type')  || 'all';   // all | registered | guest
    const boundFilter= url.searchParams.get('bound') || 'all';   // all | in | out
    const roleFilter = url.searchParams.get('role')  || 'all';   // all | student | employee | visitor | concessionaire
    const campusFilter = url.searchParams.get('campus') || 'all';
    const page       = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit      = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '25')));

    try {
        let dateFilter = new Date().toISOString().split('T')[0];
        const dateParams: string[] = [];
        if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
            dateFilter = dateParam;
            dateParams.push(dateParam);
        }

        const tomorrow = new Date(new Date(dateFilter).getTime() + 86400000).toISOString().split('T')[0];

        // ── Registered entries ──────────────────────────────────────────────
        const hasRegRoles = roleFilter === 'all' || roleFilter.split(',').some(r => r !== 'guest');
        const regRoles = roleFilter !== 'all' ? roleFilter.split(',').filter(r => r !== 'guest') : [];

        let regRows: any[] = [];
        if (typeFilter !== 'guest' && hasRegRoles) {
            let query = supabase
                .from('vehicle_log')
                .select(`
                    vehicle_log_id,
                    check_in,
                    check_out,
                    pic_in,
                    pic_out,
                    logged_status,
                    logged_status_out,
                    reason,
                    registration:registration_id(
                        first_name,
                        last_name,
                        vehicle_make,
                        vehicle_plate,
                        role,
                        campus
                    )
                `)
                .or(`check_in.gte.${dateFilter},and(check_out.gte.${dateFilter},check_out.is.null)`)
                .or(`check_in.gte.${dateFilter},and(check_out.gte.${dateFilter},check_out.not.null)`);

            if (regRoles.length > 0) {
                query = query.in('registration.role', regRoles);
            }

            if (campusFilter !== 'all') {
                query = query.eq('registration.campus', campusFilter);
            }

            const { data } = await query;
            if (data) {
                regRows = data.map(row => ({
                    ...row,
                    log_type: 'registered',
                    timestamp_in: row.check_in,
                    timestamp_out: row.check_out
                }));
            }
        }

        // ── Guest entries ────────────────────────────────────────────────────
        const isGuestIncluded = (roleFilter === 'all' || roleFilter.split(',').includes('guest')) && campusFilter === 'all';
        let guestRows: any[] = [];
        if (typeFilter !== 'registered' && isGuestIncluded) {
            const { data } = await supabase
                .from('guestlog')
                .select('*')
                .or(`in.gte.${dateFilter},and(out.gte.${dateFilter},out.is.null)`)
                .or(`in.gte.${dateFilter},and(out.gte.${dateFilter},out.not.null)`);

            if (data) {
                guestRows = data.map(row => ({
                    ...row,
                    log_type: 'guest',
                    vehicle_make: row.make_model,
                    vehicle_plate: row.plate,
                    timestamp_in: row.in,
                    timestamp_out: row.out
                }));
            }
        }

        // ── VIP entries ──────────────────────────────────────────────────────
        const isVipIncluded = (roleFilter === 'all' || roleFilter.split(',').includes('vip')) && campusFilter === 'all';
        let vipRows: any[] = [];
        if (typeFilter !== 'registered' && typeFilter !== 'guest' && isVipIncluded) {
            const { data } = await supabase
                .from('vip_log')
                .select('*')
                .gte('timestamp', dateFilter)
                .lt('timestamp', tomorrow);

            if (data) {
                vipRows = data;
            }
        }

        // ── Flatten to log events ────────────────────────────────────────────
        const logs: any[] = [];

        regRows.forEach(row => {
            const inDate = new Date(row.timestamp_in);
            const isStandaloneOut = row.timestamp_out && row.timestamp_in.getTime() === new Date(row.timestamp_out).getTime();

            if (!isStandaloneOut && (boundFilter === 'all' || boundFilter === 'in')) {
                logs.push({
                    id: `reg-in-${row.vehicle_log_id}`,
                    date: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(inDate),
                    time: new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }).format(inDate),
                    name: `${row.registration.first_name} ${row.registration.last_name}`,
                    role: row.registration.role,
                    make: row.registration.vehicle_make,
                    plate: row.registration.vehicle_plate,
                    campus: row.registration.campus,
                    bound: 'In',
                    type: 'Registered',
                    photo: row.pic_in,
                    status: row.logged_status,
                    reason: row.reason,
                    timestamp: inDate.getTime()
                });
            }

            if (row.timestamp_out && (boundFilter === 'all' || boundFilter === 'out')) {
                const outDate = new Date(row.timestamp_out);
                logs.push({
                    id: `reg-out-${row.vehicle_log_id}`,
                    date: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(outDate),
                    time: new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }).format(outDate),
                    name: `${row.registration.first_name} ${row.registration.last_name}`,
                    role: row.registration.role,
                    make: row.registration.vehicle_make,
                    plate: row.registration.vehicle_plate,
                    campus: row.registration.campus,
                    bound: 'Out',
                    type: 'Registered',
                    photo: row.pic_out,
                    status: row.logged_status_out,
                    reason: row.reason,
                    timestamp: outDate.getTime()
                });
            }
        });

        guestRows.forEach(row => {
            const inDate = new Date(row.timestamp_in);
            const isStandaloneOut = row.timestamp_out && row.timestamp_in.getTime() === new Date(row.timestamp_out).getTime();

            if (!isStandaloneOut && (boundFilter === 'all' || boundFilter === 'in')) {
                logs.push({
                    id: `guest-in-${row.guest_id}`,
                    date: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(inDate),
                    time: new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }).format(inDate),
                    name: `Guest (${row.ticket_no})`,
                    role: 'guest',
                    make: row.vehicle_make,
                    plate: row.vehicle_plate,
                    bound: 'In',
                    type: 'Guest',
                    photo: row.pic_in,
                    status: row.logged_status,
                    timestamp: inDate.getTime()
                });
            }

            if (row.timestamp_out && (boundFilter === 'all' || boundFilter === 'out')) {
                const outDate = new Date(row.timestamp_out);
                logs.push({
                    id: `guest-out-${row.guest_id}`,
                    date: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(outDate),
                    time: new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }).format(outDate),
                    name: `Guest (${row.ticket_no})`,
                    role: 'guest',
                    make: row.vehicle_make,
                    plate: row.vehicle_plate,
                    bound: 'Out',
                    type: 'Guest',
                    photo: row.pic_out,
                    status: row.logged_status_out,
                    timestamp: outDate.getTime()
                });
            }
        });

        vipRows.forEach(row => {
            const rowDate = new Date(row.timestamp);
            const bound = row.type === 'in' ? 'In' : 'Out';
            
            if (boundFilter === 'all' || boundFilter.toLowerCase() === row.type) {
                logs.push({
                    id: `vip-${row.id}`,
                    date: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(rowDate),
                    time: new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }).format(rowDate),
                    name: 'VIP',
                    role: 'vip',
                    make: 'VIP Vehicle',
                    plate: 'VIP',
                    bound: bound,
                    type: 'VIP',
                    photo: null,
                    status: null,
                    timestamp: rowDate.getTime()
                });
            }
        });

        // ── Sort descending ──────────────────────────────────────────────────
        logs.sort((a, b) => b.timestamp - a.timestamp);

        // ── Search filter (after merge & sort) ──────────────────────────────
        let filtered = logs;
        if (search) {
            const terms = search.split(/\s+/).filter(Boolean);
            filtered = logs.filter(l => {
                const fullString = Object.values(l)
                    .filter(val => val !== null && val !== undefined)
                    .map(val => String(val).toLowerCase())
                    .join(' ');
                return terms.every(term => fullString.includes(term));
            });
        }

        // ── Paginate ─────────────────────────────────────────────────────────
        const total = filtered.length;
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const safePage = Math.min(page, totalPages);
        const sliced = filtered.slice((safePage - 1) * limit, safePage * limit);

        return json({ logs: sliced, total, page: safePage, totalPages, limit });
    } catch (error) {
        console.error('[Gate] Logs error:', error);
        return json({ error: 'Internal Server Error' }, { status: 500 });
    }
};
