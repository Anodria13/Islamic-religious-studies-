/**
 * Islamiyat - Simplified App Logic
 */

// --- Global State ---
const state = {
    activeTab: 'prayer',
    language: localStorage.getItem('lang') || 'ar',
    theme: localStorage.getItem('theme') || 'light',
    location: JSON.parse(localStorage.getItem('location')) || { city: 'Cairo', country: 'Egypt' },
    favorites: JSON.parse(localStorage.getItem('favorites')) || { surahs: [], radios: [] },
    quran: {
        surahs: [],
        reciters: [],
        selectedReciter: localStorage.getItem('selectedReciter') || 'quran-com-mishary',
        activeSurah: null
    },
    radios: [],
    manualRadios: [
        { id: '8s5u8p488zquv', name: 'إذاعة القرآن الكريم من القاهرة', url: 'https://n02.radiojar.com/8s5u8p488zquv', category: 'channel', provider: 'radiojar' },
        { id: '0tpyuch996quv', name: 'إذاعة القرآن الكريم من السعودية', url: 'https://n0a.radiojar.com/0tpyuch996quv', category: 'channel', provider: 'radiojar' },
        { id: 'makkah', name: 'إذاعة القرآن الكريم من مكة (بث مباشر)', url: 'https://live.mp3quran.net/makkah', category: 'channel' },
        { name: 'إذاعة القرآن الكريم من نابلس', url: 'https://stream.radioquran.ps/radio/8000/radio.mp3', category: 'channel' }
    ],
    activeRadioCat: 'reciter',
    names: [],
    qibla: {
        dir: null,
        coords: null
    },
    azkar: {
        data: {},
        category: 'أذكار الصباح',
        counters: {}
    },
    hadith: {
        list: [],
        index: 0
    },
    audio: {
        isPlaying: false,
        title: '',
        subtitle: ''
    },
    fontSize: parseInt(localStorage.getItem('fontSize')) || 24
};

// --- API Helpers ---
async function fetchWithCache(url, cacheKey, expiry = 43200000) { // 12 hours default
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < expiry) return data;
    }
    const res = await fetch(url);
    const data = await res.json();
    localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
    return data;
}

function changeFontSize(v) {
    state.fontSize = Math.max(16, Math.min(48, state.fontSize + v));
    localStorage.setItem('fontSize', state.fontSize);
    applyFontSize();
}

function applyFontSize() {
    const els = document.querySelectorAll('#hadith-text, #ayah-list p.text-2xl');
    els.forEach(el => el.style.fontSize = state.fontSize + 'px');
}

async function shareText(text) {
    if (navigator.share) {
        try {
            await navigator.share({ title: 'إسلاميات', text: text });
        } catch (e) { console.error(e); }
    } else {
        navigator.clipboard.writeText(text);
        alert('تم نسخ النص!');
    }
}

