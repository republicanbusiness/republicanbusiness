const CATEGORY_COLORS = {
  Restaurant:   '#e74c3c',
  Retail:       '#3498db',
  Healthcare:   '#e67e22',
  Legal:        '#1abc9c',
  Financial:    '#f39c12',
  Construction: '#7f8c8d',
  'Real Estate':'#9b59b6',
  Auto:         '#e91e63',
  Services:     '#2ecc71',
  Technology:   '#00bcd4',
  Agriculture:  '#8bc34a',
  Other:        '#95a5a6',
};

const map = L.map('map', {
  center: [39.5, -98.35],
  zoom: 4,
  zoomControl: true,
});

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19,
}).addTo(map);

const cluster = L.markerClusterGroup({
  chunkedLoading: true,
  maxClusterRadius: 60,
  spiderfyOnMaxZoom: true,
  showCoverageOnHover: false,
});
map.addLayer(cluster);

let all = [];
let activeCategory = 'all';
let searchQuery = '';

function pinIcon(category) {
  const color = CATEGORY_COLORS[category] || '#B22234';
  return L.divIcon({
    className: '',
    html: `<div class="map-pin" style="--color:${color}"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -12],
  });
}

function buildPopup(biz) {
  const color = CATEGORY_COLORS[biz.category] || '#B22234';
  const phone = biz.phone
    ? `<a class="popup-link" href="tel:${biz.phone.replace(/\D/g,'')}">${biz.phone}</a>`
    : '';
  const site = biz.website
    ? `<a class="popup-link popup-website" href="${biz.website}" target="_blank" rel="noopener">Visit Website &rarr;</a>`
    : '';
  const desc = biz.description
    ? `<p class="popup-desc">${biz.description}</p>`
    : '';

  return `
    <div class="popup-card">
      <span class="popup-cat" style="--color:${color}">${biz.category}</span>
      <h3 class="popup-name">${biz.name}</h3>
      <p class="popup-addr">${biz.address}, ${biz.city}, ${biz.state}${biz.zip ? ' ' + biz.zip : ''}</p>
      ${phone}${desc}${site}
    </div>`;
}

function render() {
  cluster.clearLayers();
  const q = searchQuery.toLowerCase();
  let shown = 0;
  const mappable = all.filter(b => b.lat && b.lng);

  for (const biz of mappable) {
    if (activeCategory !== 'all' && biz.category !== activeCategory) continue;
    if (q && !`${biz.name} ${biz.city} ${biz.state} ${biz.description || ''}`.toLowerCase().includes(q)) continue;
    const marker = L.marker([biz.lat, biz.lng], { icon: pinIcon(biz.category) });
    marker.bindPopup(buildPopup(biz), { maxWidth: 270, className: 'custom-popup' });
    cluster.addLayer(marker);
    shown++;
  }

  const total = mappable.length;
  const status = document.getElementById('statusbar');
  status.textContent = shown === total
    ? `${total} business${total !== 1 ? 'es' : ''} on the map`
    : `Showing ${shown} of ${total} businesses`;
}

async function load() {
  try {
    const res = await fetch('/data/businesses.json');
    all = await res.json();
    render();
  } catch {
    document.getElementById('statusbar').textContent = 'Failed to load business data.';
  }
}

let searchTimer;
document.getElementById('search').addEventListener('input', e => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { searchQuery = e.target.value.trim(); render(); }, 250);
});

document.getElementById('categories').addEventListener('click', e => {
  const btn = e.target.closest('.cat-btn');
  if (!btn) return;
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  activeCategory = btn.dataset.cat;
  render();
});

load();
