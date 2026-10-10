// Vérifie automatiquement les règles « mécaniques » du brief Arena AI.
// Usage : node tests/verifier-brief.mjs   (aucune dépendance, aucun réseau)
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(root, f), 'utf8');
let fails = 0;
const ok = (c, msg) => { if (!c) fails++; console.log((c ? '  ✓ ' : '  ✗ ') + msg); };

const html = read('index.html'), js = read('jeu.js');
const meta = JSON.parse(read('random.json'));
const SLUG = 'aim-trainer';

console.log('Fichiers');
const files = [];
(function walk(d) { for (const n of readdirSync(d)) { if (n === '.git' || n === 'node_modules') continue; const p = join(d, n); statSync(p).isDirectory() ? walk(p) : files.push(p); } })(root);
const size = files.reduce((a, f) => a + statSync(f).size, 0);
ok(size < 80 * 1024 * 1024, 'poids total < 80 Mo (' + (size / 1048576).toFixed(2) + ' Mo)');
const okExt = ['.html', '.js', '.mjs', '.css', '.json', '.wasm', '.md', '.txt', ''];
ok(files.every((f) => okExt.includes(extname(f))), 'extensions standard uniquement');
ok(!files.some((f) => /random-manifest\.json$/.test(f)), 'pas de random-manifest.json (réservé)');
ok(!files.some((f) => /(^|\/)src\//.test(f.slice(root.length))), 'pas de dossier src/');
ok(!/\.(jsx|tsx|ts)$/.test(files.join('\n')), 'pas de JSX / TypeScript');

console.log('index.html');
ok(/<html[^>]*lang="fr"/.test(html), 'lang="fr"');
ok(/<meta charset=/i.test(html), 'charset');
ok(/name="viewport"/.test(html), 'viewport');
const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1];
ok(title === meta.titre, 'titre identique dans <title> et random.json (' + title + ')');
ok(/<h1[^>]*>[\s\S]*?<\/h1>/.test(html) && html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').includes('Aim Trainer 3D'), 'même titre affiché à l\'écran');
ok(/name="description" content="[^"]{10,}"/.test(html), 'meta description');
ok(/name="robots" content="noindex/.test(html), 'robots noindex');
ok(/name="theme-color"/.test(html), 'theme-color');
ok(html.includes('<link rel="canonical" href="https://random.plagnito.com/a/' + SLUG + '/"'), 'canonical');
ok(html.includes('property="og:url" content="https://random.plagnito.com/a/' + SLUG + '/"'), 'og:url');
ok(['og:type', 'og:title', 'og:description'].every((p) => html.includes('property="' + p + '"')), 'og:type / og:title / og:description');
ok(/rel="icon" href="data:image\//.test(html), 'favicon emoji en data-URI');
const desc = (html.match(/name="description" content="([^"]*)"/) || [])[1];
ok(desc === meta.description, 'description identique dans le head et random.json');
const refs = [...html.matchAll(/(?:src|href)="([^"#][^"]*)"/g)].map((m) => m[1]).filter((u) => !/^(data:|https?:|mailto:)/.test(u) || u.startsWith('/'));
ok(refs.every((u) => !u.startsWith('/')), 'chemins relatifs (aucun « / » initial) : ' + refs.join(', '));
ok(!/target="_top"/.test(html), 'pas de target="_top"');

console.log('random.json');
ok(meta.titre.length <= 60, 'titre ≤ 60 (' + meta.titre.length + ')');
ok(meta.description.length <= 240, 'description ≤ 240 (' + meta.description.length + ')');
ok([...meta.emoji].length <= 2, 'emoji ≤ 2 caractères');
ok(/^#[0-9a-f]{6}$/i.test(meta.couleur), 'couleur #rrggbb');
ok(Array.isArray(meta.tags) && meta.tags.length <= 4 && meta.tags.every((t) => t.length <= 20), 'tags ≤ 4, ≤ 20 caractères');
const cap = meta.capacites || {};
ok(!!cap && typeof cap === 'object', 'bloc capacites présent');
ok(!('partie' in cap), 'capacité « partie » non déclarée');
const succ = cap.succes || [];
ok(succ.length <= 60, 'succès ≤ 60 (' + succ.length + ')');
ok(succ.every((s) => /^[a-z0-9_-]+$/.test(s.id) && s.titre.length <= 48 && s.texte.length <= 120), 'succès : id valide, titre ≤ 48, texte ≤ 120');
ok(new Set(succ.map((s) => s.id)).size === succ.length, 'ids de succès uniques');
const accBlock = (js.match(/const ACH = \[([\s\S]*?)\]\.map/) || [])[1] || '';
const jsIds = [...accBlock.matchAll(/^\s*\['([a-z0-9_-]+)'/gm)].map((m) => m[1]);
ok(jsIds.length === succ.length && jsIds.every((i) => succ.some((s) => s.id === i)), 'succès du code = succès de random.json (' + jsIds.length + ')');
const used = [...js.matchAll(/unlock\('([a-z0-9_-]+)'\)/g)].map((m) => m[1]);
ok(used.every((i) => jsIds.includes(i)), 'chaque unlock() utilise un succès déclaré');
ok(jsIds.every((i) => used.includes(i)), 'chaque succès déclaré est débloqué quelque part');
ok(!!cap.classement && /atlasJeu|soumettreScore/.test(js) && js.includes('soumettreScore'), 'classement déclaré ET utilisé');
ok(js.includes('SDK.identite') || js.includes('identite'), 'identité déclarée ET utilisée');

console.log('jeu.js : interdits');
const bad = [
  [/\bfetch\s*\(/, 'fetch()'], [/XMLHttpRequest/, 'XMLHttpRequest'], [/WebSocket/, 'WebSocket'], [/indexedDB/, 'indexedDB'],
  [/serviceWorker/, 'service worker'], [/window\.top|window\.parent|\bparent\./, 'window.top / parent'], [/postMessage/, 'postMessage'],
  [/\bconfirm\s*\(|\balert\s*\(|\bprompt\s*\(/, 'confirm / alert / prompt'], [/document\.cookie/, 'cookies'],
  [/location\.hash|hashchange/, 'routage par #fragment'], [/location\.href\s*=|location\.assign|location\.replace/, 'changement de page'],
  [/requestFullscreen/, 'plein écran'], [/\beval\s*\(|new Function/, 'eval'], [/google-analytics|gtag|plausible|sentry|mixpanel/i, 'traceurs'],
  [/api[_-]?key|openai|anthropic/i, 'clés d\'API / IA'],
];
bad.forEach(([re, n]) => ok(!re.test(js) && !re.test(html.replace(/<style[\s\S]*?<\/style>/, '')), 'aucun usage de ' + n));
ok(!/import\s+.*from|<script[^>]*type="module"/.test(js + html), 'pas de module ES');
ok(/window\.atlasJeu/.test(js) && !/atlasJeu\.[a-z]/.test(js), 'atlasJeu lu une seule fois, via une constante');
const lsLines = js.split('\n').filter((l) => l.includes('localStorage'));
ok(lsLines.length > 0 && lsLines.every((l) => l.includes('try')), 'localStorage utilisé, toujours dans un try/catch (' + lsLines.length + ' accès)');
ok(/addEventListener\('resize'/.test(js), 'gestion de resize');
ok(/aria-label/.test(html) && /<button/.test(html), 'vrais <button> avec aria-label');
ok(!/<div[^>]*onclick=/.test(html), 'pas de div cliquable');

console.log(fails ? '\n' + fails + ' vérification(s) en échec' : '\nToutes les vérifications passent ✓');
process.exit(fails ? 1 : 0);
