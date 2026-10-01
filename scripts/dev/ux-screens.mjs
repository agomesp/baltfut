// UX/UI capture harness — drives the running dev server (localhost:3001) with
// Playwright, intercepts ESPN + Supabase at the network layer (so the Web-Worker
// poller is mocked too), and saves full-page + viewport PNGs for every screen,
// at desktop / tablet / mobile, plus mocked single-live and dual-live scenarios.
//
// Run: node scripts/dev/ux-screens.mjs   (Node 22, after `nvm use 22`)
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const BASE = process.env.UX_BASE || "http://localhost:3001";
const OUT = path.resolve(fileURLToPath(import.meta.url), "../../../ux-audit/screenshots");
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { id: "desktop-1920x1080", width: 1920, height: 1080 },
  { id: "tablet-768x1024", width: 768, height: 1024 },
  { id: "mobile-390x844", width: 390, height: 844 },
];

const TABS = [
  { key: "live", label: "Ao vivo" },
  { key: "matches", label: "Jogos" },
  { key: "groups", label: "Grupos" },
  { key: "results", label: "Result." },
  { key: "bracket", label: "Chaves" },
  { key: "ai", label: "AI" },
];

// ---- time helpers (relative to real now so the live/concurrency logic fires) --
const now = Date.now();
const iso = (msFromNow) => new Date(now + msFromNow).toISOString().replace(/\.\d{3}Z$/, "Z");
const MIN = 60_000, HR = 60 * MIN, DAY = 24 * HR;

const logo = (code) => `https://a.espncdn.com/i/teamlogos/countries/500/${code}.png`;
const team = (id, name, abbr, code) => ({ id, displayName: name, abbreviation: abbr, logo: logo(code) });

// ---- ESPN scoreboard mock builders ------------------------------------------
function event({ id, date, name, shortName, state, clock, city, home, away, hs, as, details }) {
  const status = state === "in"
    ? { displayClock: clock, type: { state: "in", detail: clock, shortDetail: clock } }
    : state === "post"
      ? { type: { state: "post", detail: "Full Time", shortDetail: "FT" } }
      : { type: { state: "pre", detail: name, shortDetail: "Em breve" } };
  return {
    id, date, name, shortName, status,
    competitions: [{
      id, venue: { address: { city } },
      competitors: [
        { homeAway: "home", score: String(hs ?? 0), team: home },
        { homeAway: "away", score: String(as ?? 0), team: away },
      ],
      ...(details ? { details } : {}),
    }],
  };
}

const BRA = team("205", "Brazil", "BRA", "bra");
const ARG = team("202", "Argentina", "ARG", "arg");
const FRA = team("478", "France", "FRA", "fra");
const GER = team("503", "Germany", "GER", "ger");
const ESP = team("164", "Spain", "ESP", "esp");
const POR = team("382", "Portugal", "POR", "por");
const ENG = team("448", "England", "ENG", "eng");
const NED = team("449", "Netherlands", "NED", "ned");

// single live: one in-progress match (kicked off ~50 min ago), plus a few
// upcoming on later days so they don't pair with the live one.
function scoreboardSingleLive() {
  return { leagues: [{ id: "606", slug: "fifa.world" }], events: [
    event({ id: "9001", date: iso(-50 * MIN), name: "Argentina at Brazil", shortName: "ARG @ BRA",
      state: "in", clock: "58'", city: "Rio de Janeiro", home: BRA, away: ARG, hs: 2, as: 1,
      details: [
        { scoringPlay: true, clock: { displayValue: "12'" }, type: { text: "Goal" }, team: { id: "205" }, athletesInvolved: [{ displayName: "Vinícius Jr" }] },
        { scoringPlay: true, clock: { displayValue: "34'" }, type: { text: "Penalty - Scored" }, penaltyKick: true, team: { id: "202" }, athletesInvolved: [{ displayName: "Messi" }] },
        { scoringPlay: true, clock: { displayValue: "51'" }, type: { text: "Goal - Header" }, team: { id: "205" }, athletesInvolved: [{ displayName: "Rodrygo" }] },
        { scoringPlay: false, clock: { displayValue: "44'" }, type: { text: "Yellow Card" }, yellowCard: true, team: { id: "202" }, athletesInvolved: [{ displayName: "De Paul" }] },
      ] }),
    event({ id: "9101", date: iso(2 * DAY), name: "France at Spain", shortName: "FRA @ ESP", state: "pre", city: "Madrid", home: ESP, away: FRA }),
    event({ id: "9102", date: iso(3 * DAY), name: "England at Germany", shortName: "ENG @ GER", state: "pre", city: "Munich", home: GER, away: ENG }),
    event({ id: "9103", date: iso(4 * DAY), name: "Portugal at Netherlands", shortName: "POR @ NED", state: "pre", city: "Amsterdam", home: NED, away: POR }),
  ] };
}

