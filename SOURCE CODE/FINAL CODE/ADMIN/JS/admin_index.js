import { _supabase } from '../../SUPABASE/supabase_admin_conn.js';
import { initDashboard } from './components/dashboard.js';
import { initProducts } from './components/products.js';
import { initAdminOrder } from './components/orders.js'; 
import { initFeedback } from './components/feedback.js';

const mainContent = document.getElementById('main-content');
let isAdminExitCleanupBound = false;

function bindAdminExitCleanup() {
    if (isAdminExitCleanupBound) return;

    window.addEventListener('pagehide', () => {
        // pagehide is synchronous, unlike an async signOut request that browsers may cancel.
        localStorage.removeItem('sb-admin-auth-token');
        sessionStorage.removeItem('sb-admin-auth-token');
    });

    // A page restored from the browser's back-forward cache must re-authenticate too.
    window.addEventListener('pageshow', (event) => {
        if (event.persisted) window.location.replace('admin_login.html');
    });

    isAdminExitCleanupBound = true;
}

// check authentication
async function checkAuth() {
    try {
        const { data: { session }, error: sessionError } = await _supabase.auth.getSession();

        // if no session, back to login page
        if (sessionError || !session) {
            window.location.href = 'admin_login.html'; 
            return;
        }

        const userId = session.user.id;

        const { data: profileData, error: profileError } = await _supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();

        if (profileError || !profileData || profileData.role !== 'superadmin') {
            await _supabase.auth.signOut(); 
            alert("Access Denied: You do not have administrator privileges.");
            window.location.href = 'admin_login.html';
            return;
        }

        document.body.style.display = 'flex'; 
        bindAdminExitCleanup();
        
        // display the page view last time
        const savedPage = localStorage.getItem('admin_current_page') || 'dashboard';
        loadContent(savedPage);

        // active the aside button for current page
        document.querySelectorAll('.menu-item').forEach(el => {
            el.classList.remove('active');
            if (el.getAttribute('data-page') === savedPage) {
                el.classList.add('active');
            }
        });

    } catch (error) {
        console.error("Identity error:", error);
        window.location.href = 'admin_login.html';
    }
}

// page loading 
async function loadContent(pageName) {
    try {
        // save page info to local
        localStorage.setItem('admin_current_page', pageName);

        mainContent.innerHTML = "<p style='padding:20px;'>Loading...</p>"; 
        
        const response = await fetch(`../HTML/components/${pageName}.html`);
        if (!response.ok) throw new Error("Fail to load!");
        
        const html = await response.text();
        mainContent.innerHTML = html;

        if (pageName === 'dashboard') {
            await initDashboard(); 
        } else if (pageName === 'products') {
            await initProducts(); 
        } else if (pageName === 'orders') {
            await initAdminOrder();
        }else if (pageName === 'customer_feedback') {
            await initFeedback();
        }

    } catch (error) {
        console.error(error);
        mainContent.innerHTML = "<h2>Failed to load, please try again.</h2>";
    }
}

window.addEventListener('DOMContentLoaded', () => {
    checkAuth();
});

document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', function(e) {
        e.preventDefault();
        document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
        this.classList.add('active');
        
        const pageId = this.getAttribute('data-page');
        loadContent(pageId); 
    });
});

const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        // clear local storage
        localStorage.removeItem('admin_current_page');
        
        await _supabase.auth.signOut();
        window.location.href = 'admin_login.html';
    });
}
