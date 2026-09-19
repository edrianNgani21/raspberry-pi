import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase';
import { sendEmail } from '$lib/server/email';

export async function POST({ request, locals }: RequestEvent) {
    if (!locals.user || locals.user.role !== 'osa') {
        return json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const { request_id, action, new_vehicle_make, new_vehicle_plate, new_vehicle_type, new_is_owner } = await request.json();

        if (!request_id || !action) {
            return json({ error: 'Request ID and action are required' }, { status: 400 });
        }

        // Get the change request details
        const { data: requests, error: queryError } = await supabaseAdmin
            .from('change_vehicle_requests')
            .select('*')
            .eq('request_id', request_id)
            .single();

        if (queryError || !requests) {
            return json({ error: 'Change vehicle request not found' }, { status: 404 });
        }

        const changeRequest = requests;

        if (action === 'approve') {
            // Update the original registration with new vehicle details
            const { error: updateRegError } = await supabaseAdmin
                .from('registration')
                .update({ 
                    vehicle_make: new_vehicle_make,
                    vehicle_plate: new_vehicle_plate,
                    vehicle_type: new_vehicle_type,
                    is_owner: new_is_owner,
                    change_request_id: null
                })
                .eq('vehicle_id', changeRequest.original_vehicle_id);

            if (updateRegError) throw updateRegError;

            // Update the change request status
            const { error: updateReqError } = await supabaseAdmin
                .from('change_vehicle_requests')
                .update({ 
                    status: 'approved',
                    processed_at: new Date().toISOString(),
                    processed_by: locals.user.email
                })
                .eq('request_id', request_id);

            if (updateReqError) throw updateReqError;

            // Get user email for notification
            const { data: userData, error: userError } = await supabaseAdmin
                .from('user')
                .select('email')
                .eq('User_ID', changeRequest.user_id)
                .single();

            if (!userError && userData) {
                await sendEmail(
                    userData.email,
                    'Vehicle Change Request Approved - Liceo GateQR',
                    `Your vehicle change request has been approved. Your vehicle information has been updated to: ${new_vehicle_make} (${new_vehicle_plate}).`,
                    `<h3>Vehicle Change Request Approved</h3>
                    <p>Your vehicle change request has been approved.</p>
                    <p><strong>New Vehicle:</strong> ${new_vehicle_make} (${new_vehicle_plate})</p>
                    <p><strong>Type:</strong> ${new_vehicle_type}</p>
                    <p>Your vehicle information has been successfully updated.</p>`
                );
            }

            return json({ message: 'Vehicle change request approved successfully' });
        } else if (action === 'reject') {
            // Update the change request status
            const { error: updateReqError } = await supabaseAdmin
                .from('change_vehicle_requests')
                .update({ 
                    status: 'rejected',
                    processed_at: new Date().toISOString(),
                    processed_by: locals.user.email
                })
                .eq('request_id', request_id);

            if (updateReqError) throw updateReqError;

            // Get user email for notification
            const { data: userData, error: userError } = await supabaseAdmin
                .from('user')
                .select('email')
                .eq('User_ID', changeRequest.user_id)
                .single();

            if (!userError && userData) {
                await sendEmail(
                    userData.email,
                    'Vehicle Change Request Rejected - Liceo GateQR',
                    'Your vehicle change request has been rejected. Please contact OSA for more information.',
                    `<h3>Vehicle Change Request Rejected</h3>
                    <p>Your vehicle change request has been rejected.</p>
                    <p>Please contact the Office of Student Affairs (OSA) for more information.</p>`
                );
            }

            return json({ message: 'Vehicle change request rejected successfully' });
        } else {
            return json({ error: 'Invalid action' }, { status: 400 });
        }
    } catch (error) {
        console.error('Change vehicle approval error:', error);
        return json({ error: 'Failed to process change vehicle request' }, { status: 500 });
    }
};