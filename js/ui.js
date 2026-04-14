function valClass(v) {
  if (v === 0) return 'val-zero';
  if (v >= 3) return 'val-high';
  if (v >= 1) return 'val-mid';
  return 'val-low';
}

function h2hText(pts, gp) {
  if (gp === 0) return '<span class="val-zero">—</span>';
  return `<span class="h2h">${pts}pt / ${gp}M</span>`;
}

function renderTable(rows, tableId) {
  return `
  <div class="table-wrap">
  <table id="${tableId}">
    <thead>
      <tr>
        <th>#</th>
        <th>Joueur</th>
        <th>Pos</th>
        <th class="sorted">Pts<br>10M</th>
        <th>Pts<br>5M</th>
        <th>Pts<br>2M</th>
        <th>Pts<br>Der.</th>
        <th>Passe<br>10M</th>
        <th>But<br>10M</th>
        <th>Pts<br>B2B</th>
        <th>H2H<br>Saison</th>
        <th>H2H<br>5 Saisons</th>
      </tr>
    </thead>
    <tbody>
    ${rows.map((r,i) => `
      <tr>
        <td>${i+1}</td>
        <td>${r.name}${r.onB2B ? ' <span style="color:var(--accent);font-size:10px">B2B</span>' : ''}</td>
        <td><span class="pos-badge pos-${r.pos}">${r.pos}</span></td>
        <td class="${valClass(r.pts10)}">${r.pts10}</td>
        <td class="${valClass(r.pts5)}">${r.pts5}</td>
        <td class="${valClass(r.pts2)}">${r.pts2}</td>
        <td class="${valClass(r.pts1)}">${r.pts1}</td>
        <td class="${valClass(r.a10)}">${r.a10}</td>
        <td class="${valClass(r.g10)}">${r.g10}</td>
        <td>${r.b2b || '—'}</td>
        <td>${h2hText(r.h2hSznPts, r.h2hSznGP)}</td>
        <td>${h2hText(r.h2h5Pts, r.h2h5GP)}</td>
      </tr>`).join('')}
    </tbody>
  </table>
  </div>`;
}
