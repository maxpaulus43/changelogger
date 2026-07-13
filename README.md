# changelogger

`changelogger` adds a release changelog entry when a staged `package.json` version changes. It summarizes changes through a local [LM Studio](https://lmstudio.ai/) OpenAI-compatible server and falls back to commit subjects when the server is unavailable.

## Install

```sh
npm install --save-dev @maxpaulus/changelogger
```

Install the Git hook:

```sh
npx changelogger install
```

This adds a marked `changelogger` block to `.git/hooks/pre-commit` without replacing other hook commands. Run `npx changelogger install` again after changing hook tooling to refresh that block.

The generated hook runs `npx --no-install changelogger generate` before each commit. It only changes `CHANGELOG.md` when the staged `package.json` version differs from `HEAD`.

## Release workflow

After installation, release as usual:

```sh
npm version patch
git commit -m "Release 0.3.1"
```

The staged version bump causes the hook to generate and stage a `CHANGELOG.md` entry. It uses LM Studio when available and falls back to commit subjects otherwise.

Refresh the hook manually with:

```sh
npx changelogger install
```

Generate an entry manually after staging a version bump with:

```sh
npx --no-install changelogger generate
```

## Configuration

Configure changelogger in the consumer project's `package.json`:

```json
{
  "changelogger": {
    "endpoint": "http://localhost:1234",
    "model": "qwen2.5-7b-instruct",
    "timeoutMs": 30000,
    "changelogPath": "docs/CHANGELOG.md"
  }
}
```

All fields are optional. The defaults are LM Studio at `http://localhost:1234`, automatic model detection, a 90-second timeout, and `CHANGELOG.md` at the repository root. Environment variables take precedence over `package.json` values:

- `CHANGELOGGER_LMSTUDIO_URL`
- `CHANGELOGGER_MODEL`
- `CHANGELOGGER_TIMEOUT_MS`
- `CHANGELOGGER_CHANGELOG_PATH`

If LM Studio cannot be reached, changelogger writes the commit subjects instead, so a release commit still receives an entry.

## Commands

```sh
npx changelogger install
npx changelogger generate
```

`generate` must run inside a Git working tree.

## Development

```sh
npm test
```
