import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { changelogPrompt } from "../scripts/gen-changelog.mjs";

const cli = new URL("../bin/changelogger.mjs", import.meta.url).pathname;

function git(dir, ...args) {
    return execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim();
}

function run(dir, command) {
    return execFileSync(process.execPath, [cli, command], {
        cwd: dir,
        encoding: "utf8",
        env: { ...process.env, CHANGELOGGER_LMSTUDIO_URL: "http://127.0.0.1:1" },
    });
}

function repo({ changelog = "", config = {} } = {}) {
    const dir = mkdtempSync(join(tmpdir(), "changelogger-"));
    git(dir, "init");
    git(dir, "config", "user.email", "test@example.com");
    git(dir, "config", "user.name", "Test User");
    writeFileSync(join(dir, "package.json"), `${JSON.stringify({ version: "1.0.0", ...config })}\n`);
    if (changelog) writeFileSync(join(dir, "CHANGELOG.md"), changelog);
    git(dir, "add", ".");
    git(dir, "commit", "-m", "Add initial feature");
    return dir;
}

function stageRelease(dir, version = "1.1.0") {
    const packageJson = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    packageJson.version = version;
    writeFileSync(join(dir, "package.json"), `${JSON.stringify(packageJson)}\n`);
    writeFileSync(join(dir, ".git", "COMMIT_EDITMSG"), "Release new capability\n");
    git(dir, "add", "package.json");
}

function usingRepo(options, fn) {
    const dir = repo(options);
    try {
        fn(dir);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

test("prompt distinguishes removed and superseded implementation from release changes", () => {
    const prompt = changelogPrompt();
    assert.match(prompt, /final net effect/);
    assert.match(prompt, /lines beginning with - are removed code/);
    assert.match(prompt, /summarize only the replacement that remains/);
});

test("does nothing without a version bump", () => usingRepo({}, (dir) => {
    run(dir, "generate");
    assert.equal(existsSync(join(dir, "CHANGELOG.md")), false);
}));

test("generates a fallback entry for a version bump when LM Studio is unavailable", () => usingRepo({}, (dir) => {
    git(dir, "tag", "v1.0.0");
    stageRelease(dir);
    run(dir, "generate");
    const changelog = readFileSync(join(dir, "CHANGELOG.md"), "utf8");
    assert.match(changelog, /^# Changelog\n\n## 1\.1\.0 - \d{4}-\d{2}-\d{2}\n/m);
    assert.match(changelog, /- Release new capability/);
}));

test("generates an entry when no previous tag exists", () => usingRepo({}, (dir) => {
    stageRelease(dir);
    run(dir, "generate");
    assert.match(readFileSync(join(dir, "CHANGELOG.md"), "utf8"), /## 1\.1\.0/);
}));

test("preserves existing changelog entries", () => usingRepo({ changelog: "# Changelog\n\n## 1.0.0 - 2026-01-01\n- Old change.\n" }, (dir) => {
    stageRelease(dir);
    run(dir, "generate");
    const changelog = readFileSync(join(dir, "CHANGELOG.md"), "utf8");
    assert.ok(changelog.indexOf("## 1.1.0") < changelog.indexOf("## 1.0.0"));
}));

test("reads changelogPath from the consumer package.json", () => usingRepo({
    config: { changelogger: { changelogPath: "docs/CHANGELOG.md" } },
}, (dir) => {
    stageRelease(dir);
    run(dir, "generate");
    assert.match(readFileSync(join(dir, "docs", "CHANGELOG.md"), "utf8"), /## 1.1.0/);
    assert.equal(git(dir, "diff", "--cached", "--name-only").split("\n").includes("docs/CHANGELOG.md"), true);
}));

test("adds and updates only its marked pre-commit hook block",  () => usingRepo({}, (dir) => {
    const hook = join(dir, ".git", "hooks", "pre-commit");
    writeFileSync(hook, "#!/bin/sh\necho existing hook\n");
    run(dir, "install");
    run(dir, "install");
    const contents = readFileSync(hook, "utf8");
    assert.match(contents, /echo existing hook/);
    assert.equal((contents.match(/# >>> changelogger >>>/g) ?? []).length, 1);
    assert.match(contents, /npx --no-install changelogger generate/);
}));