// --- UI Controls ---
function initTheme() {
    if (state.theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    
    document.getElementById('theme-toggle').onclick = () => {
        state.theme = state.theme === 'light' ? 'dark' : 'light';
        localStorage.setItem('theme', state.theme);
        initTheme();
    };
}

function initLanguage() {
    const isEn = state.language === 'en';
    document.documentElement.dir = isEn ? 'ltr' : 'rtl';
    document.documentElement.lang = state.language;
    document.getElementById('lang-toggle').innerText = isEn ? 'AR' : 'EN';
    document.getElementById('app-title').innerText = isEn ? 'Islamiyat' : 'إسلاميات';
    
    document.getElementById('lang-toggle').onclick = () => {
        state.language = state.language === 'ar' ? 'en' : 'ar';
        localStorage.setItem('lang', state.language);
        location.reload(); // Simplest way to re-render everything
    };
}

function switchTab(tabId) {
    state.activeTab = tabId;
    document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
    document.getElementById(`tab-${tabId}`).classList.remove('hidden');
    
    document.querySelectorAll('.nav-btn').forEach(btn => {
        const id = btn.getAttribute('data-tab');
        if (id === tabId) {
            btn.classList.remove('opacity-40');
            btn.classList.add('text-[#006948]');
        } else {
            btn.classList.add('opacity-40');
            btn.classList.remove('text-[#006948]');
        }
    });

    // Run tab-specific init
    if (tabId === 'prayer') initPrayer();
    if (tabId === 'quran') initQuran();
    if (tabId === 'radio') initRadio();
    if (tabId === 'azkar') initAzkar();
    if (tabId === 'hadith') initHadith();
}

// --- Feature: Prayer Times ---
async function initPrayer() {
    const loader = document.getElementById('prayer-loading');
    const content = document.getElementById('prayer-content');
    loader.classList.remove('hidden');
    content.classList.add('hidden');

    try {
        const { city, country } = state.location;
        const res = await fetchWithCache(`https://api.aladhan.com/v1/timingsByCity?city=${city}&country=${country}&method=8`, `prayer_${city}_${country}`);
        const data = res.data;
        
        renderPrayerGrid(data.timings);
        startPrayerCountdown(data.timings);
        
        // Update Hijri Date
        const hijri = data.date.hijri;
        const hijriStr = `${hijri.day} ${hijri.month.ar} ${hijri.year}`;
        document.getElementById('hijri-date-top').innerText = hijriStr;
        document.getElementById('hijri-date-badge').innerText = hijriStr;

        // Update Location Info
        document.getElementById('location-city-name').innerText = city;
        document.getElementById('location-country-name').innerText = country;
        document.getElementById('location-info').classList.remove('hidden');

        content.classList.remove('hidden');
    } catch (e) {
        console.error(e);
    } finally {
        loader.classList.add('hidden');
    }
}

function renderPrayerGrid(timings) {
    const grid = document.getElementById('prayer-grid');
    const prayers = [
        { key: 'Fajr', name: 'الفجر', en: 'Fajr', icon: 'sunrise' },
        { key: 'Dhuhr', name: 'الظهر', en: 'Dhuhr', icon: 'sun' },
        { key: 'Asr', name: 'العصر', en: 'Asr', icon: 'sun' },
        { key: 'Maghrib', name: 'المغرب', en: 'Maghrib', icon: 'sunset' },
        { key: 'Isha', name: 'العشاء', en: 'Isha', icon: 'moon' }
    ];

    grid.innerHTML = prayers.map(p => `
        <div class="premium-card p-8 flex flex-col items-center justify-center text-center">
            <div class="w-12 h-12 bg-[#006948]/5 rounded-2xl flex items-center justify-center mb-4">
                <i data-lucide="${p.icon}" class="w-6 h-6 text-[#006948]"></i>
            </div>
            <span class="text-xs font-black opacity-40 uppercase tracking-widest mb-1">${state.language === 'en' ? p.en : p.name}</span>
            <div class="text-3xl font-black text-[#006948] dark:text-[#68DBA9]">${formatTime(timings[p.key])}</div>
        </div>
    `).join('');
    lucide.createIcons();
}

function formatTime(time24) {
    if (!time24) return '--:--';
    const [h, m] = time24.split(':');
    let hours = parseInt(h);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${m} ${ampm}`;
}

function startPrayerCountdown(timings) {
    const nextCard = document.getElementById('next-prayer-card');
    nextCard.classList.remove('hidden');

    function update() {
        const now = new Date();
        const prayerOrder = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
        let next = null;

        for (const p of prayerOrder) {
            const [h, m] = timings[p].split(':').map(Number);
            const pTime = new Date();
            pTime.setHours(h, m, 0, 0);
            if (pTime > now) {
                next = { name: p, time: pTime };
                break;
            }
        }

        if (!next) {
            const [h, m] = timings.Fajr.split(':').map(Number);
            const pTime = new Date();
            pTime.setDate(now.getDate() + 1);
            pTime.setHours(h, m, 0, 0);
            next = { name: 'Fajr', time: pTime };
        }

        const diff = next.time - now;
        const hh = Math.floor(diff / 3600000);
        const mm = Math.floor((diff % 3600000) / 60000);
        const ss = Math.floor((diff % 60000) / 1000);

        document.getElementById('next-prayer-name').innerText = state.language === 'ar' ? getPrayerNameAr(next.name) : next.name;
        document.getElementById('next-prayer-time').innerText = formatTime(timings[next.name]);
        document.getElementById('next-prayer-remaining').innerText = `${hh}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
    }

    if (window.prayerTimer) clearInterval(window.prayerTimer);
    window.prayerTimer = setInterval(update, 1000);
    update();
}

