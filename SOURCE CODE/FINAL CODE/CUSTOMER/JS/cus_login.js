import { _supabase } from '../../SUPABASE/supabase_customer_conn.js';

window.addEventListener('DOMContentLoaded', () => {

    const loginBtn = document.getElementById('login-btn');
    const togglePasswordCheckbox = document.getElementById('toggle-password');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');

    togglePasswordCheckbox.addEventListener('change', function() {
        passwordInput.type = this.checked ? 'text' : 'password';
    });

    const allInputs = document.querySelectorAll('input');
    allInputs.forEach(input => {
        input.addEventListener('keydown', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault(); 
                loginBtn.click();
            }
        });
    });

    loginBtn.addEventListener('click', async () => {
        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!email || !password) {
            alert("Please enter both email and password.");
            return;
        }

        loginBtn.disabled = true;
        loginBtn.innerText = "Logging in...";

        const { data: authData, error: authError } = await _supabase.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (authError) {
            alert("Login Failed: " + authError.message);
            loginBtn.disabled = false;
            loginBtn.innerText = "Login";
            return;
        }

        if (!authData || !authData.user) {
            alert("Login failed: Missing session data.");
            loginBtn.disabled = false;
            loginBtn.innerText = "Login";
            return;
        }

        const userId = authData.user.id;

        const { data: profileData, error: profileError } = await _supabase
            .from('profiles')
            .select('first_name')
            .eq('id', userId)
            .single();

        loginBtn.disabled = false;
        loginBtn.innerText = "Login";

        if (profileData) {
            alert(`Welcome back, ${profileData.first_name}!`);
        } else {
            alert("Login successful!");
            console.log("Could not fetch profile info:", profileError);
        }

        const redirect = new URLSearchParams(window.location.search).get('redirect');
        window.location.href = redirect === 'room' ? 'cus_index.html?page=room' : 'cus_index.html';
    });

});
