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

function createPhotoCard(nim) {
    const imageUrl = baseUrl + nim;
    const card = document.createElement('div');
    // Menambahkan class-class yang mendukung dark mode secara konsisten
    card.className = 'bg-white dark:bg-slate-800 rounded-xl shadow-lg overflow-hidden transform transition-all duration-300 hover:-translate-y-2 cursor-pointer border border-slate-200 dark:border-slate-700 image-card-hover';
    card.onclick = () => openModal(imageUrl, nim);
    
    const imageContainer = document.createElement('div');
    imageContainer.className = 'w-full aspect-square bg-slate-100 dark:bg-slate-700 flex items-center justify-center skeleton';

    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = `Foto Mahasiswa ${nim}`;
    img.className = 'w-full h-full object-cover opacity-0 transition-opacity duration-300';
    img.loading = 'lazy';

    img.onload = () => {
        imageContainer.classList.remove('skeleton');
        img.classList.remove('opacity-0');
        img.classList.add('opacity-100');
    };

    const placeholderUrl = `https://placehold.co/400x400/e2e8f0/64748b?text=Not+Found`;
    img.onerror = () => { 
        img.src = placeholderUrl; 
        img.classList.add('opacity-50'); // Membuat placeholder sedikit redup
        imageContainer.classList.remove('skeleton');
        img.classList.remove('opacity-0');
        img.classList.add('opacity-100');
    };

    const info = document.createElement('div');
    info.className = 'p-3 text-center bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700';
    // Elemen teks terpisah agar mudah diperbarui setelah fetch API
    const nimEl = document.createElement('p');
    nimEl.className = 'font-mono text-sm text-slate-700 dark:text-slate-300 tracking-wider';
    nimEl.textContent = nim;

    const namaEl = document.createElement('p');
    namaEl.className = 'text-sm text-slate-600 dark:text-slate-300 mt-1 skeleton-text px-8 py-1 inline-block';
    namaEl.textContent = 'Nama: memuat…';

    const prodiEl = document.createElement('p');
    prodiEl.className = 'text-xs text-slate-500 dark:text-slate-400 skeleton-text px-6 py-1 inline-block mt-1';
    prodiEl.textContent = 'Prodi: memuat…';

    info.appendChild(nimEl);
    info.appendChild(namaEl);
    info.appendChild(prodiEl);
    
    imageContainer.appendChild(img);
    card.appendChild(imageContainer);
    card.appendChild(info);
    
    albumGrid.appendChild(card);

    // Ambil data nama & prodi dari API berdasarkan NIM
    fetchMahasiswaByNim(nim).then((mhs) => {
        if (mhs) {
            namaEl.textContent = `Nama: ${mhs.nama || 'Tidak tersedia'}`;
            prodiEl.textContent = `Prodi: ${mhs.nama_prodi || 'Tidak tersedia'}`;
            namaEl.classList.remove('skeleton-text');
            prodiEl.classList.remove('skeleton-text');
        } else {
            namaEl.textContent = 'Nama: Tidak tersedia';
            prodiEl.textContent = 'Prodi: Tidak tersedia';
            namaEl.classList.remove('skeleton-text');
            prodiEl.classList.remove('skeleton-text');
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
    modalImg.src = 'https://placehold.co/400x400/e2e8f0/4a5568?text=Memuat...'; // Placeholder
    modalImg.src = imageUrl; // Actual image
    modalNim.textContent = nim;
    // Perkaya informasi pada modal jika data tersedia atau coba ambil
    const cached = mahasiswaCache.get(nim);
    if (cached) {
        if (cached) {
            modalNim.textContent = `${nim} — ${cached.nama || ''} — ${cached.nama_prodi || ''}`.trim();
        }
    } else {
        fetchMahasiswaByNim(nim).then((mhs) => {
            if (mhs) {
                modalNim.textContent = `${nim} — ${mhs.nama || ''} — ${mhs.nama_prodi || ''}`.trim();
            }
        });
    }
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
}

function closeModal() {
    modal.classList.add('hidden');
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
