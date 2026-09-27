"use client";

import Ajv from "ajv";
import {
  Braces,
  Check,
  CheckCircle2,
  Clipboard,
  Code2,
  Columns3,
  Download,
  FileJson,
  GitCompareArrows,
  Github,
  Moon,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  Upload,
  WandSparkles,
  X,
  XCircle,
} from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { JsonTree } from "@/components/JsonTree";
import { downloadText } from "@/lib/download";
import {
  DiffRow,
  JsonValue,
  diffJson,
  flattenStructure,
  formatJson,
  generateTypescript,
  getStats,
  getType,
  humanBytes,
  inferSchema,
  minifyJson,
  safeParse,
  toCsv,
} from "@/lib/json-tools";

const SAMPLE = `{
  "user": {
    "id": 1042,
    "name": "Joe",
    "age": 21,
    "active": true,
    "skills": ["JavaScript", "TypeScript", "Python"],
    "address": {
      "city": "Alor Setar",
      "country": "Malaysia"
    },
    "projects": [
      { "name": "CSV Analyzer", "status": "shipped" },
      { "name": "JSON Analyzer", "status": "building" }
    ]
  }
}`;

const DIFF_A = `{
  "name": "Joe",
  "age": 21,
  "city": "Alor Setar",
  "skills": ["JavaScript", "Python"]
}`;

const DIFF_B = `{
  "name": "Joe",
  "age": 22,
  "active": true,
  "skills": ["JavaScript", "TypeScript", "Python"]
}`;

const NAV_ITEMS = [
  ["editor", "Editor"],
  ["explorer", "Explorer"],
  ["schema", "Schema"],
  ["compare", "Compare"],
  ["typescript", "TypeScript"],
  ["export", "Export"],
] as const;

function copyText(text: string) {
  return navigator.clipboard.writeText(text);
}

function stringifyBrief(value: JsonValue | undefined) {
  if (value === undefined) return "—";
  const text = JSON.stringify(value);
  return text.length > 54 ? `${text.slice(0, 51)}…` : text;
}

