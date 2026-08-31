import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

const railway = await readJson("railway.json");
const packageJson = await readJson("package.json");
const healthRoute = await readFile("src/app/api/health/route.ts", "utf8");

assert.equal(railway.$schema, "https://railway.com/railway.schema.json");
assert.equal(railway.build?.builder, "RAILPACK");
assert.equal(railway.build?.buildCommand, "npm run build");
assert.equal(railway.deploy?.startCommand, "npm run start");
assert.equal(railway.deploy?.healthcheckPath, "/api/health");
assert.match(packageJson.engines?.node || "", /^20\./);
assert.match(healthRoute, /status:\s*"ok"/);
assert.match(healthRoute, /status:\s*200/);
assert.match(healthRoute, /getBackendBaseUrl/);

console.log("Railway deploy contract verified");
