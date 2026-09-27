# JSON Analyzer

A premium browser-first JSON workspace for validating, exploring, comparing, transforming, and generating developer-ready assets from JSON.

## Features

- Validate and format JSON
- Minify JSON
- Upload local `.json` files
- Document statistics: keys, objects, arrays, types, depth, and size
- Searchable recursive tree explorer
- Click any node to inspect its value, type, parent, depth, and JSONPath
- Automatic structure/type detection
- JSON Schema generation
- Validate a second payload against the generated JSON Schema
- JSON diff: added, removed, and changed values
- JSON to TypeScript interface generation
- JSON to CSV export for flat object/array data
- Download JSON, CSV, TypeScript, and JSON Schema files
- Light/dark theme
- Responsive layout
- Local-only processing — no API keys, backend, or database

## Tech Stack

- Next.js
- React
- TypeScript
- CSS
- Lucide React
- AJV for local JSON Schema validation

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

For a production check:

```bash
npm run build
npm start
```

## Privacy

All JSON processing happens inside the browser. The project does not upload JSON to a server and does not require API keys.

## Suggested GitHub Repository Name

`json-analyzer`

## License

MIT
