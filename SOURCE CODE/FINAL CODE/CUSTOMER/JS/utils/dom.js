/**
 * Small, dependency-free DOM helpers for values returned by Supabase.
 * Database content must be treated as untrusted when it is placed in HTML.
 */
export function escapeHTML(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

export function safeAssetUrl(value, fallback = '') {
    if (!value) return fallback;

    try {
        const url = new URL(String(value), window.location.origin);
        return url.protocol === 'https:' ? url.href : fallback;
    } catch {
        return fallback;
    }
}

export function safeNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}
