import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  COPY_CSV_CLIENT_COLUMN,
  COPY_CSV_DEV_OVERRIDE_COLUMN,
  parseCsvRows,
  readCopyEntries,
  resolveCopyPath,
  resolveCopyValueFromRow,
  writeCopyEntries,
} from './copy-csv-lib.mjs';

function parseArgs(argv) {
  const args = { file: null, column: null };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token.startsWith('--file=')) {
      args.file = token.slice('--file='.length);
      continue;
    }
    if (token.startsWith('--column=')) {
      args.column = token.slice('--column='.length);
      continue;
    }
    if (token === '--file') {
      args.file = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (token === '--column') {
      args.column = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (!token.startsWith('-')) {
      if (!args.file) {
        args.file = token;
      } else if (!args.column) {
        args.column = token;
      }
    }
  }
  return args;
}

async function main() {
  const currentFilePath = fileURLToPath(import.meta.url);
  const projectRoot = path.resolve(path.dirname(currentFilePath), '..');
  const { file, column } = parseArgs(process.argv.slice(2));
  if (!file) {
    throw new Error(
      'Usage: node scripts/import-copy-csv.mjs --file <relative/path.csv> [--column <columnName>]',
    );
  }

  const inputPath = path.resolve(projectRoot, file);
  const csvContent = await fs.readFile(inputPath, 'utf8');
  const rows = parseCsvRows(csvContent);
  const [header, ...dataRows] = rows;

  const keyIndex = header.indexOf('key');

  if (keyIndex === -1) {
    throw new Error("CSV is missing required 'key' column.");
  }

  const importedByKey = new Map();
  let importModeLabel;

  if (column) {
    const targetColumnIndex = header.indexOf(column);
    if (targetColumnIndex === -1) {
      throw new Error(`CSV does not contain requested column '${column}'.`);
    }
    importModeLabel = `column '${column}'`;
    for (const row of dataRows) {
      const key = row[keyIndex]?.trim();
      if (!key) continue;
      if (importedByKey.has(key)) {
        throw new Error(`CSV contains duplicate key '${key}'.`);
      }
      importedByKey.set(key, row[targetColumnIndex] ?? '');
    }
  } else {
    const devOverrideIndex = header.indexOf(COPY_CSV_DEV_OVERRIDE_COLUMN);
    const benPreferredIndex = header.indexOf(COPY_CSV_CLIENT_COLUMN);
    if (devOverrideIndex === -1) {
      throw new Error(`CSV is missing required '${COPY_CSV_DEV_OVERRIDE_COLUMN}' column.`);
    }
    if (benPreferredIndex === -1) {
      throw new Error(`CSV is missing required '${COPY_CSV_CLIENT_COLUMN}' column.`);
    }
    importModeLabel = `'${COPY_CSV_DEV_OVERRIDE_COLUMN}' then '${COPY_CSV_CLIENT_COLUMN}'`;
    for (const row of dataRows) {
      const key = row[keyIndex]?.trim();
      if (!key) continue;
      if (importedByKey.has(key)) {
        throw new Error(`CSV contains duplicate key '${key}'.`);
      }
      const resolved = resolveCopyValueFromRow(row, [devOverrideIndex, benPreferredIndex]);
      importedByKey.set(key, resolved ?? '');
    }
  }

  const copyPath = resolveCopyPath(projectRoot);
  const template = await readCopyEntries(copyPath);
  const existingKeys = new Set(template.entries.map(entry => entry.key));
  const importedKeys = new Set(importedByKey.keys());

  const unknownKeys = [...importedKeys].filter(key => !existingKeys.has(key));
  if (unknownKeys.length > 0) {
    throw new Error(`CSV contains unknown keys not present in source: ${unknownKeys.join(', ')}`);
  }

  const missingKeys = [...existingKeys].filter(key => !importedKeys.has(key));
  if (missingKeys.length > 0) {
    console.warn(
      `Warning: CSV is missing ${missingKeys.length} key(s) present in source; those entries were left unchanged.`,
    );
    console.warn(missingKeys.join(', '));
  }

  let updatedCount = 0;
  const nextEntries = template.entries.map(entry => {
    const incoming = importedByKey.get(entry.key);
    if (incoming == null || incoming === '') {
      return entry;
    }
    if (incoming !== entry.value) {
      updatedCount += 1;
    }
    return { ...entry, value: incoming };
  });

  await writeCopyEntries(copyPath, template, nextEntries);
  console.log(`Imported ${importModeLabel} from ${inputPath}`);
  console.log(`Updated ${updatedCount} copy values (blank cells kept existing text).`);
}

main().catch(error => {
  console.error('Failed to import copy CSV:', error.message);
  process.exitCode = 1;
});
