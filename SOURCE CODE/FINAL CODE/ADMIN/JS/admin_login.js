import { _supabase } from '../../SUPABASE/supabase_admin_conn.js';

window.addEventListener('DOMContentLoaded', async () => {

    try {
        // check session of login
        const { data: { session } } = await _supabase.auth.getSession();
        
        if (session) {
            // check session == admin
            const { data: profile } = await _supabase
                .from('profiles')
                .select('role')
                .eq('id', session.user.id)
                .single();

            if (profile && profile.role === 'superadmin') {
                // avoid back to login page 
                window.location.replace("../HTML/admin_index.html"); 
                return;
            } else {
                // sign out if normal user
                await _supabase.auth.signOut();
            }
        }
    } catch (err) {
        console.error("Session check error:", err);
    }
    // ==========================================

    const loginBtn = document.getElementById('login-btn');
    const togglePasswordCheckbox = document.getElementById('toggle-password');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');

    // display password
    togglePasswordCheckbox.addEventListener('change', function() {
        passwordInput.type = this.checked ? 'text' : 'password';
    });

    // listen Enter input
    passwordInput.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            loginBtn.click();
        }
    });

    emailInput.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            // jump to password input panel while password is not filled up
            if (!passwordInput.value) {
                passwordInput.focus(); 
            } else {
                // if filled up, login directly
                loginBtn.click();
            }
        }
    });

    // login account
    loginBtn.addEventListener('click', async () => {
        // check connect to db
        if (!_supabase) {
            alert("System error: Unable to connect to the server. Please refresh the page.");
            return;
        }

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!email || !password) {
            alert("Please enter both email and password.");
            return;
        }

        loginBtn.disabled = true;
        loginBtn.innerText = "Logging in...";

        try {
            const { data: authData, error: authError } = await _supabase.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (authError) throw authError; 
            if (!authData || !authData.user) throw new Error("Missing session data.");

            const userId = authData.user.id;

            try {
                const { data: profileData, error: profileError } = await _supabase
                    .from('profiles')
                    .select('first_name, role') 
                    .eq('id', userId)
                    .single();

                // error checking
                if (profileError) throw profileError;

                // block non admin user
                if (profileData && profileData.role !== 'superadmin') {
                    throw new Error("Access Denied: You do not have administrator privileges.");
                }

                alert(`Welcome back, ${profileData.first_name || 'Admin'}!`);
                
                // avoid back to login page
                window.location.replace("../HTML/admin_index.html");


            } catch (innerError) {
                // directly log out if error occur
                await _supabase.auth.signOut();
                throw innerError; 
            }

        } catch (error) {
            console.error("Login process error:", error);
            
            let errorMessage = error.message;
            if (errorMessage.includes("Failed to fetch") || errorMessage.includes("NetworkError")) {
                errorMessage = "Network disconnected. Please check your internet connection.";
            }
            
            alert("Login Failed: " + errorMessage);

        } finally {
            loginBtn.disabled = false;
            loginBtn.innerText = "Login";
        }
    });

});