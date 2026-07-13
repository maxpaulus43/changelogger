#!/usr/bin/env node
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { main as generate } from "../scripts/gen-changelog.mjs";

const START = "# >>> changelogger >>>";
const END = "# <<< changelogger <<<";
const PACKAGE_NAME = "@maxpaulus/changelogger";

const command = process.argv[2];

if (command === "generate") {
    await generate();
} else if (command === "install") {
    install();
} else {
    console.error("Usage: changelogger <install|generate>");
    process.exitCode = 1;
}

function install() {
    const repoRoot = git(["rev-parse", "--show-toplevel"]);
    const hookPath = `${repoRoot}/.git/hooks/pre-commit`;
    const packageJson = JSON.parse(readFileSync(`${repoRoot}/package.json`, "utf8"));
    const generateCommand = packageJson.name === PACKAGE_NAME
        ? "node ./bin/changelogger.mjs generate"
        : "npx --no-install changelogger generate";
    const block = `${START}\n${generateCommand}\n${END}\n`;
    const existing = existsSync(hookPath) ? readFileSync(hookPath, "utf8") : "#!/bin/sh\n";
    const pattern = new RegExp(`${escapeRegExp(START)}[\\s\\S]*?${escapeRegExp(END)}\\n?`);

    mkdirSync(`${repoRoot}/.git/hooks`, { recursive: true });
    writeFileSync(hookPath, pattern.test(existing) ? existing.replace(pattern, block) : `${existing.trimEnd()}\n\n${block}`);
    chmodSync(hookPath, 0o755);

    console.log(`[changelogger] installed pre-commit hook in ${hookPath}`);
}

function git(args) {
    return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
