import { copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// The single-file build lands in web/dist. FastAPI already serves
// web/index.html, so copy it into place without touching the backend.
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const from = join(root, "dist", "index.html");
const to = join(root, "index.html");

copyFileSync(from, to);
console.log("Copied dist/index.html to web/index.html");