function getPrayerNameAr(p) {
    return { Fajr: 'الفجر', Dhuhr: 'الظهر', Asr: 'العصر', Maghrib: 'المغرب', Isha: 'العشاء' }[p];
}

// --- Feature: Names of Allah ---
async function openNamesOfAllah() {
    const view = document.getElementById('names-view');
    const list = document.getElementById('names-list');
    view.classList.remove('hidden');
    
    if (state.names.length > 0) return;
    
    list.innerHTML = '<div class="col-span-full flex justify-center py-20"><i data-lucide="loader-2" class="w-8 h-8 animate-spin"></i></div>';
    lucide.createIcons();

    try {
        const res = await fetchWithCache('https://api.aladhan.com/v1/asmaAlHusna', 'asma_husna');
        state.names = res.data;
        renderNames();
    } catch (e) {
        list.innerHTML = '<p class="col-span-full text-center">فشل في جلب الأسماء</p>';
    }
}

function renderNames() {
    const list = document.getElementById('names-list');
    list.innerHTML = state.names.map(n => `
        <div class="premium-card p-6 flex flex-col items-center text-center group cursor-default">
            <span class="text-[10px] opacity-20 font-black mb-4 group-hover:opacity-100 transition-opacity">#${n.number}</span>
            <h3 class="text-3xl font-black text-[#006948] dark:text-[#68DBA9] font-['Amiri'] mb-3">${n.name}</h3>
            <p class="text-[11px] font-bold opacity-40 leading-relaxed">${n.en.meaning}</p>
        </div>
    `).join('');
}

function closeNamesOfAllah() {
    document.getElementById('names-view').classList.add('hidden');
}

// --- Feature: Qibla ---
function openQibla() {
    document.getElementById('qibla-view').classList.remove('hidden');
    if (!state.qibla.dir) {
        fetchQibla();
    }
}

async function fetchQibla() {
    if (!navigator.geolocation) return;
    
    navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
            const res = await fetchWithCache(`https://api.aladhan.com/v1/qibla/${latitude}/${longitude}`, `qibla_${latitude.toFixed(2)}`);
            state.qibla.dir = res.data.direction;
            document.getElementById('qibla-deg').innerText = `${Math.round(state.qibla.dir)}°`;
            document.getElementById('qibla-needle').style.transform = `rotate(${state.qibla.dir}deg)`;
        } catch (e) {
            console.error(e);
        }
    });
}

function closeQibla() {
    document.getElementById('qibla-view').classList.add('hidden');
}

function openCalendar() {
    alert('سيتم فتح التقويم الهجري قريباً');
}

// --- Feature: Quran ---
async function initQuran() {
    if (state.quran.surahs.length > 0) return; // Prevent double load
    
    try {
        const res = await fetchWithCache('https://api.alquran.cloud/v1/surah', 'surahs_list');
        state.quran.surahs = res.data;
        renderSurahs();
        
        // Fetch reciters
        const lang = state.language === 'ar' ? 'ar' : 'eng';
        const recData = await fetchWithCache(`https://www.mp3quran.net/api/v3/reciters?language=${lang}`, `reciters_${lang}`);
        
        // Manual high quality reciters
        state.quran.reciters = [
            { id: 'quran-com-mishary', name: state.language === 'ar' ? 'مشاري العفاسي (HQ)' : 'Mishary Alafasy (HQ)', server: 'https://download.quranicaudio.com/qdc/mishari_al_afasy/murattal/' },
            { id: 'quran-com-maher', name: state.language === 'ar' ? 'ماهر المعيقلي (HQ)' : 'Maher Al-Muaiqly (HQ)', server: 'https://download.quranicaudio.com/qdc/maher_al_muaiqly/murattal/' }
        ];

        recData.reciters.forEach(r => {
            if (r.moshaf && r.moshaf.length > 0) {
                state.quran.reciters.push({
                    id: `rec_${r.id}`,
                    name: r.name,
                    server: r.moshaf[0].server
                });
            }
        });

        const currentRec = state.quran.reciters.find(r => r.id === state.quran.selectedReciter) || state.quran.reciters[0];
        document.getElementById('current-reciter-name').innerText = currentRec.name;

    } catch (e) {
        console.error(e);
    }
}

