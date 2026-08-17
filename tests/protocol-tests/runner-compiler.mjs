#!/usr/bin/env node

/**
 * Conformance test runner — Compiler
 * Executes all test cases using the compiler's compile() function.
 * Compares compiled output against expected.html.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CASES_DIR = resolve(__dirname, 'cases');

// Import compiler (use file:// URL for Windows ESM compat)
const { compile } = await import(pathToFileURL(join(__dirname, '../../compiler/src/core.js')).href);

let pass = 0;
let fail = 0;

function getCases() {
  return readdirSync(CASES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

function normalizeHtml(html) {
  return html
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

  try {
    const actual = normalizeHtml(compile(template, data));
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
  } catch (err) {
    console.error(`  ✗ ${caseName} — thrown: ${err.message}`);
    fail++;
  }
}

console.log(`\nConformance Tests — Compiler (${getCases().length} cases)\n`);

for (const caseName of getCases()) {
  runCase(caseName);
}

console.log(`\nResults: ${pass} passed, ${fail} failed, ${pass + fail} total\n`);
process.exit(fail > 0 ? 1 : 0);
