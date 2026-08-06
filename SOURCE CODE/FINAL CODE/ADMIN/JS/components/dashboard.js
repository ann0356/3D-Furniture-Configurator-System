import { _supabase } from '../../../SUPABASE/supabase_admin_conn.js';

let salesChartInstance = null;
let categoryChartInstance = null;

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

    // Export PDF
    document.getElementById('export-report-btn').addEventListener('click', () => {
        const element = document.querySelector('.dashboard-page');
        const headerArea = document.querySelector('.page-header');
        
        // hide other layout
        if (headerArea) headerArea.style.display = 'none';

        html2pdf().set({
            margin: [10, 0, 10, 0],
            filename: `Report_${yearSelect.value}_${monthSelect.value}.pdf`,
            image: { type: 'jpeg', quality: 1 },
            html2canvas: { 
                scale: 2, 
                scrollX: 0, 
                scrollY: 0, 
                useCORS: true 
            }, 
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
        }).from(element).save().then(() => {
            // redisplay the hidden layout
            if (headerArea) headerArea.style.display = 'flex';
        });
    });
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