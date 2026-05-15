import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function computeVersion(): string {
    const now = new Date();
    const base = `${now.getUTCFullYear()}.${now.getUTCMonth() + 1}.${now.getUTCDate()}`;

    let existing: string[];
    try {
        const out = execFileSync("git", ["-C", packageRoot, "tag", "-l", `v${base}*`], {
            encoding: "utf8",
        });
        existing = out.trim().split("\n").filter(Boolean);
    } catch {
        existing = [];
    }

    if (existing.length === 0) return base;

    const maxPatch = Math.max(
        0,
        ...existing.map(tag => {
            const parts = tag.replace(/^v/, "").split(".");
            return parts.length > 3 ? parseInt(parts[3], 10) || 0 : 0;
        }),
    );
    return `${base}.${maxPatch + 1}`;
}

const version = computeVersion();
console.log(`Preparing @matter/dcl-data@${version}`);

await writeFile(join(packageRoot, ".version"), version, "utf8");

const pkgPath = join(packageRoot, "package.json");
const pkg = JSON.parse(await readFile(pkgPath, "utf8")) as { version: string };
pkg.version = version;
await writeFile(pkgPath, JSON.stringify(pkg, null, 4) + "\n", "utf8");
