// --- DOM Elements ---
const generateBtn = document.getElementById('generate-btn');
const loadMoreBtn = document.getElementById('load-more-btn');
const albumGrid = document.getElementById('album-grid');
const loadingStatus = document.getElementById('loading-status');
const themeToggle = document.getElementById('theme-toggle');
const modal = document.getElementById('image-modal');
const modalImg = document.getElementById('modal-img');
const modalNim = document.getElementById('modal-nim');
const generateBtnHero = document.getElementById('generate-btn-hero');

const inputAngkatan = document.getElementById('angkatan');
const inputFakultas = document.getElementById('fakultas');
const inputProdi = document.getElementById('prodi');
const inputNimStart = document.getElementById('nim-start');
const inputNimCount = document.getElementById('nim-count');
const inputPddiktiKeyword = document.getElementById('pddikti-keyword');

// --- State Variables ---
let currentNimNumber = 1;
let nimPrefix = '';
const baseUrl = 'https://ais.unmul.ac.id/file/foto/';
// PDDIKTI API (untuk mendapatkan nama dan prodi berdasarkan pencarian)
const PDDIKTI_API = 'https://api-pddikti.ridwaanhall.com/search/mhs/';

// Cache dan pembatasan konkuren untuk panggilan API
const mahasiswaCache = new Map(); // key: NIM, value: { nama, nama_prodi, nama_pt, sinkatan_pt, id }
const MAX_CONCURRENT = 4;
let activeRequests = 0;
const requestQueue = [];

function runNext() {
    if (activeRequests >= MAX_CONCURRENT) return;
    const next = requestQueue.shift();
    if (!next) return;
    activeRequests++;
    Promise.resolve()
        .then(next.task)
        .then((res) => next.resolve(res))
        .catch((err) => next.reject(err))
        .finally(() => {
            activeRequests--;
            runNext();
        });
}

function enqueueTask(task) {
    return new Promise((resolve, reject) => {
        requestQueue.push({ task, resolve, reject });
        runNext();
    });
}

function withTimeout(promise, ms = 10000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), ms);
    return {
        exec: Promise.race([
            promise(controller.signal),
            new Promise((_, rej) =>
                setTimeout(() => rej(new Error('Timeout')), ms)
            ),
        ]).finally(() => clearTimeout(id)),
        controller,
    };
}

async function searchMahasiswa(query, signal) {
    const url = PDDIKTI_API + encodeURIComponent(query);
    // Decide request URL: use Vercel proxy in production to avoid CORS, direct in local/dev
    const __isProd = typeof location !== 'undefined' && /miez\.site$|vercel\.app$/i.test(location.hostname);
    const __proxy = '/api?url=' + encodeURIComponent(url);
    const __url = __isProd ? __proxy : url;

    // Helper: fetch JSON directly
    const fetchDirect = async () => {
        const res = await fetch(__url, { headers: { 'Accept': 'application/json' }, signal });
        if (!res.ok) throw new Error('Gagal memuat data PDDIKTI');
        return res.json();
    };

    // Helper: fallback via AllOrigins raw endpoint (adds permissive CORS)
    const fetchViaAllOrigins = async () => {
        const proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url);
        const res = await fetch(proxyUrl, { headers: { 'Accept': 'application/json' }, signal });
        if (!res.ok) throw new Error('Gagal memuat data PDDIKTI (proxy)');
        // Some proxies return text; attempt JSON parse
        const text = await res.text();
        try {
            return JSON.parse(text);
        } catch (err) {
            // If response already JSON, try res.json as fallback
            try {
                return JSON.parse(String(text));
            } catch {
                throw new Error('Respon proxy tidak valid');
            }
        }
    };

    const normalize = (data) => {
        // API bisa mengembalikan array langsung atau object { mahasiswa: [...] }
        if (Array.isArray(data)) return data;
        if (data && Array.isArray(data.mahasiswa)) return data.mahasiswa;
        return [];
    };

    try {
        const data = await fetchDirect();
        const list = normalize(data);
        console.debug('PDDIKTI direct', { query, count: list.length });
        return list;
    } catch (e) {
        // Fallback to proxy if network fails or server closes connection
        console.warn('PDDIKTI direct fetch gagal, mencoba via proxy:', e?.message || e);
        try {
            const data = await fetchViaAllOrigins();
            const list = normalize(data);
            console.debug('PDDIKTI proxy', { query, count: list.length });
            return list;
        } catch (proxyErr) {
            console.error('PDDIKTI proxy fetch juga gagal:', proxyErr?.message || proxyErr);
            return [];
        }
    }
}