function renderSurahs() {
    const list = document.getElementById('surah-list');
    const query = document.getElementById('surah-search').value.toLowerCase();
    
    list.innerHTML = state.quran.surahs
        .filter(s => s.name.includes(query) || s.englishName.toLowerCase().includes(query))
        .map(s => `
            <div onclick="openSurah(${s.number})" class="premium-card p-6 flex items-center justify-between cursor-pointer group">
                <div class="flex items-center gap-5">
                    <div class="w-14 h-14 bg-[#006948]/5 rounded-[1.25rem] flex items-center justify-center font-black text-[#006948] transition-all group-hover:bg-[#006948] group-hover:text-white">${s.number}</div>
                    <div class="text-right">
                        <h3 class="font-extrabold text-xl mb-1 group-hover:text-[#006948] transition-colors">${s.name}</h3>
                        <div class="flex items-center gap-2 opacity-40 text-[10px] font-black uppercase tracking-widest">
                            <span>${s.numberOfAyahs} آية</span>
                            <span class="w-1 h-1 bg-current rounded-full"></span>
                            <span>${s.revelationType === 'Meccan' ? 'مكية' : 'مدنية'}</span>
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="toggleFavoriteSurah(event, ${s.number})" class="p-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-all ${state.favorites.surahs.includes(s.number) ? 'text-red-500' : 'opacity-20'}">
                        <i data-lucide="heart" class="w-6 h-6 ${state.favorites.surahs.includes(s.number) ? 'fill-red-500' : ''}"></i>
                    </button>
                    <button onclick="playSurah(event, ${s.number})" class="w-12 h-12 bg-[#006948]/10 text-[#006948] rounded-2xl flex items-center justify-center hover:bg-[#006948] hover:text-white transition-all">
                        <i data-lucide="play" class="w-6 h-6 fill-current"></i>
                    </button>
                </div>
            </div>
        `).join('');
    lucide.createIcons();
}

function toggleFavoriteSurah(e, num) {
    if (e) e.stopPropagation();
    const idx = state.favorites.surahs.indexOf(num);
    if (idx > -1) state.favorites.surahs.splice(idx, 1);
    else state.favorites.surahs.push(num);
    localStorage.setItem('favorites', JSON.stringify(state.favorites));
    renderSurahs();
}

async function openSurah(num) {
    const detail = document.getElementById('surah-detail');
    const ayahList = document.getElementById('ayah-list');
    const title = document.getElementById('surah-detail-title');
    
    state.quran.activeSurah = state.quran.surahs.find(s => s.number === num);
    title.innerText = state.quran.activeSurah.name;
    detail.classList.remove('hidden');
    ayahList.innerHTML = '<div class="flex justify-center py-20"><i data-lucide="loader-2" class="w-8 h-8 animate-spin"></i></div>';
    lucide.createIcons();

    try {
        console.log(`Fetching surah ${num}...`);
        const res = await fetch(`https://quranenc.com/api/v1/translation/sura/arabic_moyassar/${num}`);
        if (!res.ok) throw new Error('API unstable');
        const data = await res.json();
        
        if (data && data.result && data.result.length > 0) {
            ayahList.innerHTML = data.result.map(a => `
                <div class="bg-white dark:bg-[#162B1E] p-6 rounded-3xl space-y-4">
                    <div class="flex justify-between items-start">
                        <span class="w-10 h-10 rounded-full border border-black/5 flex items-center justify-center opacity-40 font-bold">${a.aya}</span>
                    </div>
                    <p class="text-2xl font-['Amiri'] leading-relaxed text-right font-bold" style="font-size: ${state.fontSize}px">${a.arabic_text}</p>
                    <p class="text-sm opacity-60 text-right">${a.translation}</p>
                </div>
            `).join('');
        } else {
            // Fallback to alquran.cloud if quranenc fails
            const res2 = await fetch(`https://api.alquran.cloud/v1/surah/${num}/ar.alafasy`);
            const data2 = await res2.json();
            ayahList.innerHTML = data2.data.ayahs.map(a => `
                <div class="bg-white dark:bg-[#162B1E] p-6 rounded-3xl space-y-4">
                    <div class="flex justify-between items-start">
                        <span class="w-10 h-10 rounded-full border border-black/5 flex items-center justify-center opacity-40 font-bold">${a.numberInSurah}</span>
                    </div>
                    <p class="text-2xl font-['Amiri'] leading-relaxed text-right font-bold" style="font-size: ${state.fontSize}px">${a.text}</p>
                </div>
            `).join('');
        }
    } catch (e) {
        console.error("Fetch Ayahs error:", e);
        ayahList.innerHTML = '<p class="text-center p-10">فشل في جلب الآيات. يرجى المحقق من الاتصال بالإنترنت.</p>';
    }
}

