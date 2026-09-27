# Build Notes

Local source sanity checks completed:

- TypeScript/TSX syntax transpilation passed for all source files.
- Core utility tests passed for:
  - JSON parsing
  - statistics
  - JSON Schema inference
  - TypeScript generation
  - JSON diffing
  - JSON-to-CSV conversion

The sandbox could not complete `npm install` before its network timeout, so `npm run build` could not be executed here because Next.js dependencies were not downloaded.

On your machine:

```bash
npm install
npm run build
npm run dev
```

If `npm run build` reports an error, paste the complete error into ChatGPT for a patch.
