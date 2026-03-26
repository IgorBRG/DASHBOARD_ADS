import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { 
    getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, 
    signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { 
    getFirestore, collection, getDocs, addDoc, updateDoc, 
    deleteDoc, doc, query, where
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';

// --- State & Globals ---
let state = {
    campaigns: [],
    records: []
};
let currentView = 'dashboard';
let activeCampaignId = null;
let detailRevenueChartInstance = null;
let detailRoasChartInstance = null;

// Firebase Globals
let app, auth, db;
let currentUser = null;
let isFirebaseConfigured = false;
let isAppInitialized = false;

// Formatters
const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
const formatNumber = (val) => new Intl.NumberFormat('pt-BR').format(val);
const formatDateBR = (dateStr) => {
    const parts = dateStr.split('-');
    if(parts.length < 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    checkFirebaseSettings();
    setupAuthUI();
});

function checkFirebaseSettings() {
    if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "SUA_API_KEY_AQUI") {
        isFirebaseConfigured = true;
        try {
            app = initializeApp(firebaseConfig);
            auth = getAuth(app);
            db = getFirestore(app);
            
            // Listen to auth state
            onAuthStateChanged(auth, (user) => {
                if (user) {
                    currentUser = user;
                    document.getElementById('user-display-email').textContent = user.email;
                    showApp();
                    fetchDataFromFirestore();
                } else {
                    currentUser = null;
                    showAuth();
                }
            });
        } catch (e) {
            console.error("Firebase init failed:", e);
            showFirebaseWarning();
        }
    } else {
        showFirebaseWarning();
    }
}

function showFirebaseWarning() {
    document.getElementById('firebase-warning').classList.remove('hidden');
    showAuth();
}

function showApp() {
    document.getElementById('auth-container').classList.add('hidden');
    document.getElementById('app-container').classList.remove('hidden');
}

function showAuth() {
    document.getElementById('auth-container').classList.remove('hidden');
    document.getElementById('app-container').classList.add('hidden');
    hideLoader();
}

function showLoader() { document.getElementById('global-loader').classList.remove('hidden'); }
function hideLoader() { document.getElementById('global-loader').classList.add('hidden'); }

// --- Auth Logic ---
function setupAuthUI() {
    const form = document.getElementById('auth-form');
    const emailInput = document.getElementById('auth-email');
    const passInput = document.getElementById('auth-password');
    const errorMsg = document.getElementById('auth-error');
    const btnRegister = document.getElementById('btn-register');

    const showError = (msg) => {
        errorMsg.textContent = msg;
        errorMsg.classList.remove('hidden');
    };

    // Login Form
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorMsg.classList.add('hidden');
        if (!isFirebaseConfigured) { showError("Firebase não configurado!"); return; }
        
        try {
            showLoader();
            await signInWithEmailAndPassword(auth, emailInput.value, passInput.value);
        } catch (error) {
            hideLoader();
            console.error(error);
            showError("Erro: " + error.message);
        }
    });

    // Register Btn
    btnRegister.addEventListener('click', async () => {
        errorMsg.classList.add('hidden');
        if (!isFirebaseConfigured) { showError("Firebase não configurado!"); return; }
        
        if (!emailInput.value || !passInput.value) {
            showError("Preencha email e senha primeiro para registrar.");
            return;
        }

        try {
            showLoader();
            await createUserWithEmailAndPassword(auth, emailInput.value, passInput.value);
        } catch (error) {
            hideLoader();
            console.error(error);
            showError("Erro ao registrar: " + error.message);
        }
    });

    // Logout
    document.getElementById('btn-logout').addEventListener('click', async () => {
        try {
            await signOut(auth);
            state = { campaigns: [], records: [] }; // clear memory
        } catch (e) { console.error("Logout error", e); }
    });
}

