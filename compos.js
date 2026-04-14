/****************************************************
 * MIKADO SPORTS ▪ PRONOS — COMPOS ULTRA OPTIMISÉES
 * Version BOXSCORE — Partie 1/4
 * - Constantes
 * - Caches
 * - Helpers
 * - smartFetch()
 * - fetchLanding()
 * - fetchBoxscore()  ← source officielle NHL
 ****************************************************/

let _composLoaded = false;

// 🧠 Cache mémoire (réinitialisé à chaque session)
const lastGameCache = {};     // teamAbbrev → lastGameId
const landingCache = {};      // gameId → landing JSON
const boxscoreCache = {};     // gameId → boxscore JSON
const lineupCache = {};       // gameId → lineup construit

// 🗓 Cache localStorage (réinitialisé chaque jour)
function getDailyCacheKey() {
  return 'mikado_compos_' + today();
}

/****************************************************
 * FETCH INTELLIGENT (API NHL + WORKER)
 * - Timeout 5s
 * - Retry via WORKER
 * - Anti-crash
 ****************************************************/
async function smartFetch(url) {
  const urls = [
    url,
    `${WORKER}?url=${encodeURIComponent(url)}`
  ];

  let lastErr = null;

  for (const u of urls) {
    try {
      const r = await fetch(u, { signal: AbortSignal.timeout(5000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      lastErr = e;
      console.warn('Fetch échoué:', u, e.message);
    }
  }

  throw lastErr || new Error("Erreur réseau");
}

/****************************************************
 * LANDING CACHE — fallback secondaire
 ****************************************************/
async function fetchLanding(gameId) {
  if (landingCache[gameId]) return landingCache[gameId];

  const data = await smartFetch(`${NHL_API}/game/${gameId}/landing`);
  landingCache[gameId] = data;
  return data;
}

/****************************************************
 * BOXSCORE — SOURCE OFFICIELLE NHL (BLOC 1)
 ****************************************************/
async function fetchBoxscore(gameId) {
  if (boxscoreCache[gameId]) return boxscoreCache[gameId];

  const url = `${NHL_API.replace('/v1','')}/v1/gamecenter/${gameId}/boxscore`;

  const urls = [
    url,
    `${WORKER}?url=${encodeURIComponent(url)}`
  ];

  let lastErr = null;

  for (const u of urls) {
    try {
      const r = await fetch(u, { signal: AbortSignal.timeout(5000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);

      const data = await r.json();

      const hasLineups =
        data?.boxscore?.teams?.home?.forwards?.length ||
        data?.boxscore?.teams?.away?.forwards?.length;

      if (hasLineups) {
        boxscoreCache[gameId] = data;
        return data;
      }

      lastErr = new Error("Boxscore sans lineups");
    } catch (e) {
      lastErr = e;
      console.warn("fetchBoxscore échoué:", u, e.message);
    }
  }

  throw lastErr || new Error("Impossible de charger le boxscore");
}
/****************************************************
 * PARTIE 2/4 — LOGIQUE COMPOS
 * - Extraction BOXSCORE (officielle)
 * - Fallback LANDING
 * - Fallback dernier match
 * - Fonction getBestLineup()
 ****************************************************/

/****************************************************
 * Extraction depuis BOXSCORE (officielle)
 ****************************************************/
function extractFromBoxscore(data) {
  try {
    const home = data?.boxscore?.teams?.home;
    const away = data?.boxscore?.teams?.away;

    if (!home || !away) return null;

    return {
      away: {
        forwards: away.forwards || [],
        defense: away.defense || [],
        goalies: away.goalies || []
      },
      home: {
        forwards: home.forwards || [],
        defense: home.defense || [],
        goalies: home.goalies || []
      },
      status: "official"
    };
  } catch {
    return null;
  }
}

/****************************************************
 * Extraction depuis LANDING (fallback secondaire)
 ****************************************************/
function extractFromLanding(data) {
  try {
    const away = data?.awayTeam;
    const home = data?.homeTeam;

    if (!away || !home) return null;

    const af = away.forwards || [];
    const ad = away.defensemen || [];
    const ag = away.goalies || [];

    const hf = home.forwards || [];
    const hd = home.defensemen || [];
    const hg = home.goalies || [];

    if (!af.length && !hf.length) return null;

    return {
      away: { forwards: af, defense: ad, goalies: ag },
      home: { forwards: hf, defense: hd, goalies: hg },
      status: "landing"
    };
  } catch {
    return null;
  }
}

/****************************************************
 * Extraction depuis le dernier match (fallback final)
 ****************************************************/
async function extractFromLastGame(teamAbbrev) {
  try {
    const lastId = await getLastGameId(teamAbbrev);
    if (!lastId) return null;

    const data = await fetchLanding(lastId);

    const isHome = data?.homeTeam?.abbrev === teamAbbrev;
    const t = isHome ? data.homeTeam : data.awayTeam;

    return {
      forwards: t?.forwards || [],
      defense: t?.defensemen || [],
      goalies: t?.goalies || []
    };
  } catch {
    return null;
  }
}

/****************************************************
 * getBestLineup(gameId, away, home)
 * - 1) BOXSCORE (officielle)
 * - 2) LANDING (fallback)
 * - 3) LAST GAME (fallback final)
 ****************************************************/
async function getBestLineup(gameId, away, home) {

  /***********************
   * 1️⃣ BOXSCORE OFFICIEL
   ***********************/
  try {
    const box = await fetchBoxscore(gameId);
    const parsed = extractFromBoxscore(box);
    if (parsed) return parsed;
  } catch (e) {
    console.warn("Boxscore indisponible:", e.message);
  }

  /***********************
   * 2️⃣ LANDING (fallback)
   ***********************/
  try {
    const land = await fetchLanding(gameId);
    const parsed = extractFromLanding(land);
    if (parsed) return parsed;
  } catch (e) {
    console.warn("Landing indisponible:", e.message);
  }

  /***********************
   * 3️⃣ DERNIER MATCH
   ***********************/
  try {
    const awayLast = await extractFromLastGame(away.abbrev);
    const homeLast = await extractFromLastGame(home.abbrev);

    if (awayLast || homeLast) {
      return {
        away: awayLast || { forwards: [], defense: [], goalies: [] },
        home: homeLast || { forwards: [], defense: [], goalies: [] },
        status: "lastgame"
      };
    }
  } catch (e) {
    console.warn("Dernier match indisponible:", e.message);
  }

  /***********************
   * 4️⃣ AUCUNE COMPO
   ***********************/
  return {
    away: { forwards: [], defense: [], goalies: [] },
    home: { forwards: [], defense: [], goalies: [] },
    status: "none"
  };
}
/****************************************************
 * PARTIE 3/4 — AUTO‑REFRESH INTELLIGENT
 * - Refresh toutes les 45s si match en cours
 * - Stop dès que l’officielle tombe
 * - Jamais de refresh inutile
 ****************************************************/

let refreshTimer = null;

/****************************************************
 * Détermine si le match est en cours
 ****************************************************/
function isGameLive(gameState) {
  return ["LIVE", "CRIT", "PRE_GAME", "IN_PROGRESS"].includes(gameState);
}

/****************************************************
 * Lance le refresh automatique
 ****************************************************/
function startAutoRefresh(gameId, away, home, gameState) {
  // Si déjà actif → ne pas doubler
  if (refreshTimer) return;

  // Match pas en cours → pas de refresh
  if (!isGameLive(gameState)) return;

  console.log("🔄 Auto-refresh activé pour le match", gameId);

  refreshTimer = setInterval(async () => {
    try {
      console.log("🔄 Refresh compos…");

      const lineup = await getBestLineup(gameId, away, home);

      // Si l’officielle tombe → stop refresh
      if (lineup.status === "official") {
        console.log("🟢 Officielle détectée → arrêt du refresh");
        stopAutoRefresh();
      }

      // Mise à jour visuelle immédiate
      renderLineup(lineup, away, home);

      // Mise à jour du cache quotidien
      saveDailyCache(lineup);

    } catch (e) {
      console.warn("Erreur refresh:", e.message);
    }
  }, 45000); // 45 secondes
}

/****************************************************
 * Stoppe le refresh automatique
 ****************************************************/
function stopAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

/****************************************************
 * Sauvegarde du cache quotidien
 ****************************************************/
function saveDailyCache(lineup) {
  try {
    const key = getDailyCacheKey();
    localStorage.setItem(key, JSON.stringify(lineup));
  } catch (e) {
    console.warn("Impossible de sauvegarder le cache:", e.message);
  }
}

/****************************************************
 * Rendu visuel (sera utilisé dans loadLineup)
 ****************************************************/
function renderLineup(lineup, away, home) {
  const container = document.getElementById("compos-container");
  if (!container) return;

  container.innerHTML = buildTeams(lineup, away, home);
}
/****************************************************
 * PARTIE 4/4 — LOADLINEUP + BUILD UI
 ****************************************************/

/****************************************************
 * Fonction principale : charge et affiche les compos
 ****************************************************/
async function loadLineup(gameId, away, home, gameState) {
  try {
    // 1) Charger la meilleure compo (boxscore → landing → lastgame)
    const lineup = await getBestLineup(gameId, away, home);

    // 2) Rendu visuel
    renderLineup(lineup, away, home);

    // 3) Sauvegarde cache quotidien
    saveDailyCache(lineup);

    // 4) Auto-refresh si match en cours
    startAutoRefresh(gameId, away, home, gameState);

  } catch (e) {
    console.error("Erreur loadLineup:", e.message);
  }
}

/****************************************************
 * Construction VISUELLE
 ****************************************************/
function buildTeams(lineup, away, home) {
  return `
    <div class="teams-wrapper">
      <div class="team-block">
        <h2>${away.name} (${away.abbrev})</h2>
        ${buildLineup(lineup.away)}
      </div>

      <div class="team-block">
        <h2>${home.name} (${home.abbrev})</h2>
        ${buildLineup(lineup.home)}
      </div>
    </div>
  `;
}

/****************************************************
 * Construction d’une compo (forwards / defense / goalies)
 ****************************************************/
function buildLineup(team) {
  return `
    <div class="lineup-section">
      <h3>Attaquants</h3>
      ${team.forwards.map(p => pSlot(p)).join("")}
    </div>

    <div class="lineup-section">
      <h3>Défenseurs</h3>
      ${team.defense.map(p => pSlot(p)).join("")}
    </div>

    <div class="lineup-section">
      <h3>Gardiens</h3>
      ${team.goalies.map(p => pSlot(p)).join("")}
    </div>
  `;
}

/****************************************************
 * Slot joueur
 ****************************************************/
function pSlot(p) {
  if (!p) return "";

  const num = p.sweaterNumber ? `#${p.sweaterNumber}` : "";
  const pos = p.positionCode || "";
  const name = p.firstName?.default + " " + p.lastName?.default;

  return `
    <div class="player-slot">
      <span class="player-num">${num}</span>
      <span class="player-name">${name}</span>
      <span class="player-pos">${pos}</span>
    </div>
  `;
}