function playSurah(e, num) {
    if (e) e.stopPropagation();
    const surah = state.quran.surahs.find(s => s.number === num);
    const reciter = state.quran.reciters.find(r => r.id === state.quran.selectedReciter) || state.quran.reciters[0];
    
    const server = reciter.server.endsWith('/') ? reciter.server : reciter.server + '/';
    let url = '';
    if (reciter.id.startsWith('quran-com')) {
        url = `${server}${num}.mp3`;
    } else {
        url = `${server}${String(num).padStart(3, '0')}.mp3`;
    }

    startAudio(url, surah.name, reciter.name);
}

// --- Feature: Radio ---
async function initRadio() {
    if (state.radios.length > 0) {
        renderRadios();
        return;
    }
    
    const list = document.getElementById('radio-list');
    list.innerHTML = '<div class="col-span-full flex justify-center py-20"><i data-lucide="loader-2" class="w-8 h-8 animate-spin"></i></div>';
    lucide.createIcons();

    try {
        const lang = state.language === 'ar' ? 'ar' : 'eng';
        const data = await fetchWithCache(`https://www.mp3quran.net/api/v3/radios?language=${lang}`, `radios_all`);
        const apiRadios = data.radios.map(r => {
            let cat = 'reciter';
            const n = r.name.toLowerCase();
            const secureUrl = r.url.replace('http://', 'https://');
            if (n.includes('تفسير') || n.includes('فتاوى')) cat = 'tafsir';
            else if (n.includes('أذكار') || n.includes('رقية')) cat = 'azkar';
            else if (n.includes('إذاعة') || n.includes('راديو')) cat = 'channel';
            return { ...r, url: secureUrl, category: cat };
        });

        // Combine manual and API radios
        state.radios = [...state.manualRadios, ...apiRadios];
        
        renderRadios();
    } catch (e) {
        list.innerHTML = '<p class="col-span-full text-center p-10">فشل في جلب الإذاعات</p>';
    }
}

function setRadioCat(cat) {
    state.activeRadioCat = cat;
    document.querySelectorAll('.radio-tab-btn').forEach(btn => {
        const catName = getCatName(cat).replace('القراء', 'القراء'); // Simplified match
        if (btn.innerText.includes(getCatName(cat).split(' ')[0])) {
            btn.classList.add('bg-[#006948]', 'text-white');
            btn.classList.remove('bg-white');
        } else {
            btn.classList.remove('bg-[#006948]', 'text-white');
            btn.classList.add('bg-white');
        }
    });
    renderRadios();
}

function getCatName(cat) {
    return { reciter: 'القراء', channel: 'قنوات', azkar: 'أذكار', tafsir: 'تفسير' }[cat];
}

