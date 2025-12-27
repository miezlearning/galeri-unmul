// --- Search Page JavaScript ---
// API untuk pencarian mahasiswa
const SEARCH_API = 'https://api.ryzumi.vip/api/search/mahasiswa';
const AIS_PHOTO_URL = 'https://ais.unmul.ac.id/file/foto/';

// --- DOM Elements ---
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const searchIcon = document.getElementById('search-icon');
const loadingIcon = document.getElementById('loading-icon');
const resultsContainer = document.getElementById('results-container');
const searchStats = document.getElementById('search-stats');
const resultCount = document.getElementById('result-count');
const searchQueryDisplay = document.getElementById('search-query-display');
const emptyState = document.getElementById('empty-state');
const noResults = document.getElementById('no-results');
const errorState = document.getElementById('error-state');
const errorMessage = document.getElementById('error-message');
const themeToggle = document.getElementById('theme-toggle');

// Modal elements
const detailModal = document.getElementById('detail-modal');
const modalNama = document.getElementById('modal-nama');
const modalNim = document.getElementById('modal-nim');
const modalPt = document.getElementById('modal-pt');
const modalProdi = document.getElementById('modal-prodi');
const modalPhoto = document.getElementById('modal-photo');
const modalAvatar = document.getElementById('modal-avatar');
const modalPddiktiLink = document.getElementById('modal-pddikti-link');

// --- Theme (Dark/Light Mode) Logic ---
const sunIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
const moonIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;

const applyTheme = (theme) => {
    const html = document.documentElement;
    if (theme === 'dark') {
        html.classList.add('dark');
        themeToggle.innerHTML = sunIcon;
    } else {
        html.classList.remove('dark');
        themeToggle.innerHTML = moonIcon;
    }
};

themeToggle.addEventListener('click', () => {
    const html = document.documentElement;
    const newTheme = html.classList.contains('dark') ? 'light' : 'dark';
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
});

// --- Helper Functions ---
function getInitials(name) {
    if (!name) return '?';
    const words = name.trim().split(' ');
    if (words.length === 1) return words[0].charAt(0).toUpperCase();
    return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
}

function getRandomGradient() {
    const gradients = [
        'from-violet-500 to-purple-600',
        'from-blue-500 to-cyan-500',
        'from-emerald-500 to-teal-600',
        'from-rose-500 to-pink-600',
        'from-amber-500 to-orange-600',
        'from-indigo-500 to-blue-600',
        'from-fuchsia-500 to-pink-600',
        'from-cyan-500 to-blue-500'
    ];
    return gradients[Math.floor(Math.random() * gradients.length)];
}

function showState(state) {
    // Hide all states first
    emptyState.classList.add('hidden');
    noResults.classList.add('hidden');
    errorState.classList.add('hidden');
    searchStats.classList.add('hidden');
    resultsContainer.innerHTML = '';

    switch (state) {
        case 'empty':
            emptyState.classList.remove('hidden');
            break;
        case 'no-results':
            noResults.classList.remove('hidden');
            break;
        case 'error':
            errorState.classList.remove('hidden');
            break;
        case 'results':
            searchStats.classList.remove('hidden');
            break;
    }
}

function setLoading(isLoading) {
    if (isLoading) {
        searchIcon.classList.add('hidden');
        loadingIcon.classList.remove('hidden');
        searchBtn.disabled = true;
        searchBtn.classList.add('opacity-70', 'cursor-not-allowed');
    } else {
        searchIcon.classList.remove('hidden');
        loadingIcon.classList.add('hidden');
        searchBtn.disabled = false;
        searchBtn.classList.remove('opacity-70', 'cursor-not-allowed');
    }
}

// --- API Search Function ---
async function searchMahasiswa(query) {
    const url = `${SEARCH_API}?query=${encodeURIComponent(query)}`;

    try {
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Handle different response formats
        if (Array.isArray(data)) {
            return data;
        } else if (data && Array.isArray(data.data)) {
            return data.data;
        } else if (data && Array.isArray(data.mahasiswa)) {
            return data.mahasiswa;
        }

        return [];
    } catch (error) {
        console.error('Search error:', error);
        throw error;
    }
}

