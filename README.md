# Republican Business Map

A map of Republican-owned and Republican-friendly businesses, built on GitHub Pages + Vercel. Anyone can anonymously submit a business; submissions automatically open a GitHub Pull Request. The maintainer reviews the PR and merges it — the business appears on the live map instantly.

## How it works

```
Visitor submits form
  → Vercel serverless function geocodes the address (free, no API key)
  → Creates a new branch with the updated businesses.json
  → Opens a Pull Request with a formatted review checklist
  → Maintainer reviews and merges PR
  → Map updates automatically on next page load
```

No database. No admin panel. The PR *is* the admin panel.

---

## Setup (about 10 minutes)

### 1. Fork & clone this repo

```bash
git clone https://github.com/YOUR_USERNAME/republican-business-map.git
cd republican-business-map
```

### 2. Create a GitHub Fine-Grained Personal Access Token

1. Go to **GitHub → Settings → Developer Settings → Personal access tokens → Fine-grained tokens**
2. Click **Generate new token**
3. Set:
   - **Resource owner**: your account (or org)
   - **Repository access**: Only this repository
   - **Permissions**:
     - `Contents` → **Read and write**
     - `Pull requests` → **Read and write**
4. Copy the token — you'll need it in the next step

### 3. Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **Add New Project** and import this repository
3. Vercel auto-detects the setup — no framework configuration needed
4. Before deploying, add these **Environment Variables**:

   | Variable | Value |
   |---|---|
   | `GITHUB_TOKEN` | The token you just created |
   | `GITHUB_OWNER` | Your GitHub username |
   | `GITHUB_REPO` | `republican-business-map` (or your repo name) |
   | `GITHUB_BRANCH` | `main` |

5. Click **Deploy**

That's it. Your site is live.

---

## Adding businesses directly

Edit `public/data/businesses.json` and add an entry:

```json
{
  "id": "unique-string",
  "name": "Business Name",
  "address": "123 Main St",
  "city": "City",
  "state": "TX",
  "zip": "75001",
  "category": "Retail",
  "phone": "214-555-0100",
  "website": "https://example.com",
  "description": "Optional description.",
  "lat": 32.7767,
  "lng": -96.7970
}
```

Commit and push — the map updates automatically.

**Valid categories:** `Restaurant`, `Retail`, `Healthcare`, `Legal`, `Financial`, `Construction`, `Real Estate`, `Auto`, `Services`, `Technology`, `Agriculture`, `Other`

---

## Reviewing submissions

Each submission opens a PR like:

> **Submission: Smith's Hardware — Nashville, TN**

The PR contains:
- A table of all submitted business details
- Auto-geocoded coordinates with a map link to verify placement
- A review checklist

To publish the business: **review and merge the PR**. Nothing else needed.

If geocoding failed (rare), the PR will flag it — add `lat` and `lng` values to the JSON in the PR before merging.

---

## Customizing

- **Site name / branding**: Edit the `<title>` tags and `.logo` text in `public/index.html` and `public/submit.html`
- **Categories**: Update the `<select>` options in `submit.html`, the `CATEGORY_COLORS` object in `map.js`, and the filter buttons in `index.html`
- **Map default view**: Change `center` and `zoom` in `public/js/map.js`
- **Color scheme**: Edit CSS variables at the top of `public/css/style.css`
