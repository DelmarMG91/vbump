/**
 * SemVer 2.0.0 parser, comparator and incrementer.
 * Pure ESM, zero dependencies. See https://semver.org/spec/v2.0.0.html
 */

// Official SemVer 2.0.0 regular expression (anchored).
const SEMVER_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

const NUMERIC_RE = /^\d+$/;

/**
 * Parse a semantic version string.
 * @param {string} input
 * @returns {{major:number, minor:number, patch:number, prerelease:string[], build:string[], raw:string} | null}
 */
export function parse(input) {
  if (typeof input !== 'string') return null;
  const match = SEMVER_RE.exec(input.trim());
  if (!match) return null;

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ? match[4].split('.') : [],
    build: match[5] ? match[5].split('.') : [],
    raw: input.trim(),
  };
}

/**
 * Render a parsed version object back to a string, dropping empty optional parts.
 * @param {{major:number, minor:number, patch:number, prerelease?:string[], build?:string[]}} v
 * @returns {string}
 */
export function format(v) {
  let out = `${v.major}.${v.minor}.${v.patch}`;
  if (v.prerelease && v.prerelease.length) out += `-${v.prerelease.join('.')}`;
  if (v.build && v.build.length) out += `+${v.build.join('.')}`;
  return out;
}

/**
 * Compare two prerelease identifier arrays per SemVer 2.0.0 precedence rules.
 * Numeric identifiers are compared numerically and are always lower than
 * alphanumeric identifiers; a version with a prerelease is lower than the
 * same core version without one.
 * @param {string[]} a
 * @param {string[]} b
 * @returns {number}
 */
function comparePrerelease(a, b) {
  const aEmpty = a.length === 0;
  const bEmpty = b.length === 0;
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1; // 1.0.0 > 1.0.0-alpha
  if (bEmpty) return -1;

  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const ida = a[i];
    const idb = b[i];
    if (ida === undefined) return -1; // shorter set is lower when prefix-equal
    if (idb === undefined) return 1;
    if (ida === idb) continue;

    const aNum = NUMERIC_RE.test(ida);
    const bNum = NUMERIC_RE.test(idb);
    if (aNum && bNum) {
      const diff = Number(ida) - Number(idb);
      if (diff !== 0) return diff > 0 ? 1 : -1;
      continue;
    }
    if (aNum) return -1; // numeric < alphanumeric
    if (bNum) return 1;
    return ida < idb ? -1 : 1; // lexical ASCII comparison
  }
  return 0;
}

/**
 * Compare two semantic versions. Build metadata is ignored for precedence.
 * @param {string} a
 * @param {string} b
 * @returns {number} -1 | 0 | 1
 * @throws {TypeError} when either input is not a valid version
 */
export function compare(a, b) {
  const va = parse(a);
  const vb = parse(b);
  if (!va) throw new TypeError(`Invalid version: ${a}`);
  if (!vb) throw new TypeError(`Invalid version: ${b}`);

  for (const key of ['major', 'minor', 'patch']) {
    if (va[key] !== vb[key]) return va[key] > vb[key] ? 1 : -1;
  }
  return comparePrerelease(va.prerelease, vb.prerelease);
}

/**
 * Extract the leading identifier of an existing prerelease (e.g. "beta" from
 * ["beta", "2"]) or null when the first identifier is numeric.
 * @param {string[]} prerelease
 * @returns {string | null}
 */
function prereleasePrefix(prerelease) {
  if (!prerelease.length) return null;
  return NUMERIC_RE.test(prerelease[0]) ? null : prerelease[0];
}

/**
 * Increment a version.
 * @param {string} version
 * @param {'major'|'minor'|'patch'|'premajor'|'preminor'|'prepatch'|'prerelease'|'none'} release
 * @param {string} [preid] prerelease identifier (e.g. "beta"); defaults to "0" for new prereleases
 * @returns {string} the resulting version string
 * @throws {TypeError} on an invalid version or unknown release type
 */
export function inc(version, release, preid) {
  const v = parse(version);
  if (!v) throw new TypeError(`Invalid version: ${version}`);

  const preidGiven = preid !== undefined && preid !== null && preid !== '';
  const pid = preidGiven ? String(preid) : '0';

  if (release === 'none') {
    // Preserve the version exactly, including any build metadata.
    return format(v);
  }

  // Any real bump produces a brand-new version, so build metadata is dropped.
  const base = { major: v.major, minor: v.minor, patch: v.patch, prerelease: [], build: [] };

  switch (release) {
    case 'major':
      base.major += 1;
      base.minor = 0;
      base.patch = 0;
      return format(base);
    case 'minor':
      base.minor += 1;
      base.patch = 0;
      return format(base);
    case 'patch':
      base.patch += 1;
      return format(base);
    case 'premajor':
      base.major += 1;
      base.minor = 0;
      base.patch = 0;
      base.prerelease = startPrerelease(pid, preidGiven);
      return format(base);
    case 'preminor':
      base.minor += 1;
      base.patch = 0;
      base.prerelease = startPrerelease(pid, preidGiven);
      return format(base);
    case 'prepatch':
      base.patch += 1;
      base.prerelease = startPrerelease(pid, preidGiven);
      return format(base);
    case 'prerelease':
      return incrementPrerelease(v, pid, preidGiven);
    default:
      throw new TypeError(`Unknown release type: ${release}`);
  }
}

/**
 * Build the initial prerelease identifier list for a pre* bump.
 * With an explicit preid the list is ["<preid>", "0"]; without one it is ["0"].
 * @param {string} pid
 * @param {boolean} preidGiven
 * @returns {string[]}
 */
function startPrerelease(pid, preidGiven) {
  return preidGiven ? [pid, '0'] : ['0'];
}

/**
 * Increment an existing prerelease, or start a new one on the same core version.
 * @param {{major:number, minor:number, patch:number, prerelease:string[]}} v
 * @param {string} pid
 * @param {boolean} preidGiven whether a preid was explicitly supplied
 * @returns {string}
 */
function incrementPrerelease(v, pid, preidGiven) {
  const core = { major: v.major, minor: v.minor, patch: v.patch, build: [] };

  if (v.prerelease.length === 0) {
    // No prerelease yet: start one on the current core version.
    core.prerelease = startPrerelease(pid, preidGiven);
    return format(core);
  }

  const currentPrefix = prereleasePrefix(v.prerelease);
  const switchingPreid = preidGiven && currentPrefix !== pid;

  if (switchingPreid) {
    // Switching identifier resets the prerelease counter.
    core.prerelease = [pid, '0'];
    return format(core);
  }

  const next = v.prerelease.slice();
  const last = next[next.length - 1];
  if (NUMERIC_RE.test(last)) {
    next[next.length - 1] = String(Number(last) + 1);
  } else {
    next.push('0');
  }
  core.prerelease = next;
  return format(core);
}