function getErrorDetails(raw: string, message: string) {
  const positionMatch = message.match(/position\s+(\d+)/i);
  if (!positionMatch) return { line: null as number | null, column: null as number | null };
  const position = Number(positionMatch[1]);
  const before = raw.slice(0, position);
  const lines = before.split("\n");
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

export default function Home() {
  const [raw, setRaw] = useState(SAMPLE);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [treeQuery, setTreeQuery] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ path: string; value: JsonValue; parent: string; depth: number } | null>(null);
  const [rootName, setRootName] = useState("Root");
  const [testPayload, setTestPayload] = useState(SAMPLE);
  const [schemaResult, setSchemaResult] = useState<{ ok: boolean; messages: string[] } | null>(null);
  const [diffA, setDiffA] = useState(DIFF_A);
  const [diffB, setDiffB] = useState(DIFF_B);
  const [diffRows, setDiffRows] = useState<DiffRow[]>([]);
  const [fileName, setFileName] = useState("sample.json");
  const [activeSection, setActiveSection] = useState("editor");
  const fileInput = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => safeParse(raw), [raw]);
  const value = parsed.ok ? parsed.value : null;
  const stats = useMemo(() => value !== null ? getStats(value, raw) : null, [value, raw]);
  const structure = useMemo(() => value !== null ? flattenStructure(value).slice(0, 120) : [], [value]);
  const schema = useMemo(() => value !== null ? inferSchema(value) : null, [value]);
  const schemaText = useMemo(() => schema ? JSON.stringify(schema, null, 2) : "", [schema]);
  const tsText = useMemo(() => value !== null ? generateTypescript(value, rootName || "Root") : "", [value, rootName]);
  const formatted = useMemo(() => value !== null ? formatJson(value) : raw, [value, raw]);
  const csv = useMemo(() => value !== null ? toCsv(value) : null, [value]);
  const parseDetails = !parsed.ok ? getErrorDetails(raw, parsed.error) : null;

  useEffect(() => {
    const sections = NAV_ITEMS
      .map(([id]) => document.getElementById(id))
      .filter((section): section is HTMLElement => section !== null);

    if (!sections.some((section) => section.id === activeSection)) {
      setActiveSection("editor");
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleSection = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (visibleSection) setActiveSection(visibleSection.target.id);
      },
      { rootMargin: "-72px 0px -55% 0px", threshold: [0, 0.15, 0.35, 0.6] },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [value]);

  const flashCopy = async (label: string, text: string) => {
    await copyText(text);
    setCopied(label);
    window.setTimeout(() => setCopied(null), 1400);
  };

  const uploadFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".json")) return;
    const reader = new FileReader();
    reader.onload = () => {
      setRaw(String(reader.result ?? ""));
      setFileName(file.name);
      setSelected(null);
    };
    reader.readAsText(file);
  };

  const formatInput = () => {
    if (parsed.ok) setRaw(formatJson(parsed.value));
  };

  const minifyInput = () => {
    if (parsed.ok) setRaw(minifyJson(parsed.value));
  };

  const validateSchemaPayload = () => {
    if (!schema) return;
    const payload = safeParse(testPayload);
    if (!payload.ok) {
      setSchemaResult({ ok: false, messages: [`Test payload is invalid JSON: ${payload.error}`] });
      return;
    }
    try {
      const ajv = new Ajv({ allErrors: true, strict: false });
      const validate = ajv.compile(schema);
      const ok = validate(payload.value);
      const messages = (validate.errors ?? []).map((error) => {
        const where = error.instancePath || "$";
        return `${where}: ${error.message ?? "Schema validation failed"}`;
      });
      setSchemaResult({ ok: Boolean(ok), messages });
    } catch (error) {
      setSchemaResult({ ok: false, messages: [error instanceof Error ? error.message : "Schema validation failed"] });
    }
  };

  const compare = () => {
    const a = safeParse(diffA);
    const b = safeParse(diffB);
    if (!a.ok || !b.ok) {
      setDiffRows([]);
      return;
    }
    setDiffRows(diffJson(a.value, b.value));
  };

  const scrollTo = (id: string) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <main className={theme === "dark" ? "theme-dark" : "theme-light"}>
      <div className="app-shell">
        <header className="hero">
          <div className="brand-row">
            <div className="brand"><span className="brand-mark"><Braces size={18} /></span><span>JSON ANALYZER</span></div>
            <div className="header-actions">
              <a className="ghost-button" href="https://github.com" target="_blank" rel="noreferrer"><Github size={16} /> GitHub</a>
              <button className="icon-button" aria-label="Toggle theme" onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
                {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
              </button>
            </div>
          </div>
          <div className="hero-copy">
            <div className="eyebrow"><Sparkles size={14} /> Browser-first developer utility</div>
            <h1>Understand JSON without the friction.</h1>
            <p>Validate, inspect, compare, transform, and generate developer-ready assets from JSON — entirely in your browser.</p>
          </div>
        </header>

        <nav className="workspace-nav" aria-label="Workspace sections">
          {NAV_ITEMS.map(([id, label]) => (
            <button
              className={activeSection === id ? "active" : ""}
              key={id}
              onClick={() => scrollTo(id)}
              aria-current={activeSection === id ? "location" : undefined}
            >
              {label}
            </button>
          ))}
        </nav>

        <section id="editor" className="section-block first-section">
          <SectionHeading icon={<FileJson size={17} />} title="JSON Editor" subtitle="Paste, upload, format, minify, or validate your document." />
          <div className="editor-grid">
            <div className="panel editor-panel">
              <div className="panel-top"><span>JSON INPUT</span><span className="file-label">{fileName}</span></div>
              <textarea className="code-editor large-editor" value={raw} onChange={(e) => setRaw(e.target.value)} spellCheck={false} aria-label="JSON input" />
              <div className="button-row editor-actions">
                <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={uploadFile} />
                <button className="secondary-button" onClick={() => fileInput.current?.click()}><Upload size={15} /> Upload JSON</button>
                <button className="secondary-button" disabled={!parsed.ok} onClick={formatInput}><WandSparkles size={15} /> Format</button>
                <button className="secondary-button" disabled={!parsed.ok} onClick={minifyInput}><Columns3 size={15} /> Minify</button>
                <button className="secondary-button" onClick={() => setRaw(SAMPLE)}>Sample</button>
                <button className="text-button danger-text" onClick={() => { setRaw(""); setSelected(null); }}>Clear</button>
              </div>
            </div>

            <aside className="panel info-panel">
              <div className="panel-top"><span>DOCUMENT INFO</span></div>
              <div className={`status-pill ${parsed.ok ? "valid" : "invalid"}`}>
                {parsed.ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                {parsed.ok ? "Valid JSON" : "Invalid JSON"}
              </div>
              {stats ? (
                <div className="info-list">
                  <InfoLine label="Keys" value={stats.keys} />
                  <InfoLine label="Objects" value={stats.objects} />
                  <InfoLine label="Arrays" value={stats.arrays} />
                  <InfoLine label="Strings" value={stats.strings} />
                  <InfoLine label="Numbers" value={stats.numbers} />
                  <InfoLine label="Booleans" value={stats.booleans} />
                  <InfoLine label="Max depth" value={stats.maxDepth} />
                  <InfoLine label="Size" value={humanBytes(stats.sizeBytes)} />
                </div>
              ) : (
                <p className="muted-copy">Fix the JSON syntax to unlock document analysis.</p>
              )}
            </aside>
          </div>

          {!parsed.ok && (
            <div className="error-card">
              <div className="error-icon"><X size={16} /></div>
              <div>
                <strong>JSON could not be parsed</strong>
                {parseDetails?.line && <p>Line {parseDetails.line} · Column {parseDetails.column}</p>}
                <code>{parsed.error}</code>
              </div>
            </div>
          )}

          {stats && (
            <div className="metrics-grid">
              <Metric label="Total Keys" value={stats.keys} />
              <Metric label="Objects" value={stats.objects} />
              <Metric label="Arrays" value={stats.arrays} />
              <Metric label="Max Depth" value={stats.maxDepth} />
              <Metric label="File Size" value={humanBytes(stats.sizeBytes)} />
            </div>
          )}
        </section>

        {value !== null && (
          <>
            <section id="explorer" className="section-block">
              <SectionHeading icon={<Search size={17} />} title="JSON Explorer" subtitle="Navigate nested data, search values, and copy exact JSONPath references." />
              <div className="split-grid">
                <div className="panel tree-panel">
                  <div className="panel-top"><span>TREE EXPLORER</span></div>
                  <label className="search-box"><Search size={15} /><input value={treeQuery} onChange={(e) => setTreeQuery(e.target.value)} placeholder="Search keys or values..." /></label>
                  <div className="tree-scroll"><JsonTree value={value} query={treeQuery} onSelect={setSelected} /></div>
                </div>
                <div className="panel selected-panel">
                  <div className="panel-top"><span>SELECTED VALUE</span></div>
                  {selected ? (
                    <div className="selected-content">
                      <Field label="Value"><code className="value-preview">{stringifyBrief(selected.value)}</code></Field>
                      <Field label="Type"><span className="soft-tag">{getType(selected.value)}</span></Field>
                      <Field label="JSONPath">
                        <div className="copy-field"><code>{selected.path}</code><button onClick={() => flashCopy("path", selected.path)}>{copied === "path" ? <Check size={14} /> : <Clipboard size={14} />}{copied === "path" ? "Copied" : "Copy path"}</button></div>
                      </Field>
                      <Field label="Parent"><code>{selected.parent}</code></Field>
                      <Field label="Depth"><span>{selected.depth}</span></Field>
                    </div>
                  ) : <div className="empty-state"><Search size={22} /><p>Select any node in the tree to inspect it.</p></div>}
                </div>
              </div>

              <div className="panel structure-panel">
                <div className="panel-top"><span>DETECTED STRUCTURE</span><span>{structure.length} paths</span></div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Path</th><th>Type</th><th>Example</th></tr></thead>
                    <tbody>{structure.map((row) => <tr key={row.path}><td><code>{row.path}</code></td><td><span className="soft-tag">{row.type}</span></td><td className="example-cell">{row.example}</td></tr>)}</tbody>
                  </table>
                </div>
              </div>
            </section>

            <section id="schema" className="section-block">
              <SectionHeading icon={<ShieldCheck size={17} />} title="JSON Schema" subtitle="Generate a contract from your document and validate another payload against it." />
              <div className="split-grid">
                <div className="panel">
                  <div className="panel-top"><span>GENERATED SCHEMA</span></div>
                  <pre className="code-output tall-output">{schemaText}</pre>
                  <div className="button-row panel-actions">
                    <button className="secondary-button" onClick={() => flashCopy("schema", schemaText)}>{copied === "schema" ? <Check size={15} /> : <Clipboard size={15} />} {copied === "schema" ? "Copied" : "Copy schema"}</button>
                    <button className="secondary-button" onClick={() => downloadText("schema.json", schemaText, "application/json")}><Download size={15} /> Download</button>
                  </div>
                </div>
                <div className="panel">
                  <div className="panel-top"><span>TEST PAYLOAD</span></div>
                  <textarea className="code-editor schema-editor" value={testPayload} onChange={(e) => setTestPayload(e.target.value)} spellCheck={false} />
                  <div className="button-row panel-actions"><button className="primary-button" onClick={validateSchemaPayload}><ShieldCheck size={15} /> Validate payload</button></div>
                </div>
              </div>
              {schemaResult && (
                <div className={`validation-card ${schemaResult.ok ? "success" : "failure"}`}>
                  {schemaResult.ok ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                  <div><strong>{schemaResult.ok ? "Payload matches the generated schema" : `${schemaResult.messages.length} validation issue${schemaResult.messages.length === 1 ? "" : "s"}`}</strong>{!schemaResult.ok && <ul>{schemaResult.messages.map((message) => <li key={message}>{message}</li>)}</ul>}</div>
                </div>
              )}
            </section>

            <section id="compare" className="section-block">
              <SectionHeading icon={<GitCompareArrows size={17} />} title="JSON Compare" subtitle="Compare two payloads and surface added, removed, and changed values." />
              <div className="compare-grid">
                <div className="panel"><div className="panel-top"><span>JSON A</span></div><textarea className="code-editor compare-editor" value={diffA} onChange={(e) => setDiffA(e.target.value)} spellCheck={false} /></div>
                <div className="panel"><div className="panel-top"><span>JSON B</span></div><textarea className="code-editor compare-editor" value={diffB} onChange={(e) => setDiffB(e.target.value)} spellCheck={false} /></div>
              </div>
              <div className="center-action"><button className="primary-button" onClick={compare}><GitCompareArrows size={15} /> Compare JSON</button></div>
              <div className="panel diff-panel">
                <div className="panel-top"><span>DIFFERENCES</span><span>{diffRows.length} total</span></div>
                {diffRows.length ? (
                  <div className="diff-list">
                    {diffRows.map((row, index) => <DiffItem row={row} key={`${row.path}-${index}`} />)}
                  </div>
                ) : <div className="empty-state compact"><GitCompareArrows size={20} /><p>Run a comparison to see structural changes.</p></div>}
              </div>
              {diffRows.length > 0 && <div className="diff-summary"><DiffCount label="Added" count={diffRows.filter((d) => d.kind === "added").length} tone="added" /><DiffCount label="Changed" count={diffRows.filter((d) => d.kind === "changed").length} tone="changed" /><DiffCount label="Removed" count={diffRows.filter((d) => d.kind === "removed").length} tone="removed" /></div>}
            </section>

            <section id="typescript" className="section-block">
              <SectionHeading icon={<Code2 size={17} />} title="TypeScript Generator" subtitle="Turn your JSON shape into ready-to-use TypeScript interfaces." />
              <div className="generator-header"><label>Root type name<input value={rootName} onChange={(e) => setRootName(e.target.value)} /></label></div>
              <div className="panel"><div className="panel-top"><span>GENERATED TYPES</span></div><pre className="code-output types-output">{tsText}</pre><div className="button-row panel-actions"><button className="secondary-button" onClick={() => flashCopy("types", tsText)}>{copied === "types" ? <Check size={15} /> : <Clipboard size={15} />} {copied === "types" ? "Copied" : "Copy TypeScript"}</button><button className="secondary-button" onClick={() => downloadText("types.ts", tsText, "text/typescript")}><Download size={15} /> Download .ts</button></div></div>
            </section>

            <section id="export" className="section-block">
              <SectionHeading icon={<Download size={17} />} title="Export & Transform" subtitle="Copy or download the representation you need without sending your document anywhere." />
              <div className="panel formatted-panel">
                <div className="panel-top"><span>FORMATTED OUTPUT</span></div>
                <pre className="code-output formatted-output">{formatted}</pre>
                <div className="button-row panel-actions wrap-actions">
                  <button className="secondary-button" onClick={() => flashCopy("json", formatted)}>{copied === "json" ? <Check size={15} /> : <Clipboard size={15} />} {copied === "json" ? "Copied" : "Copy JSON"}</button>
                  <button className="secondary-button" onClick={() => flashCopy("minified", minifyJson(value))}><Clipboard size={15} /> Copy minified</button>
                  <button className="secondary-button" onClick={() => downloadText("formatted.json", formatted, "application/json")}><Download size={15} /> Download JSON</button>
                  <button className="secondary-button" disabled={!csv} onClick={() => csv && downloadText("data.csv", csv, "text/csv")}><Download size={15} /> Convert to CSV</button>
                </div>
              </div>
              <div className="export-grid">
                <ExportCard icon={<FileJson size={18} />} title="JSON" description="Formatted JSON document" action="Download .json" onClick={() => downloadText("formatted.json", formatted, "application/json")} />
                <ExportCard icon={<Columns3 size={18} />} title="CSV" description={csv ? "Flat object or array export" : "Requires a flat object/array"} action="Download .csv" disabled={!csv} onClick={() => csv && downloadText("data.csv", csv, "text/csv")} />
                <ExportCard icon={<Code2 size={18} />} title="TypeScript" description="Generated interfaces" action="Download .ts" onClick={() => downloadText("types.ts", tsText, "text/typescript")} />
                <ExportCard icon={<ShieldCheck size={18} />} title="JSON Schema" description="Generated schema contract" action="Download schema" onClick={() => downloadText("schema.json", schemaText, "application/json")} />
              </div>
            </section>
          </>
        )}

        <footer>
          <div className="privacy-note"><ShieldCheck size={16} /><span><strong>Private by design.</strong> Your JSON is processed locally in the browser and is never uploaded to a server.</span></div>
          <div className="footer-brand"><Braces size={15} /> JSON Analyzer · Browser-first developer tool</div>
        </footer>
      </div>
    </main>
  );
}

function SectionHeading({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return <div className="section-heading"><div className="section-title"><span className="section-icon">{icon}</span><h2>{title}</h2></div><p>{subtitle}</p></div>;
}

function InfoLine({ label, value }: { label: string; value: string | number }) {
  return <div className="info-line"><span>{label}</span><strong>{value}</strong></div>;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="metric-card"><span>{label}</span><strong>{value}</strong></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="field"><span className="field-label">{label}</span><div>{children}</div></div>;
}

function DiffItem({ row }: { row: DiffRow }) {
  const symbol = row.kind === "added" ? "+" : row.kind === "removed" ? "−" : "~";
  const detail = row.kind === "changed" ? `${stringifyBrief(row.before)} → ${stringifyBrief(row.after)}` : stringifyBrief(row.kind === "added" ? row.after : row.before);
  return <div className={`diff-row ${row.kind}`}><span className="diff-symbol">{symbol}</span><code>{row.path}</code><span className="diff-detail">{detail}</span><span className="diff-kind">{row.kind}</span></div>;
}

function DiffCount({ label, count, tone }: { label: string; count: number; tone: string }) {
  return <div className={`diff-count ${tone}`}><strong>{count}</strong><span>{label}</span></div>;
}

function ExportCard({ icon, title, description, action, onClick, disabled = false }: { icon: React.ReactNode; title: string; description: string; action: string; onClick: () => void; disabled?: boolean }) {
  return <div className="export-card"><div className="export-icon">{icon}</div><div><strong>{title}</strong><p>{description}</p></div><button disabled={disabled} onClick={onClick}>{action}<Download size={14} /></button></div>;
}
