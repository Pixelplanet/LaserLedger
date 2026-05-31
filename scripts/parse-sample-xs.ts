// Ad-hoc smoke test: run every sample .xs file through parseXcs and print
// the resulting ParsedXcs. Not part of the test suite — invoke with:
//   npx tsx scripts/parse-sample-xs.ts
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseXcs } from '../server/src/services/xcs.js';

const dir = join(process.cwd(), 'docs', 'sample-xs-output');
const files = readdirSync(dir).filter((f) => f.endsWith('.xs')).sort();

let failed = 0;
for (const name of files) {
  const buf = readFileSync(join(dir, name));
  process.stdout.write(`${name.padEnd(36)} ${buf.length.toString().padStart(9)} B  → `);
  try {
    const parsed = parseXcs(buf);
    const uniqPower = new Set(parsed.layers.map((l) => l.power)).size;
    const uniqSpeed = new Set(parsed.layers.map((l) => l.speed)).size;
    const uniqFreq = new Set(parsed.layers.map((l) => l.frequency)).size;
    console.log(
      `OK  ext_id=${(parsed.ext_id ?? '-').padEnd(16)} ` +
        `light=${(parsed.light_source ?? '-').padEnd(6)} ` +
        `mat=${String(parsed.xtool_material_id ?? '-').padEnd(6)} ` +
        `layers=${String(parsed.layers.length).padStart(3)} ` +
        `(power×${uniqPower} speed×${uniqSpeed} freq×${uniqFreq})`,
    );
  } catch (error) {
    failed += 1;
    console.log('FAIL', error instanceof Error ? error.message : error);
  }
}

console.log(`\n${files.length - failed}/${files.length} parsed successfully.`);
process.exit(failed === 0 ? 0 : 1);
