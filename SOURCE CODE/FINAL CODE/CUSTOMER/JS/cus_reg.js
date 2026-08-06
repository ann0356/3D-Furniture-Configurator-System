// customer account registration
import { _supabase } from '../../SUPABASE/supabase_customer_conn.js';

// make sure all content rendered
window.addEventListener('DOMContentLoaded', () => {

    const togglePasswordCheckbox = document.getElementById('toggle-password');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirm_password');
    const signUpBtn = document.getElementById('signup-btn');
    const registerForm = document.getElementById('register-form');

    // debug
    if (!togglePasswordCheckbox || !passwordInput || !confirmPasswordInput || !signUpBtn || !registerForm) {
        console.error("Warning: Some HTML elements could not be found. Check your IDs!");
        return;
    }

    // display password in text or password form
    togglePasswordCheckbox.addEventListener('change', function() {
        const type = this.checked ? 'text' : 'password';
        
        passwordInput.type = type;
        confirmPasswordInput.type = type;
    });

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        
        // get input
        const email = document.getElementById('email').value.trim();
        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;
        
        const firstName = document.getElementById('first_name').value.trim();
        const lastName = document.getElementById('last_name').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const homeAddress = document.getElementById('home_address').value.trim();

        if (password !== confirmPassword) {
            alert("Password entered are different!");
            return;
        }

        // register account and insert data
        signUpBtn.disabled = true;
        signUpBtn.innerText = "Registering...";

        try {
            // create acc in db
            const { data: authData, error: authError } = await _supabase.auth.signUp({
                email: email,
                password: password
            });

            if (authError) throw authError;

            if (!authData || !authData.user) {
                throw new Error("Unexpected response from server. User object missing.");
            }

            // insert data into db
            const userId = authData.user.id; 
            const { error: insertError } = await _supabase
                .from('profiles')
                .insert([{ 
                    id: userId, 
                    first_name: firstName, 
                    last_name: lastName, 
                    email: email, 
                    phone: phone, 
                    address: homeAddress 
                }]);

            if (insertError) {
                alert("Account registered, but failed to save profile details: " + insertError.message);
            } else {
                alert("Account Registered Successfully!");
                registerForm.reset();
                window.location.href = "cus_login.html";
            }

        } catch (error) {
            console.error("Registration Error:", error);
            alert("Failed to Register: " + error.message);
        } finally {
            signUpBtn.disabled = false;
            signUpBtn.innerText = "Sign Up";
        }
    });
});