// --- Firestore Data Logic ---
async function fetchDataFromFirestore() {
    showLoader();
    try {
        state.campaigns = [];
        state.records = [];

        // Fetch Campaigns
        const qCamp = query(collection(db, "campaigns"), where("userId", "==", currentUser.uid));
        const campSnap = await getDocs(qCamp);
        campSnap.forEach(doc => state.campaigns.push({ id: doc.id, ...doc.data() }));

        // Fetch Records
        const qRec = query(collection(db, "records"), where("userId", "==", currentUser.uid));
        const recSnap = await getDocs(qRec);
        recSnap.forEach(doc => state.records.push({ id: doc.id, ...doc.data() }));

        // Sort
        state.campaigns.sort((a,b) => b.createdAt - a.createdAt);
        state.records.sort((a,b) => new Date(b.date) - new Date(a.date));

        initDashboard();
    } catch (e) {
        console.error("Error fetching data: ", e);
        alert("Falha ao buscar dados na nuvem.");
    } finally {
        hideLoader();
    }
}

// --- UI Logic setup (After Data Fetch) ---
function initDashboard() {
    if(!isAppInitialized) {
        setupNavigation();
        setupModals();
        isAppInitialized = true;
    }
    switchView('dashboard');
}

// --- Aggregation & Math ---
function calculateAggregates(recordsArr) {
    let totalSpend = 0, totalSales = 0, totalRevenue = 0, monthlyProfit = 0;
    
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    recordsArr.forEach(r => {
        totalSpend += r.spend;
        totalSales += r.sales;
        totalRevenue += r.revenue;
        
        // Parse yyyy-mm-dd safely
        const rDate = new Date(r.date + "T00:00:00"); 
        if (rDate.getMonth() === currentMonth && rDate.getFullYear() === currentYear) {
            monthlyProfit += (r.revenue - r.spend);
        }
    });
    
    const roas = totalSpend > 0 ? (totalRevenue / totalSpend) : 0;
    const cpa = totalSales > 0 ? (totalSpend / totalSales) : 0;
    
    return { 
        totalSpend, totalSales, totalRevenue, roas, cpa, monthlyProfit 
    };
}

