// Per-anchor local searches (2026-10-10). JSearch's radius is in KILOMETERS:
// 80 km ~ 50 miles around Your City, 40 km ~ 25 miles around Nearby City A.
// Simple "<title> jobs in <city>" queries; OR-joined ones miss postings (2026-10-04).
const ANCHORS = [
  { city: 'Your City, WA', radius: '80' },
  { city: 'Nearby City A, WA',   radius: '40' },
];
const TITLES = ['network engineer', 'systems administrator', 'infrastructure engineer'];
const out = [];
for (const a of ANCHORS) for (const t of TITLES) {
  out.push({ json: { query: `${t} jobs in ${a.city}`, radius: a.radius } });
}
return out;