function renderRadios() {
    const list = document.getElementById('radio-list');
    const query = document.getElementById('radio-search').value.toLowerCase();
    const filtered = state.radios.filter(r => r.category === state.activeRadioCat && r.name.toLowerCase().includes(query));
    
    list.innerHTML = filtered.slice(0, 50).map(r => `
        <div onclick="startAudio('${r.url}', '${r.name}', 'راديو مباشر', '${r.id || ''}', '${r.provider || ''}')" class="premium-card p-6 flex items-center justify-between cursor-pointer group">
            <div class="flex items-center gap-5">
                <div class="w-14 h-14 bg-[#006948]/5 rounded-[1.25rem] flex items-center justify-center text-[#006948] group-hover:bg-[#006948] group-hover:text-white transition-all">
                    <i data-lucide="radio" class="w-7 h-7"></i>
                </div>
                <h3 class="font-extrabold text-lg group-hover:text-[#006948] transition-colors text-right">${r.name}</h3>
            </div>
            <div class="flex items-center gap-2">
                <button onclick="toggleFavoriteRadio(event, '${r.url}')" class="p-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-all ${state.favorites.radios.includes(r.url) ? 'text-red-500' : 'opacity-20'}">
                    <i data-lucide="heart" class="w-6 h-6 ${state.favorites.radios.includes(r.url) ? 'fill-red-500' : ''}"></i>
                </button>
                <button class="w-12 h-12 bg-[#006948] text-white rounded-2xl flex items-center justify-center hover:scale-105 transition-all">
                    <i data-lucide="play" class="w-6 h-6 fill-white"></i>
                </button>
            </div>
        </div>
    `).join('');
    lucide.createIcons();
}

function toggleFavoriteRadio(e, url) {
    if (e) e.stopPropagation();
    const idx = state.favorites.radios.indexOf(url);
    if (idx > -1) state.favorites.radios.splice(idx, 1);
    else state.favorites.radios.push(url);
    localStorage.setItem('favorites', JSON.stringify(state.favorites));
    renderRadios();
}

// --- Feature: Azkar ---
async function initAzkar() {
    if (Object.keys(state.azkar.data).length > 0) {
        renderAzkar();
        return;
    }
    
    try {
        const data = await fetchWithCache('https://raw.githubusercontent.com/nawafalqari/azkar-api/56df51279ab6eb86dc2f6202c7de26c8948331c1/azkar.json', 'azkar_data');
        state.azkar.data = data;
        
        // Render cats list
        const catList = document.getElementById('azkar-cats-modal');
        catList.innerHTML = Object.keys(data).map(cat => `
            <button onclick="setAzkarCategory('${cat}')" class="w-full text-right p-4 hover:bg-[#006948]/5 rounded-2xl font-bold transition-all">${cat}</button>
        `).join('');
        
        renderAzkar();
    } catch (e) {
        console.error(e);
    }
}

function setAzkarCategory(cat) {
    state.azkar.category = cat;
    state.azkar.counters = {};
    document.getElementById('active-category-name').innerText = cat;
    document.getElementById('azkar-cats-modal').classList.add('hidden');
    renderAzkar();
}

function renderAzkar() {
    const list = document.getElementById('azkar-list');
    const items = state.azkar.data[state.azkar.category] || [];
    
    list.innerHTML = (Array.isArray(items) ? items : items.flat()).map((z, idx) => {
        const target = parseInt(z.count) || 1;
        const current = state.azkar.counters[idx] || 0;
        const complete = current >= target;

        return `
            <div class="premium-card p-10 flex flex-col ${complete ? 'opacity-40 grayscale scale-[0.98]' : ''} transition-all duration-500">
                <p class="text-3xl font-['Amiri'] leading-relaxed text-right mb-10 font-bold">${z.content}</p>
                <div class="flex items-center justify-between border-t border-black/5 pt-8">
                    <div class="text-right">
                        <span class="text-[10px] opacity-40 font-black block mb-1 uppercase tracking-widest">التكرار</span>
                        <div class="flex items-baseline gap-1">
                            <span class="font-black text-2xl text-[#006948]">${current}</span>
                            <span class="opacity-20 text-xs">/ ${target}</span>
                        </div>
                    </div>
                    <button onclick="incAzkar(${idx}, ${target})" ${complete ? 'disabled' : ''} class="w-24 h-24 bg-[#006948] text-white rounded-[2rem] text-4xl font-black shadow-xl active:scale-90 transition-all hover:bg-[#00855D]">
                        ${complete ? '✓' : current}
                    </button>
                    <button onclick="resetAzkar(${idx})" class="w-14 h-14 bg-black/5 rounded-2xl flex items-center justify-center opacity-30 hover:opacity-100 hover:bg-black/10 transition-all"><i data-lucide="refresh-cw" class="w-6 h-6"></i></button>
                </div>
            </div>
        `;
    }).join('');
    lucide.createIcons();
}