async function fetchMahasiswaByNim(nim) {
    // Cek cache
    if (mahasiswaCache.has(nim)) return mahasiswaCache.get(nim);

    // Jalankan pencarian dengan timeout dan concurrency limit
    const task = async () => {
        try {
            const kw = (inputPddiktiKeyword?.value || '').trim();
            const queries = [nim];
            if (kw) queries.push(`${nim} ${kw}`);
            // Fallback default keywords untuk UNMUL
            queries.push(`${nim} universitas mulawarman`);
            queries.push(`${nim} unmul`);

            let list = [];
            for (const q of queries) {
                const { exec } = withTimeout((signal) => searchMahasiswa(q, signal), 10000);
                const res = await exec;
                if (Array.isArray(res) && res.length) {
                    list = res;
                    break;
                }
            }

            // Cari yang NIM-nya exact match, kalau tidak ada ambil yang paling relevan (pertama)
            const exact = list.find((m) => (m.nim || '').trim() === nim.trim());
            const picked = exact || list[0] || null;
            if (picked) {
                const info = {
                    id: picked.id,
                    nama: picked.nama,
                    nim: picked.nim,
                    nama_pt: picked.nama_pt,
                    sinkatan_pt: picked.sinkatan_pt, // catatan: ejaan field dari API
                    nama_prodi: picked.nama_prodi,
                };
                mahasiswaCache.set(nim, info);
                return info;
            } else {
                console.warn('Tidak ada hasil PDDIKTI untuk NIM:', nim);
                mahasiswaCache.set(nim, null);
                return null;
            }
        } catch (e) {
            // Simpan ke cache sebagai null agar tidak retry terus-menerus
            mahasiswaCache.set(nim, null);
            return null;
        }
    };

    return enqueueTask(task);
}

// --- Theme (Dark/Light Mode) Logic ---
const sunIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
const moonIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;

const applyTheme = (theme) => {
    const html = document.documentElement;
    if (theme === 'dark') {
        html.classList.add('dark');
        themeToggle.innerHTML = sunIcon;
        console.log('Dark mode activated'); // Debug
    } else {
        html.classList.remove('dark');
        themeToggle.innerHTML = moonIcon;
        console.log('Light mode activated'); // Debug
    }
};

themeToggle.addEventListener('click', () => {
    const html = document.documentElement;
    const newTheme = html.classList.contains('dark') ? 'light' : 'dark';
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
    console.log('Theme changed to:', newTheme); // Debug
});

// --- Image Generation Logic ---
function pad(num, length) {
    return num.toString().padStart(length, '0');
}

// Helper untuk mendapatkan inisial nama
function getInitials(name) {
    if (!name) return '?';
    const words = name.trim().split(' ');
    if (words.length === 1) return words[0].charAt(0).toUpperCase();
    return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
}

