#!/usr/bin/env node

/**
 * data-semantic CLI
 *
 * Usage:
 *   data-semantic build -t template.html -d data.json -o out.html
 *   data-semantic check -t template.html [-d data.json]
 *   data-semantic inspect -t template.html
 */
import { Command } from 'commander';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compile, check, inspect } from './core.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'));

const program = new Command();
program
  .name('data-semantic')
  .description('data-semantic template compiler and validator')
  .version(pkg.version);

// ── build ────────────────────────────────────────────────────────
program
  .command('build')
  .description('Compile template + data into final HTML')
  .requiredOption('-t, --template <path>', 'HTML template file')
  .requiredOption('-d, --data <path>', 'JSON data file')
  .option('-o, --output <path>', 'Output HTML file (default: stdout)')
  .option('--keep-data-attrs', 'Keep data-semantic attributes in output')
  .action((opts) => {
    try {
      const template = readFileSync(resolve(opts.template), 'utf-8');
      const data = JSON.parse(readFileSync(resolve(opts.data), 'utf-8'));
      const result = compile(template, data, {
        removeDataAttrs: !opts.keepDataAttrs
      });
      if (opts.output) {
        writeFileSync(resolve(opts.output), result, 'utf-8');
        console.log(`✓ Compiled → ${opts.output}`);
      } else {
        process.stdout.write(result);
      }
    } catch (err) {
      console.error(`✗ Build failed: ${err.message}`);
      process.exit(1);
    }
  });

// ── check ────────────────────────────────────────────────────────
program
  .command('check')
  .description('Validate template and optionally check data completeness')
  .requiredOption('-t, --template <path>', 'HTML template file')
  .option('-d, --data <path>', 'JSON data file for completeness check')
  .action((opts) => {
    try {
      const template = readFileSync(resolve(opts.template), 'utf-8');
      let data = null;
      if (opts.data) {
        data = JSON.parse(readFileSync(resolve(opts.data), 'utf-8'));
      }
      const result = check(template, data);

      if (result.errors.length > 0) {
        console.error('Errors:');
        for (const e of result.errors) {
          console.error(`  ✗ [${e.type}] ${e.message} (${e.selector})`);
        }
      }
      if (result.warnings.length > 0) {
        console.warn('Warnings:');
        for (const w of result.warnings) {
          console.warn(`  ⚠ [${w.type}] ${w.message} (${w.selector})`);
        }
      }
      if (result.valid) {
        console.log(`✓ Template is valid (${result.warnings.length} warnings)`);
      } else {
        console.error(`✗ Template has ${result.errors.length} error(s)`);
        process.exit(1);
      }
    } catch (err) {
      console.error(`✗ Check failed: ${err.message}`);
      process.exit(1);
    }
  });

// ── inspect ──────────────────────────────────────────────────────
program
  .command('inspect')
  .description('Inspect template and output semantic structure as JSON')
  .requiredOption('-t, --template <path>', 'HTML template file')
  .option('-o, --output <path>', 'Output JSON file (default: stdout)')
  .action((opts) => {
    try {
      const template = readFileSync(resolve(opts.template), 'utf-8');
      const result = inspect(template);
      const json = JSON.stringify(result, null, 2);
      if (opts.output) {
        writeFileSync(resolve(opts.output), json, 'utf-8');
        console.log(`✓ Inspected → ${opts.output}`);
      } else {
        process.stdout.write(json);
      }
    } catch (err) {
      console.error(`✗ Inspect failed: ${err.message}`);
      process.exit(1);
    }
  });

program.parse();
