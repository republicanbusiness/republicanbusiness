const fs   = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../data');
const outFile = path.join(__dirname, '../public/data/businesses.json');

const businesses = fs.readdirSync(dataDir)
  .filter(f => f.endsWith('.json'))
  .sort()
  .map(f => JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8')));

fs.writeFileSync(outFile, JSON.stringify(businesses, null, 2) + '\n');
console.log(`Compiled ${businesses.length} businesses into businesses.json`);
