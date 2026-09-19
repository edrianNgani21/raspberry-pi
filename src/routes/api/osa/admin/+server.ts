import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/server/supabase';

export const POST: RequestHandler = async ({ request }) => {
    try {
        const { email, user_type, identification } = await request.json();

        if (!email || !user_type || !identification) {
            return json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Check if user already exists
        const { data: existingUser } = await supabase
            .from('user')
            .select('email')
            .eq('email', email)
            .single();

        if (existingUser) {
            return json({ error: 'User with this email already exists' }, { status: 400 });
        }

        // Create new admin user
        const { data: newUser, error: createError } = await supabase
            .from('user')
            .insert({
                email,
                user_type,
                identification,
                is_active: true
            })
            .select('user_id, email, user_type')
            .single();

        if (createError) throw createError;

        return json({ 
            message: 'Admin created successfully',
            user: newUser
        });
    } catch (error) {
        console.error('Error creating admin:', error);
        return json({ error: 'Failed to create admin' }, { status: 500 });
    }
};

export const GET: RequestHandler = async () => {
    try {
        const { data: users, error } = await supabase
            .from('user')
            .select('user_id, email, user_type, identification, is_active, created_at')
            .in('user_type', ['Osa', 'Safety Security', 'dean'])
            .order('created_at', { ascending: false });

        if (error) throw error;

        return json({ users: users || [] });
    } catch (error) {
        console.error('Error fetching admins:', error);
        return json({ error: 'Failed to fetch admins' }, { status: 500 });
    }
};

export const PATCH: RequestHandler = async ({ request }) => {
    try {
        const { user_id, is_active } = await request.json();

        if (!user_id || typeof is_active !== 'boolean') {
            return json({ error: 'Missing required fields' }, { status: 400 });
        }

        const { data: updatedUser, error } = await supabase
            .from('user')
            .update({ is_active })
            .eq('user_id', user_id)
            .select('user_id, email, user_type, is_active')
            .single();

        if (error) throw error;

        return json({
            message: is_active ? 'Account activated successfully' : 'Account deactivated successfully',
            user: updatedUser
        });
    } catch (error) {
        console.error('Error updating admin status:', error);
        return json({ error: 'Failed to update admin status' }, { status: 500 });
    }
};

export const DELETE: RequestHandler = async ({ request }) => {
    try {
        const { user_id } = await request.json();

        if (!user_id) {
            return json({ error: 'Missing required fields' }, { status: 400 });
        }

        const { error } = await supabase
            .from('user')
            .delete()
            .eq('user_id', user_id);

        if (error) throw error;

        return json({ message: 'Admin deleted successfully' });
    } catch (error) {
        console.error('Error deleting admin:', error);
        return json({ error: 'Failed to delete admin' }, { status: 500 });
    }
};