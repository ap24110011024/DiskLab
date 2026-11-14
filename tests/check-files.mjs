/*
 * Static checks for broken links and wiring (Node.js 18+):
 *     node tests/check-files.mjs
 *  - every relative import exists and every imported name is exported
 *  - every local src / href in the HTML pages and url() in CSS exists
 *  - every element id a page script looks up exists in that page (or is created by a script)
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];

function files(dir, ext) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? files(full, ext) : full.endsWith(ext) ? [full] : [];
  });
}
function exportsOf(file) {
  const src = readFileSync(file, 'utf8');
  const names = new Set([...src.matchAll(/export\s+(?:async\s+)?(?:function|const|let|class)\s+([\w$]+)/g)].map((m) => m[1]));
  for (const m of src.matchAll(/export\s*\{([^}]+)\}/g)) m[1].split(',').forEach((p) => names.add(p.trim().split(/\s+as\s+/).pop()));
  return names;
}

// 1. imports
for (const file of files(join(ROOT, 'js'), '.js')) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(/import\s+(?:\{([^}]*)\}\s+from\s+)?['"](\.[^'"]+)['"]/g)) {
    const target = resolve(dirname(file), m[2]);
    if (!existsSync(target)) { problems.push(`${file}: missing import ${m[2]}`); continue; }
    const exported = exportsOf(target);
    for (const name of (m[1] || '').split(',').map((n) => n.trim().split(/\s+as\s+/)[0]).filter(Boolean)) {
      if (!exported.has(name)) problems.push(`${basename(file)}: "${name}" is not exported by ${m[2]}`);
    }
  }
}

// 2. HTML references and 3. ids used by page scripts
const pages = [join(ROOT, 'index.html'), ...files(join(ROOT, 'pages'), '.html')];
const allJs = files(join(ROOT, 'js'), '.js').map((f) => readFileSync(f, 'utf8')).join('\n');
for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  for (const m of html.matchAll(/(?:src|href)="([^"#?:]+)[^"]*"/g)) {
    if (!existsSync(resolve(dirname(page), m[1]))) problems.push(`${basename(page)}: broken link ${m[1]}`);
  }
  const script = html.match(/src="([^"]*js\/pages\/[^"]+)"/);
  if (!script) { problems.push(`${basename(page)}: no page script`); continue; }
  const js = readFileSync(resolve(dirname(page), script[1]), 'utf8');
  const ids = new Set([...js.matchAll(/(?:\$|getElementById)\(['"`]([\w-]+)['"`]\)/g)].map((m) => m[1]));
  for (const id of ids) {
    const inHtml = html.includes(`id="${id}"`);
    const createdByJs = allJs.includes(`id="${id}"`) || allJs.includes(`id = '${id}'`) || allJs.includes(`.id = '${id}'`);
    if (!inHtml && !createdByJs) problems.push(`${basename(page)}: script uses #${id} but the page has no such element`);
  }
}
for (const css of files(join(ROOT, 'css'), '.css')) {
  for (const m of readFileSync(css, 'utf8').matchAll(/url\('([^']+)'\)/g)) {
    if (!existsSync(resolve(dirname(css), m[1]))) problems.push(`${basename(css)}: missing ${m[1]}`);
  }
}

if (problems.length) { console.log(problems.join('\n')); console.log(`\n${problems.length} problem(s)`); process.exit(1); }
console.log(`OK: imports, links, assets and element ids checked across ${pages.length} pages.`);
