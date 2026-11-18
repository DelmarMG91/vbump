import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, inc } from './semver.js';

const RELEASE_TYPES = [
  'major',
  'minor',
  'patch',
  'premajor',
  'preminor',
  'prepatch',
  'prerelease',
  'none',
];

const HELP = `vbump - bump semantic versions in package.json files

Usage:
  vbump <release> [options]

Release types:
  major         bump major (1.2.3 -> 2.0.0)
  minor         bump minor (1.2.3 -> 1.3.0)
  patch         bump patch (1.2.3 -> 1.2.4)
  premajor      bump major and start a prerelease (1.2.3 -> 2.0.0-beta.0)
  preminor      bump minor and start a prerelease (1.2.3 -> 1.3.0-beta.0)
  prepatch      bump patch and start a prerelease (1.2.3 -> 1.2.4-beta.0)
  prerelease    increment an existing prerelease (1.2.3-beta.0 -> 1.2.3-beta.1)
  none          leave the version unchanged (useful with --dry-run)

Options:
  --file <path>   JSON file containing a top-level "version" (default: package.json)
  --preid <id>    prerelease identifier for pre* bumps (default: 0)
  --dry-run       print the result without writing the file
  --json          print machine-readable { oldVersion, newVersion, changed }
  -h, --help      show this help
  -v, --version   print the vbump version
`;

/**
 * Read the vbump package version for --version output.
 * @returns {string}
 */
function toolVersion() {
  const pkgPath = fileURLToPath(new URL('../package.json', import.meta.url));
  return JSON.parse(readFileSync(pkgPath, 'utf8')).version;
}

/**
 * Parse CLI arguments into an options object.
 * @param {string[]} argv
 * @returns {{bump:string|null, file:string, preid:string|undefined, dryRun:boolean, json:boolean, help:boolean, version:boolean}}
 */
export function parseArgs(argv) {
  const opts = {
    bump: null,
    file: 'package.json',
    preid: undefined,
    dryRun: false,
    json: false,
    help: false,
    version: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') {
      opts.help = true;
    } else if (arg === '-v' || arg === '--version') {
      opts.version = true;
    } else if (arg === '--dry-run') {
      opts.dryRun = true;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--file') {
      const value = argv[++i];
      if (value === undefined) throw new Error('--file requires a path');
      opts.file = value;
    } else if (arg.startsWith('--file=')) {
      opts.file = arg.slice('--file='.length);
    } else if (arg === '--preid') {
      const value = argv[++i];
      if (value === undefined) throw new Error('--preid requires an identifier');
      opts.preid = value;
    } else if (arg.startsWith('--preid=')) {
      opts.preid = arg.slice('--preid='.length);
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    } else if (opts.bump === null) {
      opts.bump = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }
  return opts;
}

/**
 * Detect the indentation width used by a JSON document (2 or 4 spaces).
 * @param {string} text
 * @returns {number}
 */
export function detectIndent(text) {
  const match = /\n( +)"/.exec(text);
  if (!match) return 2;
  const width = match[1].length;
  return width >= 4 ? 4 : 2;
}

/**
 * Run the CLI.
 * @param {string[]} argv arguments without the node/script prefix
 * @returns {number} process exit code
 */
export function main(argv = process.argv.slice(2)) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (error) {
    process.stderr.write(`vbump: ${error.message}\n\n${HELP}`);
    return 2;
  }

  if (opts.help) {
    process.stdout.write(HELP);
    return 0;
  }
  if (opts.version) {
    process.stdout.write(`${toolVersion()}\n`);
    return 0;
  }
  if (!opts.bump) {
    process.stderr.write(`vbump: missing release type\n\n${HELP}`);
    return 2;
  }
  if (!RELEASE_TYPES.includes(opts.bump)) {
    process.stderr.write(
      `vbump: unknown release type "${opts.bump}" (expected one of ${RELEASE_TYPES.join(', ')})\n`,
    );
    return 2;
  }

  const filePath = resolve(process.cwd(), opts.file);
  let original;
  try {
    original = readFileSync(filePath, 'utf8');
  } catch (error) {
    process.stderr.write(`vbump: cannot read ${filePath}: ${error.message}\n`);
    return 1;
  }

  let data;
  try {
    data = JSON.parse(original);
  } catch (error) {
    process.stderr.write(`vbump: invalid JSON in ${filePath}: ${error.message}\n`);
    return 1;
  }

  if (!data || typeof data.version !== 'string') {
    process.stderr.write(`vbump: ${filePath} has no top-level "version" string\n`);
    return 1;
  }

  const oldVersion = data.version;
  if (!parse(oldVersion)) {
    process.stderr.write(`vbump: invalid semver in ${filePath}: "${oldVersion}"\n`);
    return 1;
  }

  let newVersion;
  try {
    newVersion = inc(oldVersion, opts.bump, opts.preid);
  } catch (error) {
    process.stderr.write(`vbump: ${error.message}\n`);
    return 1;
  }

  const changed = newVersion !== oldVersion;

  if (changed && !opts.dryRun) {
    const indent = detectIndent(original);
    const trailingNewline = original.endsWith('\n');
    data.version = newVersion;
    const rendered = JSON.stringify(data, null, indent) + (trailingNewline ? '\n' : '');
    try {
      writeFileSync(filePath, rendered);
    } catch (error) {
      process.stderr.write(`vbump: cannot write ${filePath}: ${error.message}\n`);
      return 1;
    }
  }

  if (opts.json) {
    process.stdout.write(`${JSON.stringify({ oldVersion, newVersion, changed })}\n`);
  } else {
    process.stdout.write(`v${newVersion}\n`);
  }
  return 0;
}
