'use strict';
// All matching happens locally against the locator's road and district layers.
function districtMatches(value) {
  const q = normalizeRoad(value);
  if (q.length < 3) return [];
  const names = [...new Set(roadIndex.map(r => r.district).filter(Boolean))];
  const exact = names.filter(n => normalizeRoad(n) === q);
  if (exact.length) return exact;
  return names.filter(n => normalizeRoad(n).split(' ').includes(q) ||
    n.split('/').some(part => similarity(normalizeRoad(part), q) >= .76));
}
function estimateLocation(c) {
  const explicit = districtMatches(c.district);
  const scope = explicit.length ? explicit : districtMatches(c.area);
  const pool = scope.length ? roadIndex.filter(r => scope.includes(r.district)) : roadIndex;
  const area = normalizeRoad(c.area);
  const terms = normalizeRoad(c.location).split(' ').filter(t => t && !/^\d+[a-z]?$/.test(t) && t !== area);
  const q = terms.join(' ');
  let best, score = 0;
  for (const r of pool) {
    if (!q || !r.key || /^(road|street|trace|unknown|unnamed road)$/.test(r.key)) continue;
    let rank = similarity(q, r.key);
    const width = r.key.split(' ').length;
    for (let i = 0; i + width <= terms.length; i++) {
      rank = Math.max(rank, similarity(terms.slice(i, i + width).join(' '), r.key));
    }
    if (rank > score) { best = r; score = rank; }
  }
  if (best && score >= .72) return {pin: best.point, estimate: 'Road estimate · '+best.name+(best.district?' · '+best.district:'')};
  if (!scope.length || !pool.length) return null;
  const mean = pool.reduce((sum,r)=>[sum[0]+r.point[0]/pool.length,sum[1]+r.point[1]/pool.length],[0,0]);
  const distance = r => (r.point[0]-mean[0])**2+(r.point[1]-mean[1])**2;
  const nearest = pool.reduce((a,b)=>distance(a)<distance(b)?a:b);
  return {pin: nearest.point, estimate: 'Area estimate · '+(explicit.length?c.district:c.area)};
}
function applyEstimate(c) {
  if (position(c) || c.checked || c.status === 'Closed') return false;
  const result = estimateLocation(c);
  if (!result) return false;
  Object.assign(c, result);
  return true;
}
const upgraded = cases.map(c => ({...c}));
if (upgraded.map(applyEstimate).some(Boolean)) save(upgraded);
