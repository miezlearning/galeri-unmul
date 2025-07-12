// --- DOM Elements ---
const generateBtn = document.getElementById('generate-btn');
const loadMoreBtn = document.getElementById('load-more-btn');
const albumGrid = document.getElementById('album-grid');
const loadingStatus = document.getElementById('loading-status');
const themeToggle = document.getElementById('theme-toggle');
const modal = document.getElementById('image-modal');
const modalImg = document.getElementById('modal-img');
const modalNim = document.getElementById('modal-nim');

const inputAngkatan = document.getElementById('angkatan');
const inputFakultas = document.getElementById('fakultas');
const inputProdi = document.getElementById('prodi');
const inputNimStart = document.getElementById('nim-start');
const inputNimCount = document.getElementById('nim-count');

// --- State Variables ---
let currentNimNumber = 1;
let nimPrefix = '';
const baseUrl = 'https://ais.unmul.ac.id/file/foto/';

// --- Theme (Dark/Light Mode) Logic ---
const sunIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
const moonIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;

const applyTheme = (theme) => {
    if (theme === 'dark') {
        document.documentElement.classList.add('dark'); // Ini yang paling penting
        themeToggle.innerHTML = sunIcon;
    } else {
        document.documentElement.classList.remove('dark'); // Ini yang paling penting
        themeToggle.innerHTML = moonIcon;
    }
};

themeToggle.addEventListener('click', () => {
    const newTheme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
});

// --- Image Generation Logic ---
function pad(num, length) {
    return num.toString().padStart(length, '0');
}

function createPhotoCard(nim) {
    const imageUrl = baseUrl + nim;
    const card = document.createElement('div');
    card.className = 'bg-white dark:bg-slate-800 rounded-xl shadow-md overflow-hidden transform hover:-translate-y-1 transition-all duration-300 cursor-pointer';
    card.onclick = () => openModal(imageUrl, nim);
    
    const imageContainer = document.createElement('div');
    imageContainer.className = 'w-full aspect-w-1 aspect-h-1 bg-slate-200 dark:bg-slate-700';

    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = `Foto Mahasiswa ${nim}`;
    img.className = 'w-full h-full object-cover';
    img.loading = 'lazy'; // Lazy loading for better performance

    const placeholderUrl = `https://placehold.co/400x400/e2e8f0/4a5568?text=Tidak+Ditemukan`;
    img.onerror = () => { img.src = placeholderUrl; };

    const info = document.createElement('div');
    info.className = 'p-3 text-center';
    info.innerHTML = `<p class="font-mono text-sm text-slate-600 dark:text-slate-400">${nim}</p>`;
    
    imageContainer.appendChild(img);
    card.appendChild(imageContainer);
    card.appendChild(info);
    
    albumGrid.appendChild(card);
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

// --- Modal Logic ---
function openModal(imageUrl, nim) {
    modalImg.src = 'https://placehold.co/400x400/e2e8f0/4a5568?text=Memuat...'; // Placeholder
    modalImg.src = imageUrl; // Actual image
    modalNim.textContent = nim;
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