// --- Create Result Card ---
function createResultCard(mahasiswa) {
    const card = document.createElement('div');
    card.className = 'result-card bg-white dark:bg-slate-800 rounded-2xl shadow-lg overflow-hidden border border-slate-200 dark:border-slate-700 hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:-translate-y-1';

    const gradient = getRandomGradient();
    const initials = getInitials(mahasiswa.nama);
    const nim = mahasiswa.nim || '-';
    const isUnmul = mahasiswa.nama_pt && mahasiswa.nama_pt.toLowerCase().includes('mulawarman');

    card.innerHTML = `
        <div class="relative">
            <!-- Header gradient -->
            <div class="h-20 bg-gradient-to-r ${gradient}"></div>
            <!-- Avatar -->
            <div class="absolute -bottom-10 left-1/2 -translate-x-1/2">
                <div class="w-20 h-20 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-2xl font-bold border-4 border-white dark:border-slate-800 shadow-lg overflow-hidden avatar-container">
                    ${isUnmul ? `<img src="${AIS_PHOTO_URL}${nim}" alt="${mahasiswa.nama}" class="w-full h-full object-cover opacity-0 transition-opacity duration-300" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" onload="this.classList.remove('opacity-0'); this.classList.add('opacity-100');">` : ''}
                    <span class="avatar-initials" ${isUnmul ? 'style="display:none"' : ''}>${initials}</span>
                </div>
            </div>
        </div>
        
        <div class="pt-12 pb-5 px-4 text-center">
            <h3 class="font-semibold text-slate-800 dark:text-white text-base mb-1 line-clamp-2">${mahasiswa.nama || 'Nama tidak tersedia'}</h3>
            <p class="font-mono text-xs text-slate-500 dark:text-slate-400 mb-3">${nim}</p>
            
            <div class="space-y-2">
                <div class="flex items-center justify-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-violet-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <span class="truncate">${mahasiswa.nama_pt || 'PT tidak tersedia'}</span>
                </div>
                <div class="flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-indigo-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    <span class="truncate">${mahasiswa.nama_prodi || 'Prodi tidak tersedia'}</span>
                </div>
            </div>
        </div>
    `;

    card.addEventListener('click', () => openDetailModal(mahasiswa));

    return card;
}

// --- Display Results ---
function displayResults(results, query) {
    if (!results || results.length === 0) {
        showState('no-results');
        return;
    }

    showState('results');
    resultCount.textContent = results.length;
    searchQueryDisplay.textContent = `Pencarian: "${query}"`;

    results.forEach(mahasiswa => {
        const card = createResultCard(mahasiswa);
        resultsContainer.appendChild(card);
    });
}

// --- Modal Functions ---
function openDetailModal(mahasiswa) {
    const isUnmul = mahasiswa.nama_pt && mahasiswa.nama_pt.toLowerCase().includes('mulawarman');
    const nim = mahasiswa.nim || '-';

    modalNama.textContent = mahasiswa.nama || 'Nama tidak tersedia';
    modalNim.textContent = `NIM: ${nim}`;
    modalPt.textContent = mahasiswa.nama_pt || 'Tidak tersedia';
    modalProdi.textContent = mahasiswa.nama_prodi || 'Tidak tersedia';

    // Handle photo
    if (isUnmul) {
        modalPhoto.src = `${AIS_PHOTO_URL}${nim}`;
        modalPhoto.classList.remove('hidden');
        modalAvatar.classList.add('hidden');
        modalPhoto.onerror = () => {
            modalPhoto.classList.add('hidden');
            modalAvatar.classList.remove('hidden');
            modalAvatar.textContent = getInitials(mahasiswa.nama);
        };
    } else {
        modalPhoto.classList.add('hidden');
        modalAvatar.classList.remove('hidden');
        modalAvatar.textContent = getInitials(mahasiswa.nama);
    }

    // PDDIKTI link (if ID available)
    if (mahasiswa.id) {
        modalPddiktiLink.href = `https://pddikti.kemdikbud.go.id/data_mahasiswa/${mahasiswa.id}`;
        modalPddiktiLink.classList.remove('hidden');
    } else {
        modalPddiktiLink.classList.add('hidden');
    }

    detailModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeDetailModal() {
    detailModal.classList.add('hidden');
    document.body.style.overflow = '';
}

// --- Event Listeners ---
async function performSearch() {
    const query = searchInput.value.trim();

    if (!query) {
        showState('empty');
        return;
    }

    setLoading(true);

    try {
        const results = await searchMahasiswa(query);
        displayResults(results, query);
    } catch (error) {
        showState('error');
        errorMessage.textContent = error.message || 'Gagal memuat data. Silakan coba lagi nanti.';
    } finally {
        setLoading(false);
    }
}

searchBtn.addEventListener('click', performSearch);

searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        performSearch();
    }
});

// Close modal with Escape key
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !detailModal.classList.contains('hidden')) {
        closeDetailModal();
    }
});

// --- Initial Load ---
window.onload = () => {
    // Initialize theme
    const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    applyTheme(savedTheme);

    // Check URL params for query
    const urlParams = new URLSearchParams(window.location.search);
    const queryParam = urlParams.get('q');
    if (queryParam) {
        searchInput.value = queryParam;
        performSearch();
    }
};
