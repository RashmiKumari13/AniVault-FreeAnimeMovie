/* ============================================
   AniVault Main App Logic
   Powered by Jikan API v4 (Free, No Auth)
   Downloads via Nyaa.si + Free Anime Sites
   ============================================ */

const JIKAN = 'https://api.jikan.moe/v4';
const NYAA   = 'https://nyaa.si/?f=0&c=1_2&q=';

// --- State ---
const state = {
  heroAnimes: [], heroIndex: 0, heroTimer: null,
  topRatedPage: 1, topRatedYear: null,
  allMoviesPage: 1, allMoviesSort: 'bypopularity',
  searchPage: 1, searchQuery: '',
};

// ===================== UTILITIES =====================

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function jikanFetch(url) {
  await sleep(400); // respect rate limit
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function toast(msg, color = '#e53637') {
  const t = document.getElementById('avToast');
  t.textContent = msg;
  t.style.borderColor = color;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

function showSkeletons(gridId, count = 12) {
  const g = document.getElementById(gridId);
  if (!g) return;
  g.innerHTML = Array(count).fill(`<div class="av-skeleton"></div>`).join('');
}

function scoreColor(s) {
  if (!s) return '#aaa';
  if (s >= 8) return '#ffd700';
  if (s >= 7) return '#00c853';
  return '#aaa';
}

function stripHtml(html) {
  if (!html) return 'No synopsis available.';
  return html.replace(/<[^>]+>/g, '').replace(/\[.*?\]/g, '').trim();
}

function getYear(anime) {
  return anime.year || (anime.aired?.from ? new Date(anime.aired.from).getFullYear() : null);
}

// ===================== CARD BUILDER =====================

function buildCard(anime) {
  const score = anime.score ? anime.score.toFixed(1) : 'N/A';
  const year  = getYear(anime);
  const img   = anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || 'img/trending/trend-1.jpg';
  const title = anime.title_english || anime.title || 'Unknown';
  const genres = (anime.genres || []).slice(0, 2).map(g => g.name).join(', ') || 'Anime';

  const card = document.createElement('div');
  card.className = 'av-card';
  card.setAttribute('data-id', anime.mal_id);
  card.innerHTML = `
    <div class="av-card__poster">
      <img src="${img}" alt="${title}" loading="lazy" onerror="this.src='img/trending/trend-1.jpg'">
      <div class="av-card__type">${anime.type || 'Movie'}</div>
      <div class="av-card__score" style="color:${scoreColor(anime.score)}">★ ${score}</div>
      <div class="av-card__overlay">
        <div class="av-card__overlay-actions">
          <button class="av-card__overlay-btn av-card__overlay-btn--dl" onclick="openModal(${anime.mal_id}, event)">⬇ Download</button>
          <button class="av-card__overlay-btn av-card__overlay-btn--info" onclick="openModal(${anime.mal_id}, event)">ℹ Info</button>
        </div>
      </div>
    </div>
    <div class="av-card__body">
      <div class="av-card__title">${title}</div>
      <div class="av-card__meta">
        <span class="av-card__tag">${genres}</span>
        ${year ? `<span class="av-card__tag av-card__tag--year">${year}</span>` : ''}
      </div>
    </div>`;
  card.addEventListener('click', (e) => {
    if (!e.target.closest('.av-card__overlay-btn')) openModal(anime.mal_id, e);
  });
  return card;
}

function appendCards(gridId, animes, clear = false) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  if (clear) grid.innerHTML = '';
  if (!animes || !animes.length) {
    grid.innerHTML = `<div class="av-empty" style="grid-column:1/-1"><i class="fa fa-film"></i><p>No anime found.</p></div>`;
    return;
  }
  animes.forEach(a => grid.appendChild(buildCard(a)));
}

// ===================== HERO SLIDER =====================

function setHeroSlide(anime) {
  const bg      = document.getElementById('heroBg');
  const title   = document.getElementById('heroTitle');
  const meta    = document.getElementById('heroMeta');
  const synopsis= document.getElementById('heroSynopsis');
  const dlBtn   = document.getElementById('heroDownloadBtn');
  const infoBtn = document.getElementById('heroDetailsBtn');

  const img   = anime.images?.jpg?.large_image_url || '';
  const score = anime.score ? anime.score.toFixed(1) : 'N/A';
  const year  = getYear(anime);
  const genres= (anime.genres || []).map(g => g.name).join(' • ') || '';

  if (img) bg.style.backgroundImage = `url('${img}')`;
  title.textContent = anime.title_english || anime.title;
  synopsis.textContent = stripHtml(anime.synopsis);
  meta.innerHTML = `
    <span class="score">★ ${score}</span>
    ${year ? `<span>📅 ${year}</span>` : ''}
    ${anime.duration ? `<span>⏱ ${anime.duration}</span>` : ''}
    ${genres ? `<span>🎭 ${genres}</span>` : ''}`;

  dlBtn.onclick  = () => openModal(anime.mal_id, {stopPropagation:()=>{}});
  infoBtn.onclick= () => openModal(anime.mal_id, {stopPropagation:()=>{}});
}

function updateHeroDots() {
  const dots = document.getElementById('heroDots');
  dots.innerHTML = state.heroAnimes.map((_, i) =>
    `<div class="av-hero__dot${i===state.heroIndex?' active':''}" onclick="goToHeroSlide(${i})"></div>`
  ).join('');
}

function goToHeroSlide(i) {
  state.heroIndex = (i + state.heroAnimes.length) % state.heroAnimes.length;
  setHeroSlide(state.heroAnimes[state.heroIndex]);
  updateHeroDots();
}

function startHeroAuto() {
  clearInterval(state.heroTimer);
  state.heroTimer = setInterval(() => goToHeroSlide(state.heroIndex + 1), 5500);
}

document.getElementById('heroPrev').addEventListener('click', () => { goToHeroSlide(state.heroIndex - 1); startHeroAuto(); });
document.getElementById('heroNext').addEventListener('click', () => { goToHeroSlide(state.heroIndex + 1); startHeroAuto(); });

async function loadHero() {
  try {
    const data = await jikanFetch(`${JIKAN}/top/anime?type=movie&filter=bypopularity&limit=8`);
    state.heroAnimes = (data.data || []).filter(a => a.images?.jpg?.large_image_url);
    if (state.heroAnimes.length) {
      setHeroSlide(state.heroAnimes[0]);
      updateHeroDots();
      startHeroAuto();
    }
  } catch(e) { console.warn('Hero load failed', e); }
}

// ===================== SECTIONS =====================

async function loadTrending() {
  showSkeletons('trendingGrid', 6);
  try {
    const data = await jikanFetch(`${JIKAN}/top/anime?type=movie&filter=bypopularity&limit=12`);
    appendCards('trendingGrid', data.data, true);
  } catch(e) {
    document.getElementById('trendingGrid').innerHTML = `<div class="av-empty" style="grid-column:1/-1"><i class="fa fa-exclamation-circle"></i><p>Failed to load. Refresh to retry.</p></div>`;
  }
}

async function loadTopRated(append = false) {
  if (!append) { showSkeletons('topRatedGrid', 12); state.topRatedPage = 1; }
  try {
    let url = `${JIKAN}/anime?type=movie&order_by=score&sort=desc&page=${state.topRatedPage}&limit=12&min_score=6`;
    if (state.topRatedYear) {
      url += `&start_date=${state.topRatedYear}-01-01&end_date=${state.topRatedYear}-12-31`;
    }
    const data = await jikanFetch(url);
    appendCards('topRatedGrid', data.data, !append);
    state.topRatedPage++;
  } catch(e) { console.warn('TopRated load failed', e); }
}

// Valid /top/anime filters: bypopularity, favorite, airing, upcoming
// For score/title sorting we use /anime endpoint instead
const TOP_FILTER_MAP = {
  bypopularity: { endpoint: 'top', filter: 'bypopularity' },
  favorite:     { endpoint: 'top', filter: 'favorite' },
  score:        { endpoint: 'anime', orderBy: 'score', sort: 'desc' },
  title:        { endpoint: 'anime', orderBy: 'title', sort: 'asc' },
  rank:         { endpoint: 'top', filter: 'bypopularity' },
};

async function loadAllMovies(append = false) {
  if (!append) { showSkeletons('allMoviesGrid', 12); state.allMoviesPage = 1; }
  try {
    const mapping = TOP_FILTER_MAP[state.allMoviesSort] || TOP_FILTER_MAP['bypopularity'];
    let url;
    if (mapping.endpoint === 'top') {
      url = `${JIKAN}/top/anime?type=movie&filter=${mapping.filter}&page=${state.allMoviesPage}&limit=18`;
    } else {
      url = `${JIKAN}/anime?type=movie&order_by=${mapping.orderBy}&sort=${mapping.sort}&page=${state.allMoviesPage}&limit=18`;
    }
    const data = await jikanFetch(url);
    appendCards('allMoviesGrid', data.data, !append);
    state.allMoviesPage++;
  } catch(e) { console.warn('AllMovies load failed', e); }
}

async function loadGhibli() {
  showSkeletons('ghibliGrid', 6);
  try {
    const data = await jikanFetch(`${JIKAN}/anime?q=studio+ghibli&type=movie&order_by=score&sort=desc&limit=6`);
    appendCards('ghibliGrid', data.data, true);
  } catch(e) {
    const data2 = await jikanFetch(`${JIKAN}/producer/21/anime?type=movie&limit=6`).catch(()=>null);
    if (data2) appendCards('ghibliGrid', data2.data, true);
  }
}

// ===================== SEARCH =====================

async function performSearch(query, append = false) {
  if (!query.trim()) return;
  state.searchQuery = query.trim();

  document.getElementById('searchResultsSection').style.display = 'block';
  document.getElementById('searchQuery').textContent = `"${state.searchQuery}"`;
  hideSections();

  if (!append) { showSkeletons('searchResultsGrid', 12); state.searchPage = 1; }

  try {
    const data = await jikanFetch(`${JIKAN}/anime?q=${encodeURIComponent(state.searchQuery)}&type=movie&page=${state.searchPage}&limit=24&sfw=false`);
    appendCards('searchResultsGrid', data.data, !append);
    state.searchPage++;
    const hasNext = data.pagination?.has_next_page;
    document.getElementById('searchLoadMore').style.display = hasNext ? 'block' : 'none';
  } catch(e) {
    document.getElementById('searchResultsGrid').innerHTML = `<div class="av-empty" style="grid-column:1/-1"><i class="fa fa-exclamation-circle"></i><p>Search failed. Please try again.</p></div>`;
  }

  document.getElementById('searchResultsSection').scrollIntoView({behavior:'smooth', block:'start'});
}

function loadMoreSearch() { performSearch(state.searchQuery, true); }

function clearSearch() {
  document.getElementById('searchResultsSection').style.display = 'none';
  document.querySelectorAll('.av-section, #heroSection').forEach(s => s.style.display = '');
  document.getElementById('headerSearchInput').value = '';
  state.searchQuery = '';
}

function changeMovieSort() {
  state.allMoviesSort = document.getElementById('movieSort').value;
  loadAllMovies(false);
}

// ===================== GENRES =====================

function hideSections() {
  ['trendingGrid','topRatedGrid','allMoviesGrid','ghibliGrid'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.closest('section').style.display = 'none';
  });
  document.querySelector('#genres-section').style.display = 'none';
  document.getElementById('heroSection').style.display = 'none';
}

