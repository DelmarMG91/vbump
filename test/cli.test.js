import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BIN = fileURLToPath(new URL('../bin/vbump.js', import.meta.url));

/**
 * Run the CLI in a temporary working directory.
 * @param {string[]} args
 * @param {string} cwd
 */
function run(args, cwd) {
  return spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: 'utf8' });
}

/**
 * Create a temp directory containing a package.json fixture.
 * @param {string} version
 * @param {number} indent
 * @returns {{dir:string, file:string}}
 */
function fixture(version, indent = 2) {
  const dir = mkdtempSync(join(tmpdir(), 'vbump-'));
  const file = join(dir, 'package.json');
  const body = JSON.stringify({ name: 'sample', version }, null, indent) + '\n';
  writeFileSync(file, body);
  return { dir, file };
}

test('dry-run prints the next version without touching the file', () => {
  const { dir, file } = fixture('1.2.3');
  try {
    const result = run(['patch', '--dry-run'], dir);
    assert.equal(result.status, 0);
    assert.equal(result.stdout, 'v1.2.4\n');
    assert.equal(JSON.parse(readFileSync(file, 'utf8')).version, '1.2.3');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('writes back with 2-space indentation and a trailing newline', () => {
  const { dir, file } = fixture('1.2.3', 2);
  try {
    const result = run(['minor'], dir);
    assert.equal(result.status, 0);
    const text = readFileSync(file, 'utf8');
    assert.match(text, /\n  "version": "1.3.0"/);
    assert.ok(text.endsWith('\n'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('preserves 4-space indentation', () => {
  const { dir, file } = fixture('1.2.3', 4);
  try {
    const result = run(['major'], dir);
    assert.equal(result.status, 0);
    const text = readFileSync(file, 'utf8');
    assert.match(text, /\n    "version": "2.0.0"/);
    assert.doesNotMatch(text, /\n  "version"/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('--json emits oldVersion, newVersion and changed', () => {
  const { dir } = fixture('1.2.3');
  try {
    const result = run(['minor', '--json'], dir);
    assert.equal(result.status, 0);
    assert.deepEqual(JSON.parse(result.stdout), {
      oldVersion: '1.2.3',
      newVersion: '1.3.0',
      changed: true,
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('none reports no change and leaves the version intact', () => {
  const { dir, file } = fixture('1.2.3');
  try {
    const result = run(['none', '--json'], dir);
    assert.equal(result.status, 0);
    assert.deepEqual(JSON.parse(result.stdout), {
      oldVersion: '1.2.3',
      newVersion: '1.2.3',
      changed: false,
    });
    assert.equal(JSON.parse(readFileSync(file, 'utf8')).version, '1.2.3');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('respects --file and --preid', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vbump-'));
  const file = join(dir, 'manifest.json');
  writeFileSync(file, JSON.stringify({ version: '3.1.4' }, null, 2) + '\n');
  try {
    const result = run(['preminor', '--file', 'manifest.json', '--preid', 'beta'], dir);
    assert.equal(result.status, 0);
    assert.equal(result.stdout, 'v3.2.0-beta.0\n');
    assert.equal(JSON.parse(readFileSync(file, 'utf8')).version, '3.2.0-beta.0');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('--version prints the package version', () => {
  const result = run(['--version'], process.cwd());
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), '0.1.0');
});

test('--help documents the release types and options', () => {
  const result = run(['--help'], process.cwd());
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage:/);
  assert.match(result.stdout, /prerelease/);
  assert.match(result.stdout, /--preid/);
});

test('unknown release type exits with code 2', () => {
  const { dir } = fixture('1.2.3');
  try {
    const result = run(['gigantic'], dir);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /unknown release type/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('missing package.json exits with code 1', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vbump-'));
  try {
    const result = run(['patch'], dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /cannot read/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
