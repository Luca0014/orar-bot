// Verifica pagina de orare IIRMP si anunta pe WhatsApp cand se schimba orarul.
// Rulare: node check.mjs          (verificare normala)
//         node check.mjs --test   (trimite orarul curent, ca sa testezi notificarea)
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { notify } from './notify.mjs';

const PAGE_URL = 'https://iirmp.utcluj.ro/orar.html';
const YEAR_LABEL = /^Anul I\s*:/; // randul din lista "Licenta, Cluj-Napoca"
const LINK_TEXT = 'RI';
const FALLBACK_HREF = /An_I_RI[^"]*\.pdf/i;
const STATE_FILE = new URL('./state.json', import.meta.url);
const HEADERS = { 'User-Agent': 'orar-bot (verificare orar student)' };
const HEARTBEAT_MS = 7 * 24 * 3600 * 1000;

const stripTags = (s) => s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();

function findTimetableUrl(html) {
  for (const [, li] of html.matchAll(/<li>([\s\S]*?)<\/li>/g)) {
    if (!YEAR_LABEL.test(stripTags(li))) continue;
    for (const [, href, text] of li.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
      if (stripTags(text) === LINK_TEXT) return new URL(href, PAGE_URL).href;
    }
  }
  const fallback = html.match(new RegExp(`href="([^"]*${FALLBACK_HREF.source})"`, 'i'));
  if (fallback) return new URL(fallback[1], PAGE_URL).href;
  throw new Error('Nu am gasit link-ul "Anul I: RI" pe pagina (s-a schimbat structura paginii?)');
}

async function get(url, init) {
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(30_000), ...init });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} la ${url}`);
  return res;
}

async function loadState() {
  try {
    return JSON.parse(await readFile(STATE_FILE, 'utf8'));
  } catch {
    return null;
  }
}

const saveState = (state) => writeFile(STATE_FILE, JSON.stringify(state, null, 2) + '\n');

async function main() {
  const test = process.argv.includes('--test');
  const prev = await loadState();

  const html = await (await get(PAGE_URL)).text();
  const url = findTimetableUrl(html);

  // HEAD e ieftin: descarcam PDF-ul doar daca s-a schimbat ceva.
  const head = await get(url, { method: 'HEAD' });
  const etag = head.headers.get('etag');
  const lastModified = head.headers.get('last-modified');
  const unchanged = prev && prev.url === url && etag && prev.etag === etag;
  if (unchanged && !test) {
    console.log(`${new Date().toISOString()} fara schimbari`);
    // Un commit pe saptamana tine repo-ul "activ": GitHub opreste workflow-urile
    // programate dupa 60 de zile fara activitate.
    if (Date.now() - Date.parse(prev.checkedAt) > HEARTBEAT_MS) {
      await saveState({ ...prev, checkedAt: new Date().toISOString() });
    }
    return;
  }

  const pdf = Buffer.from(await (await get(url)).arrayBuffer());
  const sha256 = createHash('sha256').update(pdf).digest('hex');
  const state = { url, etag, lastModified, sha256, checkedAt: new Date().toISOString() };
  const fileName = decodeURIComponent(url.split('/').pop());

  if (test) {
    await notify({ title: 'Test: orarul curent', fileName, url, pdf });
    console.log('mesaj de test trimis');
  } else if (!prev) {
    console.log(`prima rulare, retin orarul curent: ${fileName}`);
  } else if (prev.url !== url || prev.sha256 !== sha256) {
    const title = prev.url !== url ? 'S-a publicat un orar nou' : 'Orarul a fost modificat';
    await notify({ title, fileName, url, pdf });
    console.log(`notificare trimisa: ${fileName}`);
  } else {
    console.log('etag schimbat, dar continutul e identic');
  }
  // Salvam abia dupa ce notificarea a reusit, ca la esec sa reincerce data viitoare.
  await saveState(state);
}

main().catch((err) => {
  console.error(`${new Date().toISOString()} EROARE: ${err.message}`);
  process.exit(1);
});
