import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCsvRows, readCopyEntries, resolveCopyPath, serializeCsvRows } from './copy-csv-lib.mjs';

async function main() {
  const currentFilePath = fileURLToPath(import.meta.url);
  const projectRoot = path.resolve(path.dirname(currentFilePath), '..');
  const outputArg = process.argv[2];
  const outputPath = outputArg
    ? path.resolve(projectRoot, outputArg)
    : path.join(projectRoot, 'scripts', 'copy-export.csv');

  const copyPath = resolveCopyPath(projectRoot);
  const { entries } = await readCopyEntries(copyPath);
  const rows = buildCsvRows(entries);
  const csv = serializeCsvRows(rows);
  await fs.writeFile(outputPath, `${csv}\n`, 'utf8');

  console.log(`Exported ${entries.length} copy rows to ${outputPath}`);
  console.log('CSV columns: key, default, ben prefered, dev override');
}

main().catch(error => {
  console.error('Failed to export copy CSV:', error.message);
  process.exitCode = 1;
});