function incAzkar(idx, target) {
    state.azkar.counters[idx] = (state.azkar.counters[idx] || 0) + 1;
    renderAzkar();
}

function resetAzkar(idx) {
    state.azkar.counters[idx] = 0;
    renderAzkar();
}

// --- Feature: Hadith ---
async function initHadith() {
    if (state.hadith.list.length > 0) return;
    
    try {
        const data = await fetchWithCache('https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/ara-nawawi.json', 'hadith_nawawi');
        state.hadith.list = data.hadiths;
        renderHadith();
    } catch (e) {
        console.error(e);
    }
}

function renderHadith() {
    const h = state.hadith.list[state.hadith.index];
    if (!h) return;
    const el = document.getElementById('hadith-text');
    el.innerText = h.text;
    el.style.fontSize = state.fontSize + 'px';
}

// --- Feature: Audio Player ---
let audioEl = document.getElementById('global-audio');
const miniPlayer = document.getElementById('mini-player');
const playBtn = document.getElementById('player-play-btn');
let hls = null;

function resetAudioElement() {
    if (audioEl) {
        audioEl.pause();
        audioEl.removeAttribute('src');
        audioEl.load();
        
        // Remove old events
        audioEl.onerror = null;
        audioEl.onended = null;
    }
    
    // Create fresh instance to prevent any DOM/Source caching issues
    audioEl = new Audio();
    audioEl.id = 'global-audio';
    audioEl.preload = 'none';
    
    // Reattach listeners
    audioEl.onerror = () => {
        console.error("Audio element error:", audioEl.error);
        if (state.audio.isPlaying) {
            document.getElementById('player-subtitle').innerText = "خطأ في الاتصال بالبث";
            state.audio.isPlaying = false;
            updatePlayerBtn();
        }
    };
    audioEl.onended = () => {
        state.audio.isPlaying = false;
        updatePlayerBtn();
    };
    
    return audioEl;
}

function startAudio(url, title, subtitle, radioId, provider) {
    if (!url) return;
    
    let secureUrl = url.trim();
    if (secureUrl.startsWith('http://') && !secureUrl.includes(':')) {
        secureUrl = secureUrl.replace('http://', 'https://');
    }
    
    state.audio.title = title;
    state.audio.subtitle = subtitle;
    
    document.getElementById('player-title').innerText = title;
    document.getElementById('player-subtitle').innerText = "جاري الاتصال...";
    miniPlayer.classList.remove('hidden');
    
    const originalSubtitle = subtitle;
    
    if (hls) {
        hls.destroy();
        hls = null;
    }
    
    // Fresh node
    resetAudioElement();

    const isHls = secureUrl.includes('.m3u8') || secureUrl.includes('live.mp3quran.net/s_quran');
    
    if (isHls && Hls.isSupported()) {
        hls = new Hls({ enableWorker: true, lowLatencyMode: true });
        hls.loadSource(secureUrl);
        hls.attachMedia(audioEl);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
            playFinal(originalSubtitle, provider, radioId);
        });
        hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
               console.warn("HLS Error", data);
               hls.destroy();
               hls = null;
               nativePlay(secureUrl, originalSubtitle, provider, radioId);
            }
        });
    } else {
        nativePlay(secureUrl, originalSubtitle, provider, radioId);
    }
}

function nativePlay(url, sub, prov, rid) {
    resetAudioElement(); // Reset again just in case HLS polluted it
    audioEl.src = url;
    audioEl.load();
    playFinal(sub, prov, rid);
}

function playFinal(subtitle, provider, radioId) {
    const playPromise = audioEl.play();
    if (playPromise !== undefined) {
        playPromise.then(() => {
            state.audio.isPlaying = true;
            document.getElementById('player-subtitle').innerText = subtitle;
            updatePlayerBtn();
            if (provider === 'radiojar' && radioId) {
                fetchRadioJarMetadata(radioId);
            }
        }).catch(error => {
            console.error("Final play error:", error);
            state.audio.isPlaying = false;
            updatePlayerBtn();
            document.getElementById('player-subtitle').innerText = "عذراً، هذا البث متوقف حالياً";
        });
    }
}

