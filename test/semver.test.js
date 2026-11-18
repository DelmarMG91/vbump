import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, format, compare, inc } from '../src/semver.js';

test('parse accepts a simple version', () => {
  const v = parse('1.2.3');
  assert.equal(v.major, 1);
  assert.equal(v.minor, 2);
  assert.equal(v.patch, 3);
  assert.deepEqual(v.prerelease, []);
  assert.deepEqual(v.build, []);
});

test('parse accepts prerelease and build metadata', () => {
  const v = parse('2.0.0-alpha.1+build.5');
  assert.deepEqual(v.prerelease, ['alpha', '1']);
  assert.deepEqual(v.build, ['build', '5']);
});

test('parse rejects leading zeros and malformed versions', () => {
  assert.equal(parse('01.2.3'), null);
  assert.equal(parse('1.2'), null);
  assert.equal(parse('1.2.3-'), null);
  assert.equal(parse('not-a-version'), null);
});

test('format renders prerelease and build parts', () => {
  const v = parse('1.2.3-rc.2+sha.abc');
  assert.equal(format(v), '1.2.3-rc.2+sha.abc');
});

test('compare orders major, minor and patch numerically', () => {
  assert.equal(compare('2.0.0', '1.9.9'), 1);
  assert.equal(compare('1.3.0', '1.2.9'), 1);
  assert.equal(compare('1.2.4', '1.2.3'), 1);
  assert.equal(compare('1.2.3', '1.2.3'), 0);
});

test('compare applies SemVer prerelease precedence chain', () => {
  const ordered = [
    '1.0.0-alpha',
    '1.0.0-alpha.1',
    '1.0.0-alpha.beta',
    '1.0.0-beta',
    '1.0.0-beta.2',
    '1.0.0-beta.11',
    '1.0.0-rc.1',
    '1.0.0',
  ];
  for (let i = 1; i < ordered.length; i++) {
    assert.equal(compare(ordered[i - 1], ordered[i]), -1, `${ordered[i - 1]} < ${ordered[i]}`);
  }
});

test('compare treats numeric identifiers as lower than alphanumeric ones', () => {
  assert.equal(compare('1.0.0-1', '1.0.0-alpha'), -1);
  assert.equal(compare('1.0.0-1', '1.0.0-2'), -1);
});

test('compare ignores build metadata', () => {
  assert.equal(compare('1.2.3+build.1', '1.2.3+build.99'), 0);
});

test('compare throws on invalid input', () => {
  assert.throws(() => compare('1.0', '1.0.0'), TypeError);
});

test('inc major resets minor and patch and clears prerelease', () => {
  assert.equal(inc('1.2.3', 'major'), '2.0.0');
  assert.equal(inc('1.2.3-beta.4+build.7', 'major'), '2.0.0');
});

test('inc minor resets patch', () => {
  assert.equal(inc('1.2.3', 'minor'), '1.3.0');
});

test('inc patch increments patch', () => {
  assert.equal(inc('1.2.3', 'patch'), '1.2.4');
});

test('inc premajor starts a prerelease after a major bump', () => {
  assert.equal(inc('1.2.3', 'premajor', 'beta'), '2.0.0-beta.0');
  assert.equal(inc('1.2.3', 'premajor'), '2.0.0-0');
});

test('inc preminor starts a prerelease after a minor bump', () => {
  assert.equal(inc('1.2.3', 'preminor', 'rc'), '1.3.0-rc.0');
});

test('inc prepatch starts a prerelease after a patch bump', () => {
  assert.equal(inc('1.2.3', 'prepatch', 'beta'), '1.2.4-beta.0');
});

test('inc prerelease increments an existing numeric identifier', () => {
  assert.equal(inc('1.2.3-beta.0', 'prerelease', 'beta'), '1.2.3-beta.1');
  assert.equal(inc('1.2.3-beta.9', 'prerelease'), '1.2.3-beta.10');
});

test('inc prerelease starts from preid.0 when no prerelease exists', () => {
  assert.equal(inc('1.2.3', 'prerelease', 'beta'), '1.2.3-beta.0');
});

test('inc prerelease appends .0 when the last identifier is not numeric', () => {
  assert.equal(inc('1.2.3-beta', 'prerelease'), '1.2.3-beta.0');
});

test('inc prerelease switches preid and resets the counter', () => {
  assert.equal(inc('1.2.3-beta.2', 'prerelease', 'alpha'), '1.2.3-alpha.0');
});

test('inc drops build metadata on a real bump but preserves it for none', () => {
  assert.equal(inc('1.2.3+build.7', 'patch'), '1.2.4');
  assert.equal(inc('1.2.3+build.7', 'none'), '1.2.3+build.7');
});

test('inc none keeps the version unchanged', () => {
  assert.equal(inc('1.2.3', 'none'), '1.2.3');
});

test('inc throws for unknown release types and invalid versions', () => {
  assert.throws(() => inc('1.2.3', 'gigantic'), TypeError);
  assert.throws(() => inc('1.2', 'patch'), TypeError);
});
