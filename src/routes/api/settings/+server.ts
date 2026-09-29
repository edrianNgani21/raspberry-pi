import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/server/supabase';

export const GET: RequestHandler = async ({ locals }) => {
    // Both OSA and Security can view settings
    const isOsaOrSecurity = locals.user && (locals.user.role === 'osa' || locals.user.role === 'security');

    if (!isOsaOrSecurity) {
        return json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const { data: rows } = await supabase
            .from('parking_availability')
            .select('parking_capacity')
            .order('date_time', { ascending: false })
            .limit(1)
            .maybeSingle();

        const maxCapacity = rows?.parking_capacity ?? 500;

        return json({ max_capacity: maxCapacity });
    } catch (error) {
        console.error('[Settings] GET error:', error);
        return json({ error: 'Internal Server Error' }, { status: 500 });
    }
};

export const PUT: RequestHandler = async ({ request, locals }) => {
    const isOsaOrSecurity = locals.user && (locals.user.role === 'osa' || locals.user.role === 'security');

    if (!isOsaOrSecurity) {
        return json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const { max_capacity } = await request.json();

        if (typeof max_capacity !== 'number') {
            return json({ error: 'max_capacity must be a number' }, { status: 400 });
        }

        // Get current parking availability record
        const { data: currentParking } = await supabase
            .from('parking_availability')
            .select('parking_availability_id')
            .order('date_time', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (currentParking) {
            // Update existing parking availability
            const { error: updateError } = await supabase
                .from('parking_availability')
                .update({
                    parking_capacity: max_capacity,
                    date_time: new Date().toISOString()
                })
                .eq('parking_availability_id', currentParking.parking_availability_id);

            if (updateError) throw updateError;
        } else {
            // Insert new parking availability record if none exist
            // First get a valid vehicle_log_id
            const { data: vehicleLog } = await supabase
                .from('vehicle_log')
                .select('vehicle_log_id')
                .order('vehicle_log_id', { ascending: false })
                .limit(1)
                .maybeSingle();

            const vehicle_log_id = vehicleLog?.vehicle_log_id || 0;

            const { error: insertError } = await supabase
                .from('parking_availability')
                .insert({
                    vehicle_log_id: vehicle_log_id,
                    parking_capacity: max_capacity,
                    slot_occupied: 0,
                    slot_unoccupied: max_capacity,
                    date_time: new Date().toISOString()
                });

            if (insertError) throw insertError;
        }

        return json({ success: true, max_capacity });
    } catch (error) {
        console.error('[Settings] PUT error:', error);
        return json({ error: 'Internal Server Error' }, { status: 500 });
    }
};