async function fetchRadioJarMetadata(id) {
    try {
        const res = await fetch(`https://api.radiojar.com/v1/stations/${id}/now_playing/`);
        const data = await res.json();
        if (data && data.title) {
            document.getElementById('player-subtitle').innerText = "الآن: " + data.title;
        }
    } catch (e) { console.warn("Metadata fetch error", e); }
}

// Ensure the first play Btn handler is bound properly
function updatePlayerBtn() {
    playBtn.innerHTML = state.audio.isPlaying ? '<i data-lucide="pause" class="w-6 h-6 fill-white"></i>' : '<i data-lucide="play" class="w-6 h-6 fill-white"></i>';
    lucide.createIcons();
}

playBtn.onclick = () => {
    if (state.audio.isPlaying) {
        audioEl.pause();
    } else {
        const playPromise = audioEl.play();
        if (playPromise !== undefined) {
             playPromise.catch(() => {
                  console.error("Play error on toggle.");
             });
        }
    }
    state.audio.isPlaying = !state.audio.isPlaying;
    updatePlayerBtn();
};

// --- Main Init ---
window.onload = () => {
    initTheme();
    initLanguage();
    
    // Default Tab
    switchTab('prayer');

    // Nav Events
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.onclick = () => switchTab(btn.getAttribute('data-tab'));
    });

    // Special Component Events
    document.getElementById('reciter-dropdown-btn').onclick = () => {
        document.getElementById('reciter-modal').classList.remove('hidden');
        renderReciters();
    };

    document.getElementById('reciter-search').oninput = renderReciters;
    document.getElementById('close-reciter').onclick = () => document.getElementById('reciter-modal').classList.add('hidden');
    document.getElementById('close-surah').onclick = () => document.getElementById('surah-detail').classList.add('hidden');
    document.getElementById('surah-search').oninput = renderSurahs;
    document.getElementById('radio-search').oninput = renderRadios;
    document.getElementById('location-btn').onclick = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((pos) => {
                alert('تم تحديد الموقع! (تحتاج هذه الميزة لتحويل الإحداثيات لاسم مدينة برمجياً)');
            });
        }
    };

    document.getElementById('azkar-cats-btn').onclick = () => {
        const modal = document.getElementById('azkar-cats-modal');
        modal.classList.toggle('hidden');
    };

    document.getElementById('next-hadith').onclick = () => {
        state.hadith.index = (state.hadith.index + 1) % state.hadith.list.length;
        renderHadith();
    };
    document.getElementById('prev-hadith').onclick = () => {
        state.hadith.index = (state.hadith.index - 1 + state.hadith.list.length) % state.hadith.list.length;
        renderHadith();
    };

    document.getElementById('share-hadith').onclick = () => {
        const h = state.hadith.list[state.hadith.index];
        if (h) shareText(h.text);
    };

    document.getElementById('share-surah').onclick = () => {
        if (state.quran.activeSurah) {
            shareText(`استمع وشاهد سورة ${state.quran.activeSurah.name} عبر تطبيق إسلاميات`);
        }
    };
};

function renderReciters() {
    const list = document.getElementById('reciter-list');
    const query = document.getElementById('reciter-search').value.toLowerCase();
    
    list.innerHTML = state.quran.reciters
        .filter(r => r.name.toLowerCase().includes(query))
        .map(r => `
            <button onclick="selectReciter('${r.id}')" class="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-[#006948]/10 text-right transition-all">
                <div class="w-8 h-8 rounded-full bg-[#006948]/5 flex items-center justify-center font-bold text-[#006948]">${r.name.charAt(0)}</div>
                <span class="font-bold truncate">${r.name}</span>
            </button>
        `).join('');
}

function selectReciter(id) {
    state.quran.selectedReciter = id;
    localStorage.setItem('selectedReciter', id);
    const rec = state.quran.reciters.find(r => r.id === id);
    document.getElementById('current-reciter-name').innerText = rec.name;
    document.getElementById('reciter-modal').classList.add('hidden');
}