// dual live: two matches kicking off at the SAME time (~45 min ago), both live.
function scoreboardDualLive() {
  const ko = iso(-45 * MIN);
  return { leagues: [{ id: "606", slug: "fifa.world" }], events: [
    event({ id: "9201", date: ko, name: "Argentina at Brazil", shortName: "ARG @ BRA",
      state: "in", clock: "52'", city: "Rio de Janeiro", home: BRA, away: ARG, hs: 1, as: 1,
      details: [
        { scoringPlay: true, clock: { displayValue: "9'" }, type: { text: "Goal" }, team: { id: "205" }, athletesInvolved: [{ displayName: "Vinícius Jr" }] },
        { scoringPlay: true, clock: { displayValue: "38'" }, type: { text: "Goal" }, team: { id: "202" }, athletesInvolved: [{ displayName: "Álvarez" }] },
      ] }),
    event({ id: "9202", date: ko, name: "France at Spain", shortName: "FRA @ ESP",
      state: "in", clock: "52'", city: "Madrid", home: ESP, away: FRA, hs: 0, as: 2,
      details: [
        { scoringPlay: true, clock: { displayValue: "21'" }, type: { text: "Goal" }, team: { id: "478" }, athletesInvolved: [{ displayName: "Mbappé" }] },
        { scoringPlay: true, clock: { displayValue: "47'" }, type: { text: "Penalty - Scored" }, penaltyKick: true, team: { id: "478" }, athletesInvolved: [{ displayName: "Mbappé" }] },
      ] }),
    event({ id: "9203", date: iso(2 * DAY), name: "England at Germany", shortName: "ENG @ GER", state: "pre", city: "Munich", home: GER, away: ENG }),
  ] };
}

// pre-match: the next match kicks off in ~2h (so the palpite form shows), plus
// context fixtures.
function scoreboardPreMatch() {
  return { leagues: [{ id: "606", slug: "fifa.world" }], events: [
    event({ id: "9301", date: iso(2 * HR), name: "Argentina at Brazil", shortName: "ARG @ BRA", state: "pre", city: "Rio de Janeiro", home: BRA, away: ARG }),
    event({ id: "9302", date: iso(1 * DAY), name: "France at Spain", shortName: "FRA @ ESP", state: "pre", city: "Madrid", home: ESP, away: FRA }),
    event({ id: "9303", date: iso(2 * DAY), name: "England at Germany", shortName: "ENG @ GER", state: "pre", city: "Munich", home: GER, away: ENG }),
  ] };
}

// ---- Supabase mocks ---------------------------------------------------------
const MY_NAME = "Allan";
function entryRow(match_id, username, ph, pa, agoMin) {
  return { match_id, league: "fifa.world", username, pred_home: ph, pred_away: pa, created_at: iso(-agoMin * MIN) };
}
// predictions for the featured match in each scenario.
const ENTRY_SETS = {
  single: "9001", dual: "9201", pre: "9301",
};
function entriesFor(matchId, includeMe) {
  const base = [
    entryRow(matchId, "Bot do Baltta", 2, 1, 600),
    entryRow(matchId, "Carlos", 3, 0, 240),
    entryRow(matchId, "Mariana", 1, 1, 180),
    entryRow(matchId, "Pedrinho", 2, 2, 120),
    entryRow(matchId, "Júlia", 0, 1, 90),
    entryRow(matchId, "Rafa", 2, 1, 60),
  ];
  if (includeMe) base.unshift(entryRow(matchId, MY_NAME, 2, 1, 5));
  return base;
}
function countsAll() {
  return [
    { match_id: "9001", votes: 47 }, { match_id: "9201", votes: 33 }, { match_id: "9202", votes: 29 },
    { match_id: "9301", votes: 12 }, { match_id: "9101", votes: 4 }, { match_id: "9302", votes: 6 },
  ];
}

function json(route, body, status = 200) {
  return route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(body) });
}

// Install routing for a scenario. `scoreboard` null => real ESPN (real run).
// `featuredMatch`/`includeMe` drive the Supabase entry feed.
async function installRoutes(context, { scoreboard, featuredMatch, includeMe }) {
  await context.route("**://site.api.espn.com/**", (route) => {
    const url = route.request().url();
    if (scoreboard && url.includes("/scoreboard")) return json(route, scoreboard);
    return route.continue(); // standings + summary -> real ESPN
  });
  await context.route("**://mock.supabase.co/**", (route) => {
    const url = route.request().url();
    if (url.includes("/functions/v1/cast-vote")) return json(route, { ok: true }, 201);
    if (url.includes("vote_match_counts")) return json(route, countsAll());
    if (url.includes("vote_entries")) {
      if (!featuredMatch) return json(route, []);
      // crude match_id filter for the per-match feed
      const m = url.match(/match_id=eq\.([^&]+)/);
      const id = m ? decodeURIComponent(m[1]) : featuredMatch;
      return json(route, entriesFor(id, includeMe).map((r) => ({ ...r, match_id: id })));
    }
    return json(route, []);
  });
}

