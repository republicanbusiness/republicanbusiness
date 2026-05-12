// Vercel serverless function — receives anonymous business submissions,
// geocodes the address, and opens a GitHub PR that adds a single JSON file
// to the data/ folder. A GitHub Action compiles all files into businesses.json
// after each merge, so multiple open PRs never conflict.

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, address, city, state, zip, category, phone, website, description, lat, lng } =
    req.body || {};

  if (!name?.trim() || !address?.trim() || !city?.trim() || !state?.trim() || !category) {
    return res.status(400).json({ error: 'Name, address, city, state, and category are required.' });
  }

  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo  = process.env.GITHUB_REPO;
  const base  = process.env.GITHUB_BRANCH || 'main';

  if (!token || !owner || !repo) {
    return res.status(500).json({ error: 'Server configuration error.' });
  }

  async function gh(method, path, body) {
    const r = await fetch(`https://api.github.com/repos/${owner}/${repo}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) {
      const txt = await r.text();
      throw new Error(`GitHub ${r.status}: ${txt}`);
    }
    return r.status === 204 ? null : r.json();
  }

  try {
    // Geocode server-side if the client didn't provide coordinates
    let finalLat = lat ? parseFloat(lat) : null;
    let finalLng = lng ? parseFloat(lng) : null;

    if (!finalLat || !finalLng) {
      try {
        const ua = { 'User-Agent': `RepublicanBusinessMap/1.0 (+https://github.com/${owner}/${repo})` };
        const stripped = address.replace(/[,\s]+(ste|ste\.|suite|apt|apt\.|apartment|unit|#|floor|fl|room|rm|bldg|building)\.?\s*[\w-]*/gi, '').trim();
        const q = [stripped, city, state, zip, 'USA'].filter(Boolean).join(', ');
        const r = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
          { headers: ua }
        );
        const geoData = await r.json();
        if (geoData.length > 0) {
          finalLat = parseFloat(geoData[0].lat);
          finalLng = parseFloat(geoData[0].lon);
        }
      } catch {
        // Geocoding failed — PR will flag for manual entry
      }
    }

    const id   = Date.now().toString();
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

    const newBiz = {
      id,
      name:        name.trim(),
      address:     address.trim(),
      city:        city.trim(),
      state:       state.trim().toUpperCase().slice(0, 2),
      zip:         (zip || '').trim(),
      category,
      phone:       (phone || '').trim(),
      website:     (website || '').trim(),
      description: (description || '').trim(),
      lat:         finalLat,
      lng:         finalLng,
    };

    // Get main branch SHA
    const mainRef = await gh('GET', `/git/ref/heads/${base}`);
    const mainSha = mainRef.object.sha;

    // Create PR branch
    const branchName = `submission/${id}-${slug}`;
    await gh('POST', '/git/refs', { ref: `refs/heads/${branchName}`, sha: mainSha });

    // Add a single new file — no existing files touched, so no conflicts possible
    const filename = `data/${id}-${slug}.json`;
    await gh('PUT', `/contents/${filename}`, {
      message: `Add business: ${newBiz.name} (${newBiz.city}, ${newBiz.state})`,
      content: Buffer.from(JSON.stringify(newBiz, null, 2) + '\n').toString('base64'),
      branch:  branchName,
    });

    const coordNote = finalLat
      ? `**Coordinates:** ${finalLat.toFixed(6)}, ${finalLng.toFixed(6)} (auto-geocoded)\n> [View on map](https://www.openstreetmap.org/?mlat=${finalLat}&mlon=${finalLng}&zoom=15)`
      : `**Coordinates:** Not found — please edit the file in this PR and add \`lat\` and \`lng\` values before merging.`;

    const prBody = [
      '## New Business Submission',
      '',
      '> **Merging this PR will automatically publish the business to the live map.** No other steps required.',
      '',
      '| Field | Value |',
      '|---|---|',
      `| **Name** | ${newBiz.name} |`,
      `| **Category** | ${newBiz.category} |`,
      `| **Address** | ${newBiz.address}, ${newBiz.city}, ${newBiz.state}${newBiz.zip ? ' ' + newBiz.zip : ''} |`,
      `| **Phone** | ${newBiz.phone || '_not provided_'} |`,
      `| **Website** | ${newBiz.website ? `[${newBiz.website}](${newBiz.website})` : '_not provided_'} |`,
      `| **Description** | ${newBiz.description || '_not provided_'} |`,
      '',
      coordNote,
      '',
      '### Review checklist',
      '- [ ] Business name and address look real and correct',
      '- [ ] Category is appropriate',
      finalLat
        ? '- [ ] Map pin location looks accurate (see coordinates link above)'
        : '- [ ] **Add coordinates manually before merging** (geocoding failed)',
      '',
      '---',
      '_Submitted anonymously via the Republican Business Map website._',
    ].join('\n');

    const pr = await gh('POST', '/pulls', {
      title: `Submission: ${newBiz.name} — ${newBiz.city}, ${newBiz.state}`,
      body:  prBody,
      head:  branchName,
      base,
    });

    return res.status(200).json({ success: true, prUrl: pr.html_url });

  } catch (err) {
    console.error('Submission error:', err.message);
    return res.status(500).json({ error: 'Failed to create submission. Please try again later.' });
  }
};