async function searchByGenre(genreId, genreName) {
  document.getElementById('searchResultsSection').style.display = 'block';
  document.getElementById('searchQuery').textContent = `Genre: ${genreName}`;
  hideSections();
  showSkeletons('searchResultsGrid', 12);
  try {
    const data = await jikanFetch(`${JIKAN}/anime?genres=${genreId}&type=movie&order_by=score&sort=desc&limit=24&min_score=5`);
    appendCards('searchResultsGrid', data.data, true);
    document.getElementById('searchLoadMore').style.display = 'none';
  } catch(e) {
    document.getElementById('searchResultsGrid').innerHTML = `<div class="av-empty" style="grid-column:1/-1"><p>Failed to load genre.</p></div>`;
  }
  document.getElementById('searchResultsSection').scrollIntoView({behavior:'smooth'});
}

// ===================== DOWNLOAD MODAL =====================

async function openModal(malId, e) {
  if (e && e.stopPropagation) e.stopPropagation();
  const modal = document.getElementById('downloadModal');
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';

  // Reset modal content
  document.getElementById('modalPoster').innerHTML = '';
  document.getElementById('modalTitle').textContent = 'Loading...';
  document.getElementById('modalMeta').innerHTML = '';
  document.getElementById('modalSynopsis').textContent = '';
  document.getElementById('modalBadges').innerHTML = '';
  document.getElementById('downloadLinks').innerHTML = `<div class="av-download-loading"><i class="fa fa-spinner fa-spin"></i> Fetching download links...</div>`;
  document.getElementById('streamLinks').innerHTML = '';

  try {
    const data = await jikanFetch(`${JIKAN}/anime/${malId}/full`);
    const a = data.data;
    const title = a.title_english || a.title;
    const year  = getYear(a);
    const score = a.score ? a.score.toFixed(1) : 'N/A';
    const img   = a.images?.jpg?.large_image_url || a.images?.jpg?.image_url || '';

    // Poster
    if (img) document.getElementById('modalPoster').innerHTML = `<img src="${img}" alt="${title}">`;

    // Badges
    document.getElementById('modalBadges').innerHTML = `
      <span class="av-modal__badge av-modal__badge--type">${a.type || 'Movie'}</span>
      <span class="av-modal__badge av-modal__badge--score">★ ${score}</span>
      ${year ? `<span class="av-modal__badge av-modal__badge--year">${year}</span>` : ''}
      ${a.status ? `<span class="av-modal__badge" style="background:rgba(0,200,83,0.15);color:#00c853;border:1px solid #00c853">${a.status}</span>` : ''}`;

    document.getElementById('modalTitle').textContent = title;

    const genres = (a.genres||[]).map(g=>g.name).join(', ');
    const studios = (a.studios||[]).map(s=>s.name).join(', ') || 'N/A';
    document.getElementById('modalMeta').innerHTML = `
      <span><i class="fa fa-clock-o"></i> ${a.duration||'N/A'}</span>
      <span><i class="fa fa-film"></i> ${a.rating||'N/A'}</span>
      <span><i class="fa fa-industry"></i> ${studios}</span>
      ${genres ? `<span><i class="fa fa-tag"></i> ${genres}</span>` : ''}`;

    document.getElementById('modalSynopsis').textContent = stripHtml(a.synopsis);

    // Download links
    buildDownloadLinks(title, year, malId);
    buildStreamLinks(title, malId, a.url);

  } catch(err) {
    document.getElementById('modalTitle').textContent = 'Failed to load details';
    document.getElementById('downloadLinks').innerHTML = buildFallbackLinks('Anime', null);
  }
}