async function shoot(page, name) {
  await page.screenshot({ path: path.join(OUT, `${name}__fold.png`) });
  await page.screenshot({ path: path.join(OUT, `${name}__full.png`), fullPage: true });
  process.stdout.write(`  · ${name}\n`);
}

async function gotoTab(page, label) {
  // header offset: scroll top first, then click the bottom-bar button
  await page.evaluate(() => window.scrollTo(0, 0));
  const btn = page.locator(`button[aria-label="${label}"]`).first();
  await btn.click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(900);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
}

async function newPage(browser, vp, seedName) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });
  await context.addInitScript((n) => {
    try {
      localStorage.setItem("baltfut_token", "ux-demo-token");
      if (n) localStorage.setItem("baltfut_name", n);
    } catch {}
  }, seedName || "");
  const page = await context.newPage();
  return { context, page };
}

async function run() {
  const browser = await chromium.launch();
  try {
    // 1) REAL scenario — every tab, every viewport (authentic mid-tournament data)
    console.log("[real] all tabs");
    for (const vp of VIEWPORTS) {
      const { context, page } = await newPage(browser, vp, null);
      await installRoutes(context, { scoreboard: null, featuredMatch: null, includeMe: false });
      await page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
      await page.waitForTimeout(2500);
      for (const tab of TABS) {
        await gotoTab(page, tab.label);
        await shoot(page, `real__${tab.key}__${vp.id}`);
      }
      await context.close();
    }

    // 2) Scenario runs — live tab only (that's where each scenario lives)
    const scenarios = [
      { id: "prematch", build: scoreboardPreMatch, featured: ENTRY_SETS.pre },
      { id: "live-single", build: scoreboardSingleLive, featured: ENTRY_SETS.single },
      { id: "live-duo", build: scoreboardDualLive, featured: ENTRY_SETS.dual },
    ];
    for (const sc of scenarios) {
      console.log(`[${sc.id}] live tab`);
      for (const vp of VIEWPORTS) {
        const { context, page } = await newPage(browser, vp, MY_NAME);
        await installRoutes(context, { scoreboard: sc.build(), featuredMatch: sc.featured, includeMe: true });
        await page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
        await page.waitForTimeout(2800);
        await gotoTab(page, "Ao vivo");
        await shoot(page, `${sc.id}__live__${vp.id}`);
        await context.close();
      }
    }

    // 3) Palpite FORM interaction states (pre-match), desktop + mobile.
    //    a) empty form (fresh visitor, no saved name)
    //    b) filled form
    //    c) after submit -> "VOCÊ" row in the table
    console.log("[palpite-flow] form states");
    for (const vp of [VIEWPORTS[0], VIEWPORTS[2]]) {
      // a + b: fresh visitor (no saved name) so the name field is editable/empty
      const { context, page } = await newPage(browser, vp, null);
      await installRoutes(context, { scoreboard: scoreboardPreMatch(), featuredMatch: ENTRY_SETS.pre, includeMe: false });
      await page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
      await page.waitForTimeout(2500);
      await gotoTab(page, "Ao vivo");
      await shoot(page, `palpite__form-empty__${vp.id}`);
      // fill name
      const nameInput = page.locator('input[type="text"], input:not([type])').first();
      await nameInput.fill(MY_NAME).catch(() => {});
      // bump the home score a couple times via the "+" stepper
      const plus = page.locator('button[aria-label^="Mais"]').first();
      await plus.click().catch(() => {});
      await plus.click().catch(() => {});
      const plusAway = page.locator('button[aria-label^="Mais"]').nth(1);
      await plusAway.click().catch(() => {});
      await page.waitForTimeout(400);
      await shoot(page, `palpite__form-filled__${vp.id}`);
      await context.close();

      // c: returning visitor (saved name) whose palpite is in the feed -> VOCÊ tag
      const r = await newPage(browser, vp, MY_NAME);
      await installRoutes(r.context, { scoreboard: scoreboardPreMatch(), featuredMatch: ENTRY_SETS.pre, includeMe: true });
      await r.page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
      await r.page.waitForTimeout(2500);
      await gotoTab(r.page, "Ao vivo");
      await shoot(r.page, `palpite__after-submit-voce__${vp.id}`);
      await r.context.close();
    }

    console.log("DONE ->", OUT);
  } finally {
    await browser.close();
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
