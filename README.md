# vbump

Bump semantic versions in JSON manifests from the command line or a GitHub Action.

[![npm](https://img.shields.io/npm/v/vbump.svg)](https://www.npmjs.com/package/vbump)
[![CI](https://github.com/DelmarMG91/vbump/actions/workflows/ci.yml/badge.svg)](https://github.com/DelmarMG91/vbump/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org/)

## Features

- Full [SemVer 2.0.0](https://semver.org/spec/v2.0.0.html) parsing, formatting and precedence comparison.
- Correct prerelease ordering: numeric identifiers compare numerically, numeric identifiers rank below alphanumeric ones, and build metadata is ignored for precedence.
- All the usual release types: `major`, `minor`, `patch`, `premajor`, `preminor`, `prepatch`, `prerelease` and `none`.
- Prerelease counters increment in place, and switching `--preid` resets the counter to `.0`.
- Reads and writes any JSON file with a top-level `version` field, preserving 2- or 4-space indentation and the trailing newline.
- `--dry-run` for previews and `--json` for script-friendly output.
- Zero runtime dependencies. Pure ESM, Node.js 18+.
- Ships as a composite GitHub Action with a `version` output.

## Install

```bash
npm install --save-dev vbump
```

Or run it without installing:

```bash
npx vbump patch --dry-run
```

## Quick Start

Given a `package.json` with version `1.2.3`:

```json
{
  "name": "my-app",
  "version": "1.2.3"
}
```

Bump the minor version:

```bash
$ vbump minor
v1.3.0
```

The file is updated in place:

```json
{
  "name": "my-app",
  "version": "1.3.0"
}
```

Capture the new version in a shell variable:

```bash
NEW_VERSION="$(vbump patch)"
echo "Releasing ${NEW_VERSION}"   # Releasing v1.3.1
```

## Usage

```
vbump <release> [options]
```

### Release types

| Release      | Before              | After               | Notes                                             |
| ------------ | ------------------- | ------------------- | ------------------------------------------------- |
| `major`      | `1.2.3`             | `2.0.0`             | Resets minor and patch, clears prerelease.        |
| `minor`      | `1.2.3`             | `1.3.0`             | Resets patch, clears prerelease.                  |
| `patch`      | `1.2.3`             | `1.2.4`             | Clears prerelease.                                |
| `premajor`   | `1.2.3`             | `2.0.0-beta.0`      | Bumps major, then starts a prerelease.            |
| `preminor`   | `1.2.3`             | `1.3.0-beta.0`      | Bumps minor, then starts a prerelease.            |
| `prepatch`   | `1.2.3`             | `1.2.4-beta.0`      | Bumps patch, then starts a prerelease.            |
| `prerelease` | `1.2.3-beta.0`      | `1.2.3-beta.1`      | Increments the counter; starts at `<preid>.0`.    |
| `none`       | `1.2.3`             | `1.2.3`             | Reports the current version without changing it.  |

### Options

| Option          | Default        | Description                                                                 |
| --------------- | -------------- | --------------------------------------------------------------------------- |
| `--file <path>` | `package.json` | JSON file with a top-level `version` string.                                 |
| `--preid <id>`  | `0`            | Prerelease identifier for `pre*` and `prerelease` bumps (for example `beta`). |
| `--dry-run`     | `false`        | Print the computed version without writing the file.                        |
| `--json`        | `false`        | Print `{ "oldVersion", "newVersion", "changed" }` instead of `vX.Y.Z`.      |
| `-h, --help`    |                | Show help.                                                                  |
| `-v, --version` |                | Print the vbump version.                                                    |

### Examples

Preview a release without touching the file:

```bash
$ vbump major --dry-run
v2.0.0
```

Start a beta line and then advance it:

```bash
$ vbump preminor --preid beta
v1.3.0-beta.0

$ vbump prerelease --preid beta
v1.3.0-beta.1
```

Switch the prerelease identifier (the counter resets):

```bash
$ vbump prerelease --preid rc
v1.3.0-rc.0
```

Machine-readable output for CI scripts:

```bash
$ vbump patch --json
{"oldVersion":"1.3.0","newVersion":"1.3.1","changed":true}
```

Bump a manifest in another directory:

```bash
$ vbump patch --file packages/core/package.json
v0.4.8
```

Confirm the version is current without a write:

```bash
$ vbump none --json
{"oldVersion":"1.3.1","newVersion":"1.3.1","changed":false}
```

## GitHub Action

`vbump` is also a composite action. It runs the bundled CLI, writes the new
version into the file, and exposes it as `steps.<id>.outputs.version`.

```yaml
name: Release

on:
  push:
    branches: [main]

permissions:
  contents: write

jobs:
  bump:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Bump version
        id: vbump
        uses: DelmarMG91/vbump@v0.1.0
        with:
          bump: minor
          file: package.json
          preid: beta
          dry-run: 'false'

      - name: Show result
        run: echo "New version is ${{ steps.vbump.outputs.version }}"

      - name: Commit
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add package.json
          git commit -m "chore: release ${{ steps.vbump.outputs.version }}"
          git push
```

### Action inputs and outputs

| Name      | Kind   | Default        | Description                                                          |
| --------- | ------ | -------------- | -------------------------------------------------------------------- |
| `bump`    | input  | `patch`        | Release type to apply.                                               |
| `file`    | input  | `package.json` | JSON file containing a top-level `version`.                          |
| `preid`   | input  | `''`           | Prerelease identifier; empty means the default `0`.                  |
| `dry-run` | input  | `'false'`      | Set to `true` to compute without writing.                             |
| `version` | output |                | Resulting version in `vX.Y.Z` form.                                  |

## SemVer rules summary

- A version is `MAJOR.MINOR.PATCH`, optionally followed by `-PRERELEASE` and `+BUILD`.
- Leading zeroes are not allowed in numeric identifiers.
- Precedence compares major, minor and patch numerically, then the prerelease:
  - a version without a prerelease ranks above the same core version with one;
  - numeric identifiers compare numerically;
  - numeric identifiers rank below alphanumeric identifiers;
  - alphanumeric identifiers compare in ASCII lexical order;
  - a larger set of identifiers wins when all preceding identifiers are equal.
- Build metadata (`+...`) is ignored when determining precedence.
- `vbump` drops build metadata whenever it produces a new version; `none` preserves the version verbatim.

## Development

Requires Node.js 18 or newer.

```bash
git clone https://github.com/DelmarMG91/vbump.git
cd vbump
npm test
```

The test suite uses the built-in `node:test` runner and `node:assert`, so
there is nothing to install before running it. To run a single file:

```bash
node --test test/semver.test.js
```

Manual smoke checks:

```bash
node bin/vbump.js --help
node bin/vbump.js --version
```

## Contributing

Issues and pull requests are welcome. Please keep the zero-dependency
constraint, add a test for every behavior change, and run `npm test` before
opening a pull request.

## License

[MIT](LICENSE) © 2025 DelmarMG91