function buildDownloadLinks(title, year, malId) {
  const q = encodeURIComponent(title);
  const qYear = year ? encodeURIComponent(`${title} ${year}`) : q;

  const links = [
    {
      icon: '🧲',
      name: 'Nyaa.si – Torrent Download',
      desc: 'Best quality • Multiple resolutions (480p / 720p / 1080p)',
      url: `https://nyaa.si/?f=0&c=1_2&q=${q}`,
      badge: 'TORRENT', badgeClass: 'av-dl-link__badge--torrent'
    },
    {
      icon: '⬇️',
      name: 'Nyaa.si – 1080p BluRay',
      desc: 'Filter by best seeders • BluRay encode',
      url: `https://nyaa.si/?f=0&c=1_2&q=${q}+1080p`,
      badge: 'FREE', badgeClass: 'av-dl-link__badge--free'
    },
    {
      icon: '📦',
      name: 'AnimeKaizoku – Direct Download',
      desc: 'Google Drive / GDrive hosted • No torrent required',
      url: `https://animekaizoku.com/?s=${q}`,
      badge: 'FREE', badgeClass: 'av-dl-link__badge--free'
    },
    {
      icon: '🎬',
      name: 'AnimeDrive – DDL Download',
      desc: 'Direct download links • Multiple formats',
      url: `https://animedrive.hu/?s=${q}`,
      badge: 'FREE', badgeClass: 'av-dl-link__badge--free'
    },
    {
      icon: '🌐',
      name: 'AnimeOut – Encoded Downloads',
      desc: 'Compressed high quality • Small file sizes',
      url: `https://www.animeout.xyz/?s=${q}`,
      badge: 'FREE', badgeClass: 'av-dl-link__badge--free'
    },
    {
      icon: '🔗',
      name: 'AniDL – Batch Download',
      desc: 'Mega.nz & Google Drive links',
      url: `https://anidl.org/?s=${q}`,
      badge: 'FREE', badgeClass: 'av-dl-link__badge--free'
    }
  ];

  document.getElementById('downloadLinks').innerHTML = links.map(l => `
    <a href="${l.url}" target="_blank" rel="noopener" class="av-dl-link">
      <div class="av-dl-link__left">
        <span class="av-dl-link__icon">${l.icon}</span>
        <div class="av-dl-link__info">
          <strong>${l.name}</strong>
          <span>${l.desc}</span>
        </div>
      </div>
      <span class="av-dl-link__badge ${l.badgeClass}">${l.badge}</span>
    </a>`).join('');
}

