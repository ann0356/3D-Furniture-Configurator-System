import { _supabase } from '../../../SUPABASE/supabase_admin_conn.js';

let salesChartInstance = null;
let categoryChartInstance = null;
let dashboardReportData = null;

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

export async function initDashboard() {
    console.log("Dashboard loading real data...");

    const yearSelect = document.getElementById('filter-year');
    const monthSelect = document.getElementById('filter-month');

    // initialize data
    await loadDashboardData(yearSelect.value, monthSelect.value);

    // filter based on year and month
    yearSelect.addEventListener('change', async (e) => {
        await loadDashboardData(e.target.value, monthSelect.value);
    });

    monthSelect.addEventListener('change', async (e) => {
        await loadDashboardData(yearSelect.value, e.target.value);
    });

    const exportButton = document.getElementById('export-report-btn');
    exportButton.addEventListener('click', () => exportDashboardReport(yearSelect, monthSelect, exportButton));
}

async function exportDashboardReport(yearSelect, monthSelect, exportButton) {
    if (!dashboardReportData || typeof html2pdf !== 'function') {
        alert('Dashboard data is still loading. Please wait a moment and try again.');
        return;
    }

    const originalLabel = exportButton.innerHTML;
    const dashboardPage = document.querySelector('.dashboard-page');
    const reportHost = document.getElementById('main-content');

    if (!dashboardPage || !reportHost) {
        alert('Unable to prepare the report. Please refresh and try again.');
        return;
    }

    exportButton.disabled = true;
    exportButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Preparing report…';

    const report = createReportElement(dashboardReportData);
    const previousScrollTop = reportHost.scrollTop;
    dashboardPage.hidden = true;
    reportHost.appendChild(report);
    reportHost.scrollTop = 0;

    try {
        await waitForReportLayout();
        await new Promise((resolve, reject) => {
            html2pdf().set({
                margin: [8, 8, 8, 8],
                filename: `Ruma_Home_Performance_Report_${yearSelect.value}_${monthSelect.value}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: {
                    scale: 2,
                    scrollX: 0,
                    scrollY: 0,
                    useCORS: true,
                    backgroundColor: '#ffffff'
                },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
            }).from(report).save().then(resolve, reject);
        });
    } catch (error) {
        console.error('Unable to export dashboard report:', error);
        alert('Unable to generate the report. Please try again.');
    } finally {
        report.remove();
        dashboardPage.hidden = false;
        reportHost.scrollTop = previousScrollTop;
        exportButton.disabled = false;
        exportButton.innerHTML = originalLabel;
    }
}

function waitForReportLayout() {
    return new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
}

function createReportElement(reportData) {
    const salesChart = document.getElementById('salesChart');
    const salesChartImage = salesChart?.toDataURL('image/png') || '';
    const maxCategoryQuantity = Math.max(1, ...reportData.categorySales.map((category) => category.quantity));
    const categoryRows = reportData.categorySales.slice(0, 4).map((category) => {
        const percentage = Math.round((category.quantity / maxCategoryQuantity) * 100);
        return `
            <div class="pdf-report-category-row">
                <div><span>${escapeHtml(category.name)}</span><strong>${category.quantity} units</strong></div>
                <div class="pdf-report-track"><span style="width: ${percentage}%"></span></div>
            </div>`;
    }).join('') || '<p class="pdf-report-empty">No delivered product sales for this period.</p>';

    const productRows = reportData.productSales.slice(0, 3).map((product, index) => `
        <tr>
            <td><span class="pdf-report-rank">${index + 1}</span>${escapeHtml(product.name)}</td>
            <td>${product.quantity}</td>
        </tr>`).join('') || '<tr><td colspan="2" class="pdf-report-empty">No delivered product sales for this period.</td></tr>';

    const report = document.createElement('section');
    report.className = 'pdf-report';
    report.setAttribute('aria-hidden', 'true');
    report.innerHTML = `
        <header class="pdf-report-header">
            <div class="pdf-report-brand">
                <img class="pdf-report-logo" src="https://dzgtfwdqfqecetnfhcdi.supabase.co/storage/v1/object/public/furniture-images/Ruma_Logo_black.png" alt="Ruma Home" crossorigin="anonymous">
                <small>Admin performance report</small>
            </div>
            <div class="pdf-report-period"><span>Reporting period</span><strong>${escapeHtml(reportData.periodLabel)}</strong></div>
        </header>
        <div class="pdf-report-title">
            <h1>Monthly performance overview</h1>
            <p>A consolidated report based on delivered orders and current customer records.</p>
        </div>
        <section class="pdf-report-kpis">
            <div class="pdf-report-kpi revenue"><span>Total revenue</span><strong>${formatCurrency(reportData.totalRevenue)}</strong></div>
            <div class="pdf-report-kpi orders"><span>Delivered orders</span><strong>${reportData.deliveredOrders.length}</strong></div>
            <div class="pdf-report-kpi customers"><span>New customers</span><strong>${reportData.usersCount}</strong></div>
            <div class="pdf-report-kpi average"><span>Average order value</span><strong>${formatCurrency(reportData.averageOrderValue)}</strong></div>
        </section>
        <section class="pdf-report-analysis">
            <article class="pdf-report-panel pdf-report-sales-panel">
                <div class="pdf-report-panel-heading"><h2>Revenue trend</h2><span>Delivered sales (RM)</span></div>
                ${salesChartImage
                    ? `<img class="pdf-report-chart" src="${salesChartImage}" alt="Revenue trend chart">`
                    : '<p class="pdf-report-empty">Revenue chart is unavailable.</p>'}
            </article>
            <article class="pdf-report-panel">
                <div class="pdf-report-panel-heading"><h2>Category share</h2><span>Units sold</span></div>
                <div class="pdf-report-category-list">${categoryRows}</div>
            </article>
        </section>
        <section class="pdf-report-products">
            <div class="pdf-report-panel-heading"><h2>Top products</h2><span>Delivered units sold</span></div>
            <table>
                <thead><tr><th>Product</th><th>Units sold</th></tr></thead>
                <tbody>${productRows}</tbody>
            </table>
        </section>
        <footer class="pdf-report-footer">Generated by Ruma Home Admin · ${new Date().toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })}</footer>`;
    return report;
}

function createReportData(orders, usersCount, orderItems, year, month) {
    const deliveredOrders = orders.filter((order) => order.status?.toLowerCase() === 'delivered');
    const deliveredOrderIds = new Set(deliveredOrders.map((order) => order.order_id));
    const deliveredItems = orderItems.filter((item) => deliveredOrderIds.has(item.order_id));
    const totalRevenue = deliveredOrders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
    const productSales = buildSalesSummary(deliveredItems, (item) => item.structure?.furniture?.furniture_name);
    const categorySales = buildSalesSummary(deliveredItems, (item) => item.structure?.furniture?.type?.category?.category_name);

    return {
        deliveredOrders,
        usersCount,
        totalRevenue,
        averageOrderValue: deliveredOrders.length ? totalRevenue / deliveredOrders.length : 0,
        productSales,
        categorySales,
        periodLabel: month === 'all' ? `January – December ${year}` : `${MONTH_NAMES[Number(month) - 1]} ${year}`
    };
}

function buildSalesSummary(orderItems, labelSelector) {
    const totals = new Map();
    orderItems.forEach((item) => {
        const label = labelSelector(item);
        if (!label) return;
        totals.set(label, (totals.get(label) || 0) + Number(item.quantity || 0));
    });
    return [...totals.entries()]
        .map(([name, quantity]) => ({ name, quantity }))
        .sort((first, second) => second.quantity - first.quantity || first.name.localeCompare(second.name));
}

function formatCurrency(value) {
    return new Intl.NumberFormat('en-MY', {
        style: 'currency',
        currency: 'MYR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value || 0);
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[character]));
}

// function to get data from db
function getDateRange(year, month) {
    let startDate, endDate;
    if (month === 'all') {
        startDate = `${year}-01-01T00:00:00.000Z`;
        endDate = `${year}-12-31T23:59:59.999Z`;
    } else {
        startDate = `${year}-${month}-01T00:00:00.000Z`;
        const lastDay = new Date(year, parseInt(month), 0).getDate();
        endDate = `${year}-${month}-${lastDay}T23:59:59.999Z`;
    }
    return { startDate, endDate };
}

async function loadDashboardData(year, month) {
    console.log(`Fetching data from database for ${year}, ${month === 'all' ? 'All Year' : 'Month ' + month}...`);
    const { startDate, endDate } = getDateRange(year, month);
    dashboardReportData = null;

    try {
        // get total order
        const { data: ordersData, error: orderErr } = await _supabase
            .from('orders') 
            .select('order_id, total_amount, created_at, status')
            .gte('created_at', startDate)
            .lte('created_at', endDate);

        if (orderErr) throw orderErr;
        const validOrders = ordersData || [];
        const orderIds = validOrders.map(o => o.order_id);

        // get total new user
        const { count: usersCount, error: userErr } = await _supabase
            .from('profiles')
            .select('id', { count: 'exact', head: true }) 
            .gte('created_at', startDate)
            .lte('created_at', endDate);

        if (userErr) throw userErr;

        // get orders detail
        let orderItems = [];
        if (orderIds.length > 0) {
            const { data: itemsData, error: itemsErr } = await _supabase
                .from('order_item')
                .select(`
                    order_id,
                    quantity,
                    structure (
                        furniture (
                            furniture_name,
                            type (
                                category (
                                    category_name
                                )
                            )
                        )
                    )
                `)
                .in('order_id', orderIds); 
            
            if (itemsErr) throw itemsErr;
            orderItems = itemsData || [];
        }

        dashboardReportData = createReportData(validOrders, usersCount || 0, orderItems, year, month);

        // update data to render function
        updateKPIs(validOrders, usersCount || 0, orderItems);
        renderCharts(validOrders, orderItems, year, month);

    } catch (error) {
        console.error("Error fetching data from database:", error);
        alert("Failed to fetch data. Please check your database connection or table names!");
    }
}

// function of display analytic data
function updateKPIs(orders, usersCount, orderItems) {
    // filter order status === delivered
    const deliveredOrders = orders.filter(o => o.status && o.status.toLowerCase() === 'delivered');
    const deliveredOrderIds = deliveredOrders.map(o => o.order_id);
    const deliveredItems = orderItems.filter(item => deliveredOrderIds.includes(item.order_id));

    // total Revenue
    const totalRevenue = deliveredOrders.reduce((sum, order) => sum + Number(order.total_amount), 0);
    document.getElementById('kpi-revenue').innerText = `RM ${totalRevenue.toFixed(2)}`;

    // total Orders
    document.getElementById('kpi-orders').innerText = `${deliveredOrders.length} Orders`;

    // new Users
    document.getElementById('kpi-users').innerText = `+${usersCount} Users`;

    // hot sales product (based on quantity)
    const productSales = {};
    deliveredItems.forEach(item => {
        const fName = item.structure?.furniture?.furniture_name;
        if (fName) {
            productSales[fName] = (productSales[fName] || 0) + Number(item.quantity);
        }
    });

    let hotProduct = "No Data";
    let maxQty = 0;
    for (const [name, qty] of Object.entries(productSales)) {
        if (qty > maxQty) {
            maxQty = qty;
            hotProduct = name;
        }
    }
    document.getElementById('kpi-hot-product').innerText = hotProduct;
}

// render function
function renderCharts(orders, orderItems, year, month) {

    if (salesChartInstance) salesChartInstance.destroy();
    if (categoryChartInstance) categoryChartInstance.destroy();

    // filter status == delivered
    const deliveredOrders = orders.filter(o => o.status && o.status.toLowerCase() === 'delivered');
    const deliveredOrderIds = deliveredOrders.map(o => o.order_id);
    const deliveredItems = orderItems.filter(item => deliveredOrderIds.includes(item.order_id));

    // sales trend
    let salesLabels = [];
    let salesData = [];

    if (month === 'all') {
        salesLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        salesData = new Array(12).fill(0);
        deliveredOrders.forEach(o => {
            const m = new Date(o.created_at).getMonth(); 
            salesData[m] += Number(o.total_amount);
        });
    } else {
        const daysInMonth = new Date(year, parseInt(month), 0).getDate();
        salesLabels = Array.from({length: daysInMonth}, (_, i) => `Day ${i+1}`);
        salesData = new Array(daysInMonth).fill(0);
        deliveredOrders.forEach(o => {
            const d = new Date(o.created_at).getDate() - 1; 
            salesData[d] += Number(o.total_amount);
        });
    }

    const ctxSales = document.getElementById('salesChart').getContext('2d');
    salesChartInstance = new Chart(ctxSales, {
        type: 'line',
        data: {
            labels: salesLabels,
            datasets: [{
                label: `Delivered Sales (RM) - ${year} ${month === 'all' ? '(All Year)' : '(Month ' + month + ')'}`,
                data: salesData,
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.2)',
                tension: 0.3, fill: true
            }]
        },
        options: { responsive: true }
    });

    // pie chart
    const categorySales = {};
    deliveredItems.forEach(item => {
        const cName = item.structure?.furniture?.type?.category?.category_name;
        if (cName) {
            categorySales[cName] = (categorySales[cName] || 0) + Number(item.quantity);
        }
    });

    const catLabels = Object.keys(categorySales);
    const catData = Object.values(categorySales);

    if (catLabels.length === 0) {
        catLabels.push('No Sales');
        catData.push(1); 
    }

    // generate color label
    function generateDynamicColors(count) {
        const colors = [];
        for (let i = 0; i < count; i++) {
            const hue = (i * 137.5) % 360; 
            colors.push(`hsl(${hue}, 75%, 55%)`);
        }
        return colors;
    }

    const dynamicBgColors = generateDynamicColors(catLabels.length);
    const ctxCategory = document.getElementById('categoryChart').getContext('2d');
    
    categoryChartInstance = new Chart(ctxCategory, {
        type: 'doughnut',
        data: {
            labels: catLabels,
            datasets: [{
                data: catData, 
                backgroundColor: dynamicBgColors,
                borderColor: '#ffffff',
                borderWidth: 2
            }]
        },

        plugins: [ChartDataLabels], 
        options: { 
            responsive: true,
            plugins: {
                datalabels: {
                    color: '#ffffff', 
                    font: { weight: 'bold', size: 11 },
                    textAlign: 'center', 
                    formatter: (value, context) => {
                        if (context.chart.data.labels[0] === 'No Sales') return '';
                        const labelName = context.chart.data.labels[context.dataIndex];
                        return labelName + '\n' + value;
                    }
                }
            }
        }
    });
}
