import { _supabase } from '../../SUPABASE/supabase_admin_conn.js';
import { initDashboard } from './components/dashboard.js';
import { initProducts } from './components/products.js';
import { initAdminOrder } from './components/orders.js';
import { initFeedback } from './components/feedback.js';

const mainContent = document.getElementById('main-content');
const sidebar = document.getElementById('admin-sidebar');
const menuToggle = document.getElementById('menu-toggle');
const navBackdrop = document.getElementById('nav-backdrop');
let isAdminExitCleanupBound = false;

function setDrawerState(isOpen) {
    sidebar.classList.toggle('is-open', isOpen);
    navBackdrop.classList.toggle('is-visible', isOpen);
    menuToggle.setAttribute('aria-expanded', String(isOpen));
    menuToggle.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
}

function setActiveMenu(pageName) {
    document.querySelectorAll('.menu-item').forEach((item) => {
        const isCurrent = item.getAttribute('data-page') === pageName;
        item.classList.toggle('active', isCurrent);
        if (isCurrent) item.setAttribute('aria-current', 'page');
        else item.removeAttribute('aria-current');
    });
}

function bindAdminExitCleanup() {
    if (isAdminExitCleanupBound) return;

    window.addEventListener('pagehide', () => {
        localStorage.removeItem('sb-admin-auth-token');
        sessionStorage.removeItem('sb-admin-auth-token');
    });

    window.addEventListener('pageshow', (event) => {
        if (event.persisted) window.location.replace('admin_login.html');
    });

    isAdminExitCleanupBound = true;
}

async function checkAuth() {
    try {
        const { data: { session }, error: sessionError } = await _supabase.auth.getSession();

        if (sessionError || !session) {
            window.location.replace('admin_login.html');
            return;
        }

        const { data: profileData, error: profileError } = await _supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single();

        if (profileError || profileData?.role !== 'superadmin') {
            await _supabase.auth.signOut();
            window.location.replace('admin_login.html');
            return;
        }

        document.body.classList.remove('admin-auth-pending');
        bindAdminExitCleanup();

        const savedPage = localStorage.getItem('admin_current_page') || 'dashboard';
        setActiveMenu(savedPage);
        await loadContent(savedPage);
    } catch (error) {
        console.error('Identity error:', error);
        window.location.replace('admin_login.html');
    }
}

async function loadContent(pageName) {
    try {
        localStorage.setItem('admin_current_page', pageName);
        setActiveMenu(pageName);
        mainContent.innerHTML = '<div class="admin-page-loading" role="status">Loading workspace…</div>';

        const response = await fetch(`../HTML/components/${pageName}.html`);
        if (!response.ok) throw new Error('Failed to load the requested workspace.');

        mainContent.innerHTML = await response.text();

        if (pageName === 'dashboard') await initDashboard();
        else if (pageName === 'products') await initProducts();
        else if (pageName === 'orders') await initAdminOrder();
        else if (pageName === 'customer_feedback') await initFeedback();
    } catch (error) {
        console.error(error);
        mainContent.innerHTML = '<div class="admin-page-error" role="alert"><h2>Unable to load this page</h2><p>Please refresh and try again.</p></div>';
    }
}

window.addEventListener('DOMContentLoaded', checkAuth);

menuToggle.addEventListener('click', () => {
    setDrawerState(!sidebar.classList.contains('is-open'));
});

navBackdrop.addEventListener('click', () => setDrawerState(false));

window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && sidebar.classList.contains('is-open')) {
        setDrawerState(false);
        menuToggle.focus();
    }
});

window.addEventListener('resize', () => {
    if (window.innerWidth > 900) setDrawerState(false);
});

document.querySelectorAll('.menu-item').forEach((item) => {
    item.addEventListener('click', async function handleNavigation(event) {
        event.preventDefault();
        const pageId = this.getAttribute('data-page');
        setDrawerState(false);
        await loadContent(pageId);
        mainContent.focus({ preventScroll: true });
    });
});

document.querySelector('.logo')?.addEventListener('click', async (event) => {
    event.preventDefault();
    setDrawerState(false);
    await loadContent('dashboard');
    mainContent.focus({ preventScroll: true });
});

const logoutBtn = document.getElementById('logout-btn');
logoutBtn?.addEventListener('click', async () => {
    logoutBtn.disabled = true;
    localStorage.removeItem('admin_current_page');
    await _supabase.auth.signOut();
    window.location.replace('admin_login.html');
});