// Helper untuk gradient random
function getRandomGradient() {
    const gradients = [
        'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
        'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
        'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
        'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
        'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    ];
    return gradients[Math.floor(Math.random() * gradients.length)];
}

function createPhotoCard(nim) {
    const imageUrl = baseUrl + nim;
    const gradient = getRandomGradient();

    const card = document.createElement('div');
    card.className = 'photo-card bg-white dark:bg-slate-800 rounded-2xl shadow-lg overflow-hidden cursor-pointer border border-slate-200 dark:border-slate-700 hover:shadow-xl transition-all duration-300 hover:-translate-y-1';
    card.onclick = () => openModal(imageUrl, nim);

    // Header dengan gradient
    const header = document.createElement('div');
    header.className = 'h-12 sm:h-14';
    header.style.background = gradient;

    // Container untuk foto (dengan posisi relatif untuk avatar)
    const photoWrapper = document.createElement('div');
    photoWrapper.className = 'relative px-3 sm:px-4 -mt-8 sm:-mt-10';

    // Avatar container
    const avatarContainer = document.createElement('div');
    avatarContainer.className = 'mx-auto w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border-4 border-white dark:border-slate-800 shadow-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center';
    avatarContainer.style.background = gradient;

    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = `Foto Mahasiswa ${nim}`;
    img.className = 'w-full h-full object-cover opacity-0 transition-opacity duration-300';
    img.loading = 'lazy';

    // Inisial sebagai fallback
    const initialsEl = document.createElement('span');
    initialsEl.className = 'text-white font-bold text-lg sm:text-xl hidden';
    initialsEl.textContent = '?';

    img.onload = () => {
        img.classList.remove('opacity-0');
        img.classList.add('opacity-100');
        initialsEl.classList.add('hidden');
    };

    img.onerror = () => {
        img.classList.add('hidden');
        initialsEl.classList.remove('hidden');
        avatarContainer.style.background = gradient;
    };

    avatarContainer.appendChild(img);
    avatarContainer.appendChild(initialsEl);
    photoWrapper.appendChild(avatarContainer);

    // Info section
    const info = document.createElement('div');
    info.className = 'p-3 sm:p-4 pt-2 sm:pt-3 text-center';

    // Nama
    const namaEl = document.createElement('h3');
    namaEl.className = 'font-semibold text-slate-800 dark:text-white text-sm sm:text-base mb-0.5 line-clamp-1 min-h-[1.25rem] sm:min-h-[1.5rem]';
    namaEl.innerHTML = '<span class="inline-block bg-slate-200 dark:bg-slate-700 rounded h-4 w-24 animate-pulse"></span>';

    // NIM
    const nimEl = document.createElement('p');
    nimEl.className = 'font-mono text-xs text-slate-500 dark:text-slate-400 mb-2';
    nimEl.textContent = nim;

    // Prodi dengan icon
    const prodiWrapper = document.createElement('div');
    prodiWrapper.className = 'flex items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-slate-400';

    const prodiIcon = document.createElement('span');
    prodiIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-indigo-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>';

    const prodiEl = document.createElement('span');
    prodiEl.className = 'truncate min-h-[1rem]';
    prodiEl.innerHTML = '<span class="inline-block bg-slate-200 dark:bg-slate-700 rounded h-3 w-16 animate-pulse"></span>';

    prodiWrapper.appendChild(prodiIcon);
    prodiWrapper.appendChild(prodiEl);

    info.appendChild(namaEl);
    info.appendChild(nimEl);
    info.appendChild(prodiWrapper);

    card.appendChild(header);
    card.appendChild(photoWrapper);
    card.appendChild(info);

    albumGrid.appendChild(card);

    // Ambil data nama & prodi dari API berdasarkan NIM
    fetchMahasiswaByNim(nim).then((mhs) => {
        if (mhs) {
            namaEl.textContent = mhs.nama || 'Tidak tersedia';
            prodiEl.textContent = mhs.nama_prodi || 'Tidak tersedia';
            // Update inisial
            initialsEl.textContent = getInitials(mhs.nama);
        } else {
            namaEl.textContent = 'Tidak tersedia';
            prodiEl.textContent = '-';
            initialsEl.textContent = '?';
        }
    });
}

async function loadImages(count, isInitialLoad = false) {
    loadingStatus.classList.remove('hidden');
    loadMoreBtn.classList.add('hidden');

    if (isInitialLoad) {
        albumGrid.innerHTML = '';
        nimPrefix = pad(inputAngkatan.value, 2) + pad(inputFakultas.value, 2) + pad(inputProdi.value, 3);
        currentNimNumber = parseInt(inputNimStart.value, 10);
    }

    const nimEnd = currentNimNumber + count;
    for (let i = currentNimNumber; i < nimEnd; i++) {
        const nimLengkap = nimPrefix + pad(i, 3);
        createPhotoCard(nimLengkap);
    }
    currentNimNumber = nimEnd;

    loadingStatus.classList.add('hidden');
    loadMoreBtn.classList.remove('hidden');
}

generateBtn.addEventListener('click', () => loadImages(parseInt(inputNimCount.value, 10), true));
loadMoreBtn.addEventListener('click', () => loadImages(parseInt(inputNimCount.value, 10), false));

// Hero button trigger (opsional)
if (generateBtnHero) {
    generateBtnHero.addEventListener('click', () => {
        loadImages(parseInt(inputNimCount.value, 10), true);
        // Smooth scroll ke galeri
        const target = document.getElementById('album-grid');
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
}

// --- Modal Logic ---
function openModal(imageUrl, nim) {
    // Set image
    modalImg.src = imageUrl;

    // Get modal elements
    const modalNama = document.getElementById('modal-nama');
    const modalNimText = document.getElementById('modal-nim-text');
    const modalProdi = document.getElementById('modal-prodi');
    const modalPt = document.getElementById('modal-pt');
    const modalPddiktiLink = document.getElementById('modal-pddikti-link');
    const modalAvatar = document.getElementById('modal-avatar');

    // Reset to loading state
    if (modalNama) modalNama.textContent = 'Memuat...';
    if (modalNimText) modalNimText.textContent = nim;
    if (modalProdi) modalProdi.textContent = 'Memuat...';
    if (modalPt) modalPt.textContent = 'Universitas Mulawarman';
    if (modalPddiktiLink) modalPddiktiLink.classList.add('hidden');
    if (modalAvatar) modalAvatar.textContent = '?';

    // Handle image error
    modalImg.onerror = () => {
        modalImg.src = 'https://placehold.co/400x400/e2e8f0/64748b?text=Foto+Tidak+Tersedia';
    };

    // Populate data from cache or fetch
    const cached = mahasiswaCache.get(nim);
    const updateModalData = (mhs) => {
        if (mhs) {
            if (modalNama) modalNama.textContent = mhs.nama || 'Nama tidak tersedia';
            if (modalProdi) modalProdi.textContent = mhs.nama_prodi || '-';
            if (modalPt) modalPt.textContent = mhs.nama_pt || 'Universitas Mulawarman';
            if (modalAvatar) modalAvatar.textContent = getInitials(mhs.nama);
            if (modalPddiktiLink && mhs.id) {
                modalPddiktiLink.href = `https://pddikti.kemdikbud.go.id/data_mahasiswa/${mhs.id}`;
                modalPddiktiLink.classList.remove('hidden');
            }
        } else {
            if (modalNama) modalNama.textContent = 'Data tidak tersedia';
            if (modalProdi) modalProdi.textContent = '-';
            if (modalAvatar) modalAvatar.textContent = '?';
        }
    };

    if (cached) {
        updateModalData(cached);
    } else {
        fetchMahasiswaByNim(nim).then(updateModalData);
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.style.overflow = '';
}

// Close modal with Escape key
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
        closeModal();
    }
});

// --- Initial Load ---
window.onload = () => {
    // Initialize theme
    const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    applyTheme(savedTheme);

    // Initial image generation
    loadImages(parseInt(inputNimCount.value, 10), true);
};