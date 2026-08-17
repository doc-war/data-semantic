#!/usr/bin/env node

/**
 * Conformance test runner — Runtime
 * Executes all test cases using jsdom + DataSemanticRuntime.
 * Compares rendered outerHTML against expected.html.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CASES_DIR = resolve(__dirname, 'cases');

// Import runtime (use file:// URL for Windows ESM compat)
const { DataSemanticRuntime } = await import(pathToFileURL(join(__dirname, '../../runtime/src/index.js')).href);

let pass = 0;
let fail = 0;

function getCases() {
  return readdirSync(CASES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

function normalizeHtml(html) {
  // Strip all data-semantic* attributes (runtime preserves them, but expected output doesn't)
  let cleaned = html.replace(/\s*data-semantic(-[a-z-]+)?="[^"]*"/gi, '');
  // Also strip data-semantic-list
  cleaned = cleaned.replace(/\s*data-semantic-list="[^"]*"/gi, '');
  // Collapse whitespace between tags, trim
  return cleaned
    .replace(/>\s+</g, '><')
    .replace(/\s+/g, ' ')
    .trim();
}

function runCase(caseName) {
  const dir = join(CASES_DIR, caseName);
  const templatePath = join(dir, 'template.html');
  const dataPath = join(dir, 'data.json');
  const expectedPath = join(dir, 'expected.html');

  if (!existsSync(templatePath) || !existsSync(dataPath) || !existsSync(expectedPath)) {
    console.log(`  ⊘ ${caseName} — missing files, skipped`);
    return;
  }

  const template = readFileSync(templatePath, 'utf-8');
  const data = JSON.parse(readFileSync(dataPath, 'utf-8'));
  const expected = readFileSync(expectedPath, 'utf-8');

  const dom = new JSDOM(`<!DOCTYPE html><html><body>${template}</body></html>`);
  const body = dom.window.document.body;

  const rt = new DataSemanticRuntime({ root: body, warnOnMissing: false });
  rt.render(data);

  const actual = normalizeHtml(body.innerHTML);
  const expectedNorm = normalizeHtml(expected);

  if (actual === expectedNorm) {
    console.log(`  ✓ ${caseName}`);
    pass++;
  } else {
    console.error(`  ✗ ${caseName}`);
    console.error(`    Expected: ${expectedNorm}`);
    console.error(`    Actual:   ${actual}`);
    fail++;
  }
}

console.log(`\nConformance Tests — Runtime (${getCases().length} cases)\n`);

for (const caseName of getCases()) {
  runCase(caseName);
}

console.log(`\nResults: ${pass} passed, ${fail} failed, ${pass + fail} total\n`);
process.exit(fail > 0 ? 1 : 0);
