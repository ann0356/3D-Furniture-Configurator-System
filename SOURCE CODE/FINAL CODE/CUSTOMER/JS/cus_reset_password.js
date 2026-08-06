import { _supabase } from '../../SUPABASE/supabase_customer_conn.js'; 

document.addEventListener('DOMContentLoaded', async () => {
    const requestSection = document.getElementById('request-section');
    const updateSection = document.getElementById('update-section');
    const requestForm = document.getElementById('request-form');
    const updateForm = document.getElementById('update-form');

    let isPasswordRecoveryMode = false;
    let currentUserEmail = null;

    async function checkState() {
        const { data: { session } } = await _supabase.auth.getSession();
        const hash = window.location.hash;
        if (hash && hash.includes('type=recovery')) {
            isPasswordRecoveryMode = true;
        }

        if (session) {
            currentUserEmail = session.user.email;
            requestSection.style.display = 'none';
            updateSection.style.display = 'block';

            if (isPasswordRecoveryMode) {
                document.getElementById('old-password-group').style.display = 'none';
                document.getElementById('upd-old-password').removeAttribute('required');
                document.getElementById('update-title').innerText = "Reset Password";
                document.getElementById('update-desc').innerText = "Please set your new password.";
            } else {
                document.getElementById('old-password-group').style.display = 'block';
                document.getElementById('upd-old-password').setAttribute('required', 'true');
                document.getElementById('update-title').innerText = "Change Password";
                document.getElementById('update-desc').innerText = "Please enter your current password to verify your identity.";
            }
        } else {
            requestSection.style.display = 'block';
            updateSection.style.display = 'none';
        }
    }

    _supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
            isPasswordRecoveryMode = true;
            checkState();
        }
    });

    await checkState();

    if (requestForm) {
        requestForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-send');
            const email = document.getElementById('req-email').value;

            btn.innerText = 'Sending...';
            btn.disabled = true;

            try {
                const { error } = await _supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: window.location.href 
                });
                if (error) throw error;
                alert("A password reset link has been sent to your email. Please check your inbox (and spam folder).");
            } catch (error) {
                console.error("Reset Error:", error);
                alert("Error: " + error.message);
            } finally {
                btn.innerText = 'Send Reset Link';
                btn.disabled = false;
            }
        });
    }

    if (updateForm) {
        updateForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-update');
            const oldPassword = document.getElementById('upd-old-password').value;
            const newPassword = document.getElementById('upd-password').value;
            const confirmPassword = document.getElementById('upd-confirm').value;

            if (newPassword !== confirmPassword) {
                return alert("Passwords do not match! Please try again.");
            }
            if (newPassword.length < 8) {
                return alert("Password length cannot be less than 8!");
            }
            const passwordSpecialCharRegex = /[+@_%!\-]/; 
            if (!passwordSpecialCharRegex.test(newPassword)) {
                return alert("Password should include special symbols! (+@_%!-)");
            }

            btn.innerText = 'Verifying & Updating...';
            btn.disabled = true;

            try {
                if (!isPasswordRecoveryMode) {
                    if (!oldPassword) throw new Error("Current password is required.");

                    const { error: verifyError } = await _supabase.auth.signInWithPassword({
                        email: currentUserEmail,
                        password: oldPassword,
                    });

                    if (verifyError) {
                        throw new Error("Incorrect current password! Please try again.");
                    }
                }

                const { error: updateError } = await _supabase.auth.updateUser({
                    password: newPassword
                });

                if (updateError) throw updateError;

                alert("Success! Your password has been updated. Please log in again.");
                await _supabase.auth.signOut();
                window.location.href = 'cus_login.html'; 

            } catch (error) {
                console.error("Update Error:", error);
                alert(error.message);
            } finally {
                btn.innerText = 'Update Password';
                btn.disabled = false;
            }
        });
    }

    const cancelBtn = document.getElementById('cancel-reset');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', async (e) => {
            e.preventDefault(); 
            const urlParams = new URLSearchParams(window.location.search);
            const isFromProfile = urlParams.get('from') === 'profile';

            if (isFromProfile && !isPasswordRecoveryMode) {
                window.location.href = 'cus_index.html?page=profile';
            } else {
                await _supabase.auth.signOut(); 
                window.location.href = 'cus_index.html';
            }
        });
    }

    function setupPasswordToggle(inputId, iconId) {
        const inputField = document.getElementById(inputId);
        const toggleIcon = document.getElementById(iconId);

        if (inputField && toggleIcon) {
            toggleIcon.addEventListener('click', () => {
                const type = inputField.type === 'password' ? 'text' : 'password';
                inputField.type = type;

                if (type === 'text') {
                    toggleIcon.classList.remove('fa-eye-slash');
                    toggleIcon.classList.add('fa-eye');
                } else {
                    toggleIcon.classList.remove('fa-eye');
                    toggleIcon.classList.add('fa-eye-slash');
                }
            });
        }
    }

    setupPasswordToggle('upd-old-password', 'toggle-old-pwd');
    setupPasswordToggle('upd-password', 'toggle-pwd');
    setupPasswordToggle('upd-confirm', 'toggle-confirm');
});