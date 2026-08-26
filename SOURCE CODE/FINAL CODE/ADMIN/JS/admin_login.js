import { _supabase } from '../../SUPABASE/supabase_admin_conn.js';

window.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('admin-login-form');
    const loginBtn = document.getElementById('login-btn');
    const togglePasswordCheckbox = document.getElementById('toggle-password');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const message = document.getElementById('login-message');

    const showMessage = (text = '', type = 'error') => {
        message.textContent = text;
        message.classList.toggle('is-success', type === 'success');
    };

    try {
        const { data: { session } } = await _supabase.auth.getSession();

        if (session) {
            const { data: profile } = await _supabase
                .from('profiles')
                .select('role')
                .eq('id', session.user.id)
                .single();

            if (profile?.role === 'superadmin') {
                window.location.replace('../HTML/admin_index.html');
                return;
            }

            await _supabase.auth.signOut();
        }
    } catch (error) {
        console.error('Session check error:', error);
    }

    togglePasswordCheckbox.addEventListener('change', () => {
        passwordInput.type = togglePasswordCheckbox.checked ? 'text' : 'password';
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        showMessage();

        if (!_supabase) {
            showMessage('Unable to connect to the server. Please refresh and try again.');
            return;
        }

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!email || !password) {
            showMessage('Enter both your email address and password.');
            (!email ? emailInput : passwordInput).focus();
            return;
        }

        loginBtn.disabled = true;
        loginBtn.querySelector('span').textContent = 'Signing in…';

        try {
            const { data: authData, error: authError } = await _supabase.auth.signInWithPassword({ email, password });
            if (authError) throw authError;
            if (!authData?.user) throw new Error('Missing session data.');

            const { data: profileData, error: profileError } = await _supabase
                .from('profiles')
                .select('first_name, role')
                .eq('id', authData.user.id)
                .single();

            if (profileError) throw profileError;
            if (profileData?.role !== 'superadmin') {
                throw new Error('Access denied. This account does not have administrator privileges.');
            }

            showMessage(`Welcome back, ${profileData.first_name || 'Admin'}. Opening the dashboard…`, 'success');
            window.location.replace('../HTML/admin_index.html');
        } catch (error) {
            console.error('Login process error:', error);
            await _supabase.auth.signOut();

            let errorMessage = error.message || 'Unable to sign in. Please try again.';
            if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
                errorMessage = 'Network disconnected. Check your internet connection and try again.';
            }
            showMessage(errorMessage);
        } finally {
            loginBtn.disabled = false;
            loginBtn.querySelector('span').textContent = 'Sign in';
        }
    });
});
