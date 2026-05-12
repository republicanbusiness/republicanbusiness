let geocodedLat = null;
let geocodedLng = null;
let geocodeTimer;

['address', 'city', 'state', 'zip'].forEach(id => {
  const el = document.getElementById(id);
  el.addEventListener('blur', scheduleGeocode);
  el.addEventListener('input', () => {
    geocodedLat = null;
    geocodedLng = null;
    setGeoStatus('', '');
  });
});

function scheduleGeocode() {
  clearTimeout(geocodeTimer);
  if (!document.getElementById('address').value.trim()) return;
  if (!document.getElementById('city').value.trim()) return;
  if (!document.getElementById('state').value.trim()) return;
  geocodeTimer = setTimeout(geocode, 700);
}

function stripUnit(address) {
  // Remove suite/unit/apt suffixes — Nominatim geocodes the building, not the unit
  return address.replace(/[,\s]+(ste|ste\.|suite|apt|apt\.|apartment|unit|#|floor|fl|room|rm|bldg|building)\.?\s*[\w-]*/gi, '').trim();
}

async function geocode() {
  const address = document.getElementById('address').value.trim();
  const city    = document.getElementById('city').value.trim();
  const state   = document.getElementById('state').value.trim();
  const zip     = document.getElementById('zip').value.trim();
  if (!address || !city || !state) return;

  setGeoStatus('locating', 'Locating address...');
  try {
    const q = [stripUnit(address), city, state, zip, 'USA'].filter(Boolean).join(', ');
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`
    );
    const data = await r.json();
    if (data.length > 0) {
      geocodedLat = parseFloat(data[0].lat);
      geocodedLng = parseFloat(data[0].lon);
      const label = data[0].display_name.split(',').slice(0, 3).join(',');
      setGeoStatus('found', `Location verified: ${label}`);
    } else {
      setGeoStatus('warn', 'Address not found — a reviewer will add the map pin manually.');
    }
  } catch {
    setGeoStatus('warn', 'Could not verify location — a reviewer will add the map pin manually.');
  }
}

function setGeoStatus(type, msg) {
  const el = document.getElementById('geo-status');
  el.textContent = msg;
  el.className = 'geo-status ' + type;
}

document.getElementById('submit-form').addEventListener('submit', async e => {
  e.preventDefault();

  // Honeypot: bots fill this hidden field, humans don't
  if (document.getElementById('hp').value) return;

  const btn     = document.getElementById('submit-btn');
  const errorEl = document.getElementById('form-error');
  errorEl.textContent = '';

  let website = document.getElementById('website').value.trim();
  if (website && !/^https?:\/\//i.test(website)) website = 'https://' + website;

  const payload = {
    name:        document.getElementById('name').value.trim(),
    category:    document.getElementById('category').value,
    address:     document.getElementById('address').value.trim(),
    city:        document.getElementById('city').value.trim(),
    state:       document.getElementById('state').value.trim().toUpperCase(),
    zip:         document.getElementById('zip').value.trim(),
    phone:       document.getElementById('phone').value.trim(),
    website,
    description: document.getElementById('description').value.trim(),
    lat:         geocodedLat,
    lng:         geocodedLng,
  };

  btn.disabled = true;
  btn.textContent = 'Submitting...';

  try {
    const res    = await fetch('/api/submit', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    const result = await res.json();

    if (res.ok && result.success) {
      document.getElementById('submit-form').style.display = 'none';
      const successEl = document.getElementById('success-msg');
      successEl.style.display = 'block';
      document.getElementById('pr-link').href = result.prUrl;
    } else {
      errorEl.textContent = result.error || 'Submission failed. Please try again.';
      btn.disabled = false;
      btn.textContent = 'Submit for Review';
    }
  } catch {
    errorEl.textContent = 'Network error. Please check your connection and try again.';
    btn.disabled = false;
    btn.textContent = 'Submit for Review';
  }
});

document.getElementById('submit-another').addEventListener('click', () => {
  document.getElementById('submit-form').reset();
  document.getElementById('submit-form').style.display = '';
  document.getElementById('success-msg').style.display = 'none';
  geocodedLat = null;
  geocodedLng = null;
  setGeoStatus('', '');
});