function buildStreamLinks(title, malId, malUrl) {
  const q = encodeURIComponent(title);
  const links = [
    { icon: '▶', name: 'GogoAnime',    url: `https://gogoanime3.co/search.html?keyword=${q}` },
    { icon: '▶', name: 'Zoro.to',      url: `https://zoro.to/search?keyword=${q}` },
    { icon: '▶', name: 'AnimeHaven',   url: `https://animehaven.to/search?q=${q}` },
    { icon: '▶', name: 'MyAnimeList',  url: malUrl || `https://myanimelist.net/anime/${malId}` },
  ];
  document.getElementById('streamLinks').innerHTML = links.map(l => `
    <a href="${l.url}" target="_blank" rel="noopener" class="av-stream-link">
      <span>${l.icon}</span> ${l.name}
      <i class="fa fa-external-link" style="margin-left:auto;font-size:11px;color:#888"></i>
    </a>`).join('');
}

function buildFallbackLinks(title, year) {
  return buildDownloadLinks(title, year, 0);
}

function closeModal() {
  document.getElementById('downloadModal').classList.remove('open');
  document.body.style.overflow = '';
}

// Close modal on overlay click
document.getElementById('downloadModal').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

// Escape key to close
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ===================== TOP RATED YEAR FILTER =====================

document.getElementById('topRatedFilters').addEventListener('click', e => {
  const btn = e.target.closest('.av-filter-tab');
  if (!btn) return;
  document.querySelectorAll('#topRatedFilters .av-filter-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const f = btn.dataset.filter;
  state.topRatedYear = f === 'all' ? null : f;
  loadTopRated(false);
});

// ===================== SEARCH EVENTS =====================

document.getElementById('headerSearchBtn').addEventListener('click', () => {
  const q = document.getElementById('headerSearchInput').value;
  if (q.trim()) performSearch(q);
});

document.getElementById('headerSearchInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const q = e.target.value;
    if (q.trim()) performSearch(q);
  }
});

