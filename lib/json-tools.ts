export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type JsonStats = {
  keys: number;
  objects: number;
  arrays: number;
  strings: number;
  numbers: number;
  booleans: number;
  nulls: number;
  maxDepth: number;
  sizeBytes: number;
};

export type StructureRow = {
  path: string;
  type: string;
  example: string;
};

export type DiffRow = {
  path: string;
  kind: "added" | "removed" | "changed";
  before?: JsonValue;
  after?: JsonValue;
};

export function safeParse(input: string): { ok: true; value: JsonValue } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(input) as JsonValue };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Invalid JSON" };
  }
}

export function formatJson(value: JsonValue) {
  return JSON.stringify(value, null, 2);
}

export function minifyJson(value: JsonValue) {
  return JSON.stringify(value);
}

export function getType(value: JsonValue): string {
  if (value === null) return "null";
  if (Array.isArray(value)) {
    if (value.length === 0) return "array";
    const types = Array.from(new Set(value.map((item) => getType(item))));
    return types.length === 1 ? `${types[0]}[]` : "mixed[]";
  }
  if (typeof value === "object") return "object";
  return typeof value;
}

export function getStats(value: JsonValue, raw: string): JsonStats {
  const stats: JsonStats = {
    keys: 0,
    objects: 0,
    arrays: 0,
    strings: 0,
    numbers: 0,
    booleans: 0,
    nulls: 0,
    maxDepth: 0,
    sizeBytes: new TextEncoder().encode(raw).length,
  };

  function visit(node: JsonValue, depth: number) {
    stats.maxDepth = Math.max(stats.maxDepth, depth);
    if (node === null) {
      stats.nulls += 1;
      return;
    }
    if (Array.isArray(node)) {
      stats.arrays += 1;
      node.forEach((item) => visit(item, depth + 1));
      return;
    }
    if (typeof node === "object") {
      stats.objects += 1;
      Object.entries(node).forEach(([_, child]) => {
        stats.keys += 1;
        visit(child, depth + 1);
      });
      return;
    }
    if (typeof node === "string") stats.strings += 1;
    if (typeof node === "number") stats.numbers += 1;
    if (typeof node === "boolean") stats.booleans += 1;
  }

  visit(value, 0);
  return stats;
}

export function exampleFor(value: JsonValue): string {
  if (value === null) return "null";
  if (typeof value === "string") return value.length > 30 ? `\"${value.slice(0, 27)}…\"` : `\"${value}\"`;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    const preview = value.slice(0, 2).map(exampleFor).join(", ");
    return `[${preview}${value.length > 2 ? ", …" : ""}]`;
  }
  return "{…}";
}

export function flattenStructure(value: JsonValue, path = "$", rows: StructureRow[] = []): StructureRow[] {
  rows.push({ path, type: getType(value), example: exampleFor(value) });
  if (Array.isArray(value)) {
    if (value.length > 0) flattenStructure(value[0], `${path}[0]`, rows);
  } else if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, child]) => flattenStructure(child, `${path}.${key}`, rows));
  }
  return rows;
}

export function toJsonPath(parent: string, key: string | number) {
  return typeof key === "number" ? `${parent}[${key}]` : `${parent}.${key}`;
}

export function inferSchema(value: JsonValue): Record<string, unknown> {
  if (value === null) return { type: "null" };
  if (Array.isArray(value)) {
    return {
      type: "array",
      items: value.length ? inferSchema(value[0]) : {},
    };
  }
  if (typeof value === "object") {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    Object.entries(value).forEach(([key, child]) => {
      properties[key] = inferSchema(child);
      required.push(key);
    });
    return { type: "object", properties, required, additionalProperties: true };
  }
  if (typeof value === "number") return { type: Number.isInteger(value) ? "integer" : "number" };
  return { type: typeof value };
}

function pascalCase(input: string) {
  return input
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("") || "GeneratedType";
}

function tsType(value: JsonValue, name: string, interfaces: string[]): string {
  if (value === null) return "null";
  if (Array.isArray(value)) {
    if (!value.length) return "unknown[]";
    return `${tsType(value[0], `${name}Item`, interfaces)}[]`;
  }
  if (typeof value === "object") {
    const interfaceName = pascalCase(name);
    const lines = Object.entries(value).map(([key, child]) => {
      const childName = `${interfaceName}${pascalCase(key)}`;
      const type = tsType(child, childName, interfaces);
      return `  ${JSON.stringify(key)}: ${type};`;
    });
    const block = `export interface ${interfaceName} {\n${lines.join("\n")}\n}`;
    if (!interfaces.includes(block)) interfaces.push(block);
    return interfaceName;
  }
  if (typeof value === "number") return "number";
  return typeof value;
}

export function generateTypescript(value: JsonValue, rootName = "Root") {
  const interfaces: string[] = [];
  const rootType = tsType(value, rootName, interfaces);
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    interfaces.push(`export type ${pascalCase(rootName)} = ${rootType};`);
  }
  return interfaces.reverse().join("\n\n");
}

function valueEqual(a: JsonValue, b: JsonValue) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function diffJson(a: JsonValue, b: JsonValue, path = "$", out: DiffRow[] = []): DiffRow[] {
  if (valueEqual(a, b)) return out;

  const aObj = a && typeof a === "object" && !Array.isArray(a);
  const bObj = b && typeof b === "object" && !Array.isArray(b);

  if (aObj && bObj) {
    const aRec = a as Record<string, JsonValue>;
    const bRec = b as Record<string, JsonValue>;
    const keys = new Set([...Object.keys(aRec), ...Object.keys(bRec)]);
    keys.forEach((key) => {
      const childPath = `${path}.${key}`;
      if (!(key in aRec)) out.push({ path: childPath, kind: "added", after: bRec[key] });
      else if (!(key in bRec)) out.push({ path: childPath, kind: "removed", before: aRec[key] });
      else diffJson(aRec[key], bRec[key], childPath, out);
    });
    return out;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    const max = Math.max(a.length, b.length);
    for (let i = 0; i < max; i += 1) {
      const childPath = `${path}[${i}]`;
      if (i >= a.length) out.push({ path: childPath, kind: "added", after: b[i] });
      else if (i >= b.length) out.push({ path: childPath, kind: "removed", before: a[i] });
      else diffJson(a[i], b[i], childPath, out);
    }
    return out;
  }

  out.push({ path, kind: "changed", before: a, after: b });
  return out;
}

export function toCsv(value: JsonValue): string | null {
  const rows = Array.isArray(value) ? value : [value];
  if (!rows.length || rows.some((row) => !row || typeof row !== "object" || Array.isArray(row))) return null;
  const records = rows as Record<string, JsonValue>[];
  const headers = Array.from(new Set(records.flatMap((row) => Object.keys(row))));
  const escape = (cell: string) => /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
  const lines = [headers.map(escape).join(",")];
  records.forEach((row) => {
    lines.push(headers.map((header) => {
      const cell = row[header];
      if (cell === undefined || cell === null) return "";
      return escape(typeof cell === "object" ? JSON.stringify(cell) : String(cell));
    }).join(","));
  });
  return lines.join("\n");
}

export function humanBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
