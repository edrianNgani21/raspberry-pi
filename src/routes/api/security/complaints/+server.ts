import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/server/supabase';
import { sendEmail } from '$lib/server/email';
import { SECURITY_EMAIL } from '$env/static/private';

export const GET: RequestHandler = async ({ locals }) => {
    if (!locals.user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        let query = supabase
            .from('complaint')
            .select('*')
            .order('created_at', { ascending: false });

        // Security users see all complaints, regular users see only their own
        if (locals.user.role !== 'security') {
            query = query.eq('user_email', locals.user.email);
        }

        const { data, error } = await query.limit(100);

        if (error) throw error;

        return json({ complaints: data });
    } catch (error) {
        console.error('Error fetching complaints:', error);
        return json({ error: 'Failed to fetch complaints' }, { status: 500 });
    }
};

export const POST: RequestHandler = async ({ request, locals }) => {
    if (!locals.user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { message } = await request.json();

        if (!message || message.trim() === '') {
            return json({ error: 'Message is required' }, { status: 400 });
        }

        const { error: insertError } = await supabase
            .from('complaint')
            .insert([{
                user_email: locals.user.email,
                message: message.trim()
            }]);

        if (insertError) throw insertError;

        // Notify Security
        await sendEmail(
            SECURITY_EMAIL,
            'New Complaint Received',
            `A new complaint has been submitted by ${locals.user.email}.\n\nMessage: ${message.trim()}`,
            `<p>A new complaint has been submitted by <strong>${locals.user.email}</strong>.</p>
             <p><strong>Message:</strong><br/>${message.trim().replace(/\\n/g, '<br>')}</p>
             <p>Please log in to the security dashboard to review.</p>`
        );

        return json({ message: 'Complaint submitted successfully' });
    } catch (error) {
        console.error('Error creating complaint:', error);
        return json({ error: 'Failed to submit complaint' }, { status: 500 });
    }
};