// ===================== LOAD MORE BUTTONS =====================

document.getElementById('loadMoreTopRated').addEventListener('click', () => loadTopRated(true));
document.getElementById('loadMoreMovies').addEventListener('click',   () => loadAllMovies(true));

// ===================== SCROLL EVENTS =====================

window.addEventListener('scroll', () => {
  const scrollBtn = document.getElementById('scrollTop');
  const header    = document.getElementById('mainHeader');
  if (window.scrollY > 300) scrollBtn.classList.add('visible');
  else scrollBtn.classList.remove('visible');
  if (window.scrollY > 60) header.classList.add('scrolled');
  else header.classList.remove('scrolled');
});

// ===================== HAMBURGER =====================

document.getElementById('hamburger').addEventListener('click', () => {
  document.getElementById('mobileNav').classList.toggle('open');
});

// ===================== PRELOADER =====================

window.addEventListener('load', () => {
  const pre = document.getElementById('preloder');
  if (pre) setTimeout(() => { pre.style.opacity='0'; setTimeout(()=>pre.remove(),400); }, 600);
});

// ===================== SMOOTH NAV SCROLL =====================

document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', e => {
    const target = document.querySelector(link.getAttribute('href'));
    if (target) { e.preventDefault(); target.scrollIntoView({behavior:'smooth', block:'start'}); }
  });
});

// ===================== INIT =====================

async function init() {
  // Load all sections with small delays to respect Jikan rate limiting
  await loadHero();
  await sleep(600);
  await loadTrending();
  await sleep(600);
  await loadTopRated();
  await sleep(600);
  await loadAllMovies();
  await sleep(600);
  await loadGhibli();
}

init();
