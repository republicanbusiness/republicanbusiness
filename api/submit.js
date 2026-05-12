// Vercel serverless function — receives anonymous business submissions,
// geocodes the address, and opens a GitHub PR with the updated businesses.json
// so the maintainer can review and merge to publish to the live map.

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
  const dataPath = 'public/data/businesses.json';

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
        const q = [address, city, state, zip, 'USA'].filter(Boolean).join(', ');
        const geo = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
          { headers: { 'User-Agent': `RepublicanBusinessMap/1.0 (+https://github.com/${owner}/${repo})` } }
        );
        const geoData = await geo.json();
        if (geoData.length > 0) {
          finalLat = parseFloat(geoData[0].lat);
          finalLng = parseFloat(geoData[0].lon);
        }
      } catch {
        // Geocoding failed — PR will note coordinates need manual entry
      }
    }

    // Get current main branch SHA
    const mainRef  = await gh('GET', `/git/ref/heads/${base}`);
    const mainSha  = mainRef.object.sha;

    // Get current businesses.json (need its SHA to update it)
    const fileData  = await gh('GET', `/contents/${dataPath}`);
    const businesses = JSON.parse(Buffer.from(fileData.content, 'base64').toString('utf8'));

    const newBiz = {
      id:          Date.now().toString(),
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

    businesses.push(newBiz);
    const updatedContent = Buffer.from(JSON.stringify(businesses, null, 2) + '\n').toString('base64');

    // Branch name: submission/TIMESTAMP-slug
    const slug       = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
    const branchName = `submission/${Date.now()}-${slug}`;

    await gh('POST', '/git/refs', { ref: `refs/heads/${branchName}`, sha: mainSha });

    // Commit the updated businesses.json directly — merging this PR is all the maintainer needs to do
    await gh('PUT', `/contents/${dataPath}`, {
      message: `Add business: ${newBiz.name} (${newBiz.city}, ${newBiz.state})`,
      content:  updatedContent,
      sha:      fileData.sha,
      branch:   branchName,
    });

    const coordNote = finalLat
      ? `**Coordinates:** ${finalLat.toFixed(6)}, ${finalLng.toFixed(6)} (auto-geocoded)\n> [View on map](https://www.openstreetmap.org/?mlat=${finalLat}&mlon=${finalLng}&zoom=15)`
      : `**Coordinates:** Not found — please add \`lat\` and \`lng\` values to \`businesses.json\` before merging, or the pin will not appear on the map.`;

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
