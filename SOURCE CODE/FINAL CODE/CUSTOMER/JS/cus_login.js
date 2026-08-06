import { _supabase } from '../../SUPABASE/supabase_customer_conn.js';

window.addEventListener('DOMContentLoaded', () => {

    const loginBtn = document.getElementById('login-btn');
    const togglePasswordCheckbox = document.getElementById('toggle-password');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const forgotPwdLink = document.getElementById('forgot-password-link'); // 获取忘记密码按钮

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

    if (forgotPwdLink) {
        forgotPwdLink.addEventListener('click', async (e) => {
            e.preventDefault();
            
            const email = emailInput.value.trim();

            if (!email) {
                alert("Please enter your email address in the box first to reset your password.");
                emailInput.focus();
                return;
            }

            alert("Sending reset email...");
            const { data, error } = await _supabase.auth.resetPasswordForEmail(email);

            if (error) {
                alert("Failed to send reset email: " + error.message);
            } else {
                alert("Password reset email sent! Please check your inbox.");
            }

             redirectTo: 'http://127.0.0.1:5501/CUSTOMER/HTML/cus_reset_password.html'
        });
    }

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

        window.location.href = "../HTML/cus_index.html";
    });

});