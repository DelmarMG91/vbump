# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Nothing yet.

## [0.1.0] - 2025-01-01

### Added

- SemVer 2.0.0 parser, formatter and precedence comparator.
- `major`, `minor`, `patch`, `premajor`, `preminor`, `prepatch`, `prerelease` and `none` release types.
- CLI with `--file`, `--preid`, `--dry-run`, `--json`, `--help` and `--version`.
- Indentation- and newline-preserving JSON write-back.
- Composite GitHub Action with `bump`, `file`, `preid` and `dry-run` inputs and a `version` output.
- `node:test` suite covering parsing, comparison, increments and CLI behavior.

[Unreleased]: https://github.com/DelmarMG91/vbump/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/DelmarMG91/vbump/releases/tag/v0.1.0