// --- Render Views ---
function renderGlobalDashboard() {
    const agg = calculateAggregates(state.records);
    
    document.getElementById('global-val-gasto').textContent = formatCurrency(agg.totalSpend);
    document.getElementById('global-val-vendas').textContent = formatNumber(agg.totalSales);
    document.getElementById('global-val-faturamento').textContent = formatCurrency(agg.totalRevenue);
    document.getElementById('global-val-lucro').textContent = formatCurrency(agg.monthlyProfit);
    document.getElementById('global-val-roas').textContent = agg.roas.toFixed(2) + 'x';
    document.getElementById('global-val-cpa').textContent = formatCurrency(agg.cpa);
    
    // Lucro color adjust
    const globalLucroEl = document.getElementById('global-val-lucro');
    globalLucroEl.style.color = agg.monthlyProfit < 0 ? 'var(--accent-red)' : 'var(--text-primary)';

    const tbody = document.getElementById('global-campaigns-table');
    const emptyState = document.getElementById('global-empty-state');
    const tableWrap = tbody.closest('.table-responsive');
    
    tbody.innerHTML = '';
    
    if(state.campaigns.length === 0) {
        emptyState.classList.remove('hidden');
        tableWrap.style.display = 'none';
    } else {
        emptyState.classList.add('hidden');
        tableWrap.style.display = 'block';
        
        // Render up to 5 recent campaigns
        const recentCampaigns = state.campaigns.slice(0, 5);
        recentCampaigns.forEach(camp => {
            const cRecs = state.records.filter(r => r.campaignId === camp.id);
            const cAgg = calculateAggregates(cRecs);
            
            const totalProfit = cAgg.totalRevenue - cAgg.totalSpend;
            const profitColor = totalProfit < 0 ? 'color: var(--accent-red)' : 'color: var(--accent-green)';
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><span class="link-cell" onclick="openCampaignDetail('${camp.id}')">${camp.name}</span></td>
                <td>${formatCurrency(cAgg.totalSpend)}</td>
                <td>${formatCurrency(cAgg.totalRevenue)}</td>
                <td style="${profitColor}; font-weight:600">${formatCurrency(totalProfit)}</td>
                <td><span class="badge ${cAgg.roas >= 2 ? 'badge-success' : (cAgg.roas > 1 ? 'badge-warning' : 'badge-danger')}">${cAgg.roas.toFixed(2)}x</span></td>
                <td>${formatCurrency(cAgg.cpa)}</td>
                <td>
                    <button class="btn-icon" title="Ver Detalhes" onclick="openCampaignDetail('${camp.id}')"><i class="ph ph-arrow-right"></i></button>
                    <button class="btn-icon delete-btn" title="Excluir" onclick="promptDelete('campaign', '${camp.id}')"><i class="ph ph-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
}

function renderCampaignsList() {
    const container = document.getElementById('campaign-cards-container');
    const emptyState = document.getElementById('campaigns-empty-state');
    
    container.innerHTML = '';
    
    if(state.campaigns.length === 0) {
        emptyState.classList.remove('hidden');
    } else {
        emptyState.classList.add('hidden');
        state.campaigns.forEach(camp => {
            const cRecs = state.records.filter(r => r.campaignId === camp.id);
            const cAgg = calculateAggregates(cRecs);
            
            const card = document.createElement('div');
            card.className = 'card campaign-card';
            card.innerHTML = `
                <div class="campaign-actions-abs" onclick="event.stopPropagation()">
                    <button class="btn-icon edit-btn" title="Editar Nome" onclick="openModalCampaign('${camp.id}', '${camp.name}')"><i class="ph ph-pencil-simple"></i></button>
                    <button class="btn-icon delete-btn" title="Excluir" onclick="promptDelete('campaign', '${camp.id}')"><i class="ph ph-trash"></i></button>
                </div>
                <div class="campaign-card-header" onclick="openCampaignDetail('${camp.id}')">
                    <div>
                        <div class="campaign-card-title"><i class="ph ph-folder-open"></i> ${camp.name}</div>
                        <div class="campaign-card-date">Criada em: ${new Date(camp.createdAt).toLocaleDateString()}</div>
                    </div>
                </div>
                <div class="campaign-card-stats" onclick="openCampaignDetail('${camp.id}')">
                    <div class="stat-item">
                        <span class="stat-label">Total Gasto</span>
                        <span class="stat-value">${formatCurrency(cAgg.totalSpend)}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">ROAS</span>
                        <span class="stat-value" style="color: ${cAgg.roas >= 2 ? 'var(--accent-green)' : 'inherit'}">${cAgg.roas.toFixed(2)}x</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">CPA</span>
                        <span class="stat-value">${formatCurrency(cAgg.cpa)}</span>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    }
}

function renderCampaignDetail() {
    if(!activeCampaignId) return;
    const camp = state.campaigns.find(c => c.id === activeCampaignId);
    if(!camp) { switchView('campaigns'); return; }
    
    const cRecs = state.records.filter(r => r.campaignId === activeCampaignId);
    const agg = calculateAggregates(cRecs);

    document.getElementById('detail-campaign-name').textContent = camp.name;
    document.getElementById('detail-val-gasto').textContent = formatCurrency(agg.totalSpend);
    document.getElementById('detail-val-vendas').textContent = formatNumber(agg.totalSales);
    document.getElementById('detail-val-faturamento').textContent = formatCurrency(agg.totalRevenue);
    document.getElementById('detail-val-lucro').textContent = formatCurrency(agg.monthlyProfit);
    document.getElementById('detail-val-roas').textContent = agg.roas.toFixed(2) + 'x';
    document.getElementById('detail-val-cpa').textContent = formatCurrency(agg.cpa);

    // Lucro color adjust
    const detailLucroEl = document.getElementById('detail-val-lucro');
    detailLucroEl.style.color = agg.monthlyProfit < 0 ? 'var(--accent-red)' : 'var(--text-primary)';

    const tbody = document.getElementById('detail-records-table');
    const emptyState = document.getElementById('detail-empty-state');
    const tableWrap = tbody.closest('.table-responsive');
    const chartsArea = document.querySelector('#view-campaign-detail .charts-area');
    
    tbody.innerHTML = '';
    
    if(cRecs.length === 0) {
        emptyState.classList.remove('hidden');
        tableWrap.style.display = 'none';
        chartsArea.style.display = 'none';
    } else {
        emptyState.classList.add('hidden');
        tableWrap.style.display = 'block';
        chartsArea.style.display = 'grid';
        
        cRecs.forEach(r => {
            const diaroCpa = r.sales > 0 ? (r.spend / r.sales) : 0;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${formatDateBR(r.date)}</strong></td>
                <td>${formatCurrency(r.spend)}</td>
                <td>${r.sales}</td>
                <td style="color: var(--accent-green)">${formatCurrency(r.revenue)}</td>
                <td><span class="badge ${r.roas >= 2 ? 'badge-success' : (r.roas > 1 ? 'badge-warning' : 'badge-danger')}">${r.roas.toFixed(2)}x</span></td>
                <td>${formatCurrency(diaroCpa)}</td>
                <td>
                    <button class="btn-icon edit-btn" title="Editar" onclick='openModalRecord(${JSON.stringify(r)})'><i class="ph ph-pencil-simple"></i></button>
                    <button class="btn-icon delete-btn" title="Excluir" onclick="promptDelete('record', '${r.id}')"><i class="ph ph-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
        
        updateCharts(cRecs);
    }
}

// --- Navigation & Views ---
function setupNavigation() {
    document.getElementById('nav-dashboard').addEventListener('click', (e) => { e.preventDefault(); switchView('dashboard'); });
    document.getElementById('nav-campaigns').addEventListener('click', (e) => { e.preventDefault(); switchView('campaigns'); });
    document.getElementById('btn-goto-campaigns').addEventListener('click', () => switchView('campaigns'));
    document.getElementById('btn-back-campaigns').addEventListener('click', () => switchView('campaigns'));
}

function switchView(viewName) {
    currentView = viewName;
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
    
    document.getElementById(`view-${viewName}`).classList.add('active');
    
    if(viewName === 'dashboard') {
        document.getElementById('nav-dashboard').classList.add('active');
        renderGlobalDashboard();
    } else if (viewName === 'campaigns') {
        document.getElementById('nav-campaigns').classList.add('active');
        activeCampaignId = null;
        renderCampaignsList();
    } else if (viewName === 'campaign-detail') {
        renderCampaignDetail();
    }
    
    // Update Badge total
    const bdg = document.querySelector('.total-campaigns-badge');
    if(bdg) bdg.textContent = state.campaigns.length;
}

window.openCampaignDetail = (id) => {
    activeCampaignId = id;
    switchView('campaign-detail');
}

// --- Modals & CRUD Logic (Cloud) ---
function setupModals() {
    // Campaign Modal
    const modalCamp = document.getElementById('modal-campaign');
    const openCampModal = () => { document.getElementById('form-campaign').reset(); document.getElementById('form-campaign-id').value=''; document.getElementById('modal-campaign-title').textContent='Nova Campanha'; modalCamp.classList.remove('hidden'); };
    const closeCampModal = () => modalCamp.classList.add('hidden');
    
    document.getElementById('btn-create-campaign').addEventListener('click', openCampModal);
    document.getElementById('btn-add-empty-campaign').addEventListener('click', openCampModal);
    document.getElementById('btn-close-modal-campaign').addEventListener('click', closeCampModal);
    document.getElementById('btn-cancel-campaign').addEventListener('click', closeCampModal);
    document.getElementById('btn-edit-campaign-name').addEventListener('click', () => {
        const c = state.campaigns.find(x => x.id === activeCampaignId);
        if(c) window.openModalCampaign(c.id, c.name);
    });

    // Save Campaign to Firestore
    document.getElementById('form-campaign').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('form-campaign-id').value;
        const name = document.getElementById('form-campaign-name').value.trim();
        const btnSave = document.getElementById('btn-save-campaign');
        btnSave.disabled = true; btnSave.textContent = 'Salvando...';
        
        try {
            if(id) {
                // Edit
                await updateDoc(doc(db, "campaigns", id), { name });
                const idx = state.campaigns.findIndex(c => c.id === id);
                if(idx > -1) state.campaigns[idx].name = name;
            } else {
                // Create
                const newCamp = { name, createdAt: Date.now(), userId: currentUser.uid };
                const docRef = await addDoc(collection(db, "campaigns"), newCamp);
                state.campaigns.unshift({ id: docRef.id, ...newCamp }); // Add to front
            }
            closeCampModal();
            refreshCurrentView();
        } catch (err) {
            console.error(err); alert('Erro ao salvar campanha!');
        } finally {
            btnSave.disabled = false; btnSave.textContent = 'Salvar Campanha';
        }
    });

    window.openModalCampaign = (id, currentName) => {
        document.getElementById('form-campaign-id').value = id;
        document.getElementById('form-campaign-name').value = currentName;
        document.getElementById('modal-campaign-title').textContent = 'Editar Campanha';
        modalCamp.classList.remove('hidden');
    };

    // Record Modal
    const modalRec = document.getElementById('modal-record');
    const openRecModal = () => { 
        document.getElementById('form-record').reset(); 
        document.getElementById('form-record-id').value=''; 
        // Auto-fill today
        document.getElementById('record-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('modal-record-title').textContent='Registrar Dia'; 
        modalRec.classList.remove('hidden'); 
    };
    const closeRecModal = () => modalRec.classList.add('hidden');

    document.getElementById('btn-add-daily-record').addEventListener('click', openRecModal);
    document.getElementById('btn-add-first-record').addEventListener('click', openRecModal);
    document.getElementById('btn-close-modal-record').addEventListener('click', closeRecModal);
    document.getElementById('btn-cancel-record').addEventListener('click', closeRecModal);

    // Save Record to Firestore
    document.getElementById('form-record').addEventListener('submit', async (e) => {
        e.preventDefault();
        if(!activeCampaignId) return;

        const id = document.getElementById('form-record-id').value;
        const date = document.getElementById('record-date').value;
        const spend = parseFloat(document.getElementById('record-spend').value);
        const sales = parseInt(document.getElementById('record-sales').value);
        const revenue = parseFloat(document.getElementById('record-revenue').value);
        const roas = spend > 0 ? (revenue / spend) : 0;

        const recordData = { 
            campaignId: activeCampaignId, 
            userId: currentUser.uid,
            date, spend, sales, revenue, roas 
        };

        const btnSave = document.getElementById('btn-save-record');
        btnSave.disabled = true; btnSave.textContent = 'Salvando...';

        try {
            if(id) {
                await updateDoc(doc(db, "records", id), recordData);
                const idx = state.records.findIndex(r => r.id === id);
                if(idx > -1) state.records[idx] = { id, ...recordData };
            } else {
                const docRef = await addDoc(collection(db, "records"), recordData);
                state.records.push({ id: docRef.id, ...recordData });
            }
            state.records.sort((a,b) => new Date(b.date) - new Date(a.date)); // Keep sorted
            closeRecModal();
            refreshCurrentView();
        } catch (err) {
            console.error(err); alert('Erro ao salvar registro.');
        } finally {
            btnSave.disabled = false; btnSave.textContent = 'Salvar Registro';
        }
    });

    window.openModalRecord = (r) => {
        document.getElementById('form-record-id').value = r.id;
        document.getElementById('record-date').value = r.date;
        document.getElementById('record-spend').value = r.spend;
        document.getElementById('record-sales').value = r.sales;
        document.getElementById('record-revenue').value = r.revenue;
        document.getElementById('modal-record-title').textContent = 'Editar Registro';
        modalRec.classList.remove('hidden');
    };

    // Delete Modal
    const modalDelete = document.getElementById('modal-delete');
    const closeDelModal = () => modalDelete.classList.add('hidden');
    document.getElementById('btn-cancel-delete').addEventListener('click', closeDelModal);

    window.promptDelete = (type, id) => {
        document.getElementById('delete-target-id').value = id;
        document.getElementById('delete-type').value = type;
        document.getElementById('delete-msg').textContent = type === 'campaign' 
            ? 'Cuidado! Excluir a campanha apagará TODOS os dias registrados nela.'
            : 'Excluir este dia removerá seus valores dos gráficos e totais.';
        modalDelete.classList.remove('hidden');
    };

    document.getElementById('btn-confirm-delete').addEventListener('click', async () => {
        const id = document.getElementById('delete-target-id').value;
        const type = document.getElementById('delete-type').value;
        const btnDelete = document.getElementById('btn-confirm-delete');
        btnDelete.disabled = true; btnDelete.textContent = 'Excluindo...';

        try {
            if(type === 'campaign') {
                // Delete campaign
                await deleteDoc(doc(db, "campaigns", id));
                const recsToDelete = state.records.filter(r => r.campaignId === id);
                for(let rec of recsToDelete) {
                    await deleteDoc(doc(db, "records", rec.id));
                }
                state.campaigns = state.campaigns.filter(c => c.id !== id);
                state.records = state.records.filter(r => r.campaignId !== id);
            } else if (type === 'record') {
                await deleteDoc(doc(db, "records", id));
                state.records = state.records.filter(r => r.id !== id);
            }
            closeDelModal();
            refreshCurrentView();
        } catch (err) {
            console.error(err); alert('Erro ao excluir dados.');
        } finally {
            btnDelete.disabled = false; btnDelete.textContent = 'Sim, Excluir';
        }
    });
}

function refreshCurrentView() {
    if(currentView === 'dashboard') renderGlobalDashboard();
    else if(currentView === 'campaigns') renderCampaignsList();
    else if(currentView === 'campaign-detail') renderCampaignDetail();
}

// --- Charts Logic ---
function updateCharts(records) {
    const sortedDesc = [...records].sort((a,b) => new Date(a.date) - new Date(b.date)); 
    const labels = sortedDesc.map(r => formatDateBR(r.date));
    const revenueData = sortedDesc.map(r => r.revenue);
    const spendData = sortedDesc.map(r => r.spend);
    const roasData = sortedDesc.map(r => r.roas);

    // Common Chart Options
    const commonOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: {
            legend: { position: 'top', labels: { color: '#94a3b8', font: { family: 'Inter' } } },
            tooltip: { backgroundColor: 'rgba(15, 23, 42, 0.9)', titleColor: '#fff', padding: 12, cornerRadius: 8 }
        },
        scales: {
            x: { grid: { color: 'rgba(51, 65, 85, 0.3)' }, ticks: { color: '#64748b' } },
            y: { grid: { color: 'rgba(51, 65, 85, 0.3)' }, ticks: { color: '#64748b' }, beginAtZero: true }
        }
    };

    // Revenue Chart
    const ctxRev = document.getElementById('detailRevenueChart').getContext('2d');
    if (detailRevenueChartInstance) detailRevenueChartInstance.destroy();
    
    // Gradient definitions
    const gradientRev = ctxRev.createLinearGradient(0, 0, 0, 400);
    gradientRev.addColorStop(0, 'rgba(16, 185, 129, 0.5)'); gradientRev.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
    
    detailRevenueChartInstance = new Chart(ctxRev, {
        type: 'line',
        data: {
            labels,
            datasets: [
                { label: 'Faturamento (R$)', data: revenueData, borderColor: '#10b981', backgroundColor: gradientRev, borderWidth: 3, tension: 0.4, fill: true, pointBackgroundColor: '#10b981' },
                { label: 'Gasto (R$)', data: spendData, borderColor: '#3b82f6', backgroundColor: 'transparent', borderWidth: 3, tension: 0.4, borderDash: [5, 5], pointBackgroundColor: '#3b82f6' }
            ]
        },
        options: commonOptions
    });

    // ROAS Chart
    const ctxRoas = document.getElementById('detailRoasChart').getContext('2d');
    if (detailRoasChartInstance) detailRoasChartInstance.destroy();
    
    detailRoasChartInstance = new Chart(ctxRoas, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'ROAS', data: roasData, backgroundColor: '#f59e0b', borderRadius: 6
            }]
        },
        options: commonOptions
    });
}
