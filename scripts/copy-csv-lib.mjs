import fs from 'node:fs/promises';
import path from 'node:path';

const START_MARKER = '// COPY_ENTRIES_START';
const END_MARKER = '// COPY_ENTRIES_END';
const ENTRY_LINE_REGEX = /^\s*'([^']+)':\s'((?:\\'|[^'])*)',\s*$/;

function escapeForTsString(value) {
  return value.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
}

function unescapeFromTsString(value) {
  return value.replaceAll("\\'", "'").replaceAll('\\\\', '\\');
}

function escapeCsvField(value) {
  const asString = value ?? '';
  if (/[",\n\r]/.test(asString)) {
    return `"${asString.replaceAll('"', '""')}"`;
  }
  return asString;
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      const nextChar = line[i + 1];
      if (inQuotes && nextChar === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function parseCsv(content) {
  const normalized = content.replaceAll('\r\n', '\n').trim();
  if (!normalized) {
    return [];
  }
  const lines = normalized.split('\n');
  return lines.map(parseCsvLine);
}

function toCsv(rows) {
  return rows.map(row => row.map(escapeCsvField).join(',')).join('\n');
}

export function resolveCopyPath(projectRoot) {
  return path.join(projectRoot, 'app', 'copy', 'strings.ts');
}

export async function readCopyEntries(copyFilePath) {
  const source = await fs.readFile(copyFilePath, 'utf8');
  const startIndex = source.indexOf(START_MARKER);
  const endIndex = source.indexOf(END_MARKER);

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new Error(`Could not find copy entry markers in ${copyFilePath}`);
  }

  const pre = source.slice(0, startIndex + START_MARKER.length);
  const body = source.slice(startIndex + START_MARKER.length, endIndex);
  const post = source.slice(endIndex);

  const lines = body.split('\n');
  const entries = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = line.match(ENTRY_LINE_REGEX);
    if (!match) {
      throw new Error(`Unexpected copy entry line format: ${line}`);
    }
    entries.push({
      key: match[1],
      value: unescapeFromTsString(match[2]),
      indent: line.match(/^\s*/)?.[0] ?? '  ',
    });
  }

  return { source, pre, post, entries };
}

export async function writeCopyEntries(copyFilePath, template, nextEntries) {
  const sortedEntries = [...nextEntries].sort((a, b) => a.key.localeCompare(b.key));
  const indent = template.entries[0]?.indent ?? '  ';
  const body = `\n${sortedEntries
    .map(entry => `${indent}'${entry.key}': '${escapeForTsString(entry.value)}',`)
    .join('\n')}\n`;
  const nextSource = `${template.pre}${body}${template.post}`;
  await fs.writeFile(copyFilePath, nextSource, 'utf8');
}

export const COPY_CSV_CLIENT_COLUMN = 'ben prefered';
export const COPY_CSV_DEV_OVERRIDE_COLUMN = 'dev override';

export function hasNonWhitespaceCopyContent(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/** First column with non-whitespace content wins; otherwise null (keep existing copy). */
export function resolveCopyValueFromRow(row, columnIndices) {
  for (const columnIndex of columnIndices) {
    if (columnIndex === -1) continue;
    const value = row[columnIndex] ?? '';
    if (hasNonWhitespaceCopyContent(value)) {
      return value;
    }
  }
  return null;
}

export function buildCsvRows(entries) {
  const rows = [['key', 'default', COPY_CSV_CLIENT_COLUMN, COPY_CSV_DEV_OVERRIDE_COLUMN]];
  for (const entry of entries) {
    rows.push([entry.key, entry.value, '', '']);
  }
  return rows;
}

export function parseCsvRows(content) {
  const rows = parseCsv(content);
  if (rows.length < 2) {
    throw new Error('CSV must include a header and at least one data row.');
  }
  return rows;
}

export function serializeCsvRows(rows) {
  return toCsv(rows);
}
