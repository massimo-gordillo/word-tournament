# Copy CSV Roundtrip

This project supports a one-time manual copy handoff workflow:

1. Export all managed copy keys to CSV.
2. Send CSV to client.
3. Client fills in a custom column.
4. Import that column back into app copy.

## Source Of Truth

Managed copy is stored in `app/copy/strings.ts` as flat key/value entries between:

- `// COPY_ENTRIES_START`
- `// COPY_ENTRIES_END`

Do not change key names after sending CSV to the client.

## Export CSV

```bash
npm run copy:export:csv
```

Default output: `scripts/copy-export.csv`

Optional custom output path:

```bash
node scripts/export-copy-csv.mjs path/to/output.csv
```

## Client Editing Rules

- Keep the `key` column unchanged.
- Keep the `default` column as reference.
- Place client edits in the `ben prefered` column.
- Optional `dev override` column for developer copy; when filled, it wins over `ben prefered`.
- Blank cells are allowed and keep existing app copy on import.

## Import Copy (default merge)

```bash
npm run copy:import:csv -- --file scripts/copy-export.csv
```

Merge order per row:

1. `dev override` when it contains non-whitespace text
2. otherwise `ben prefered` when it contains non-whitespace text
3. otherwise keep existing app copy

## Import A Single Column (legacy)

```bash
npm run copy:import:csv -- --file scripts/copy-export.csv --column client_v1
```

Import validations:

- fails if `key` column is missing,
- default merge mode fails if `dev override` or `ben prefered` is missing,
- `--column` mode fails if the selected column does not exist,
- fails on duplicate keys,
- fails if CSV has unknown keys,
- warns (and continues) if CSV is missing keys that exist in source; those entries stay unchanged.

After import, app copy updates in `app/copy/strings.ts`.
