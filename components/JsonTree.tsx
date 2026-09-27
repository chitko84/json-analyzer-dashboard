"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import type { JsonValue } from "@/lib/json-tools";
import { getType, toJsonPath } from "@/lib/json-tools";

type Selection = { path: string; value: JsonValue; parent: string; depth: number };

type Props = {
  value: JsonValue;
  query: string;
  onSelect: (selection: Selection) => void;
};

function preview(value: JsonValue) {
  if (value === null) return "null";
  if (typeof value === "string") return `\"${value}\"`;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `Array(${value.length})`;
  return `Object(${Object.keys(value).length})`;
}

function containsQuery(key: string, value: JsonValue, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  if (key.toLowerCase().includes(q) || preview(value).toLowerCase().includes(q)) return true;
  if (Array.isArray(value)) return value.some((child, i) => containsQuery(String(i), child, query));
  if (value && typeof value === "object") return Object.entries(value).some(([k, child]) => containsQuery(k, child, query));
  return false;
}

function TreeNode({
  label,
  value,
  path,
  parent,
  depth,
  query,
  onSelect,
}: {
  label: string;
  value: JsonValue;
  path: string;
  parent: string;
  depth: number;
  query: string;
  onSelect: Props["onSelect"];
}) {
  const expandable = Array.isArray(value) || (value !== null && typeof value === "object");
  const [open, setOpen] = useState(depth < 2);
  const visible = useMemo(() => containsQuery(label, value, query), [label, value, query]);
  if (!visible) return null;

  const entries: [string, JsonValue][] = Array.isArray(value)
    ? value.map((item, index) => [String(index), item])
    : value && typeof value === "object"
      ? Object.entries(value)
      : [];

  return (
    <div className="tree-node">
      <button
        className="tree-row"
        style={{ paddingLeft: 10 + depth * 16 }}
        onClick={() => {
          if (expandable) setOpen((current) => !current);
          onSelect({ path, value, parent, depth });
        }}
        type="button"
      >
        <span className="tree-caret">
          {expandable ? (open ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <span className="tree-dot" />}
        </span>
        <span className="tree-key">{label}</span>
        <span className={`tree-type type-${getType(value).replace(/[^a-z]/g, "")}`}>{getType(value)}</span>
        {!expandable && <span className="tree-value">{preview(value)}</span>}
      </button>
      {expandable && open && (
        <div>
          {entries.map(([key, child]) => (
            <TreeNode
              key={`${path}-${key}`}
              label={key}
              value={child}
              path={toJsonPath(path, Array.isArray(value) ? Number(key) : key)}
              parent={path}
              depth={depth + 1}
              query={query}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function JsonTree({ value, query, onSelect }: Props) {
  return <TreeNode label="$" value={value} path="$" parent="—" depth={0} query={query} onSelect={onSelect} />;
}
