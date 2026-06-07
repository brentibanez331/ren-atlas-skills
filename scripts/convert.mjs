#!/usr/bin/env node
// Atlas: a generic graph (nodes + edges) -> .excalidraw.md, laid out with dagre (no browser/DOM).
// Used by write-excalidraw (topology graph.json) AND map-flow (a flow-shaped graph for flowchart flows).
// Node coloring precedence: node.color -> FILL[node.kind] -> external -> manifest kind -> white.
// Flowchart-shaped graphs only; sequenceDiagram/classDiagram are a different layout model
// (use the in-plugin Mermaid-to-Excalidraw for those).
import fs from "node:fs";
import path from "node:path";
import dagre from "@dagrejs/dagre";

// ---- args ----
const args = Object.fromEntries(
  process.argv.slice(2).reduce((a, v, i, arr) => {
    if (v.startsWith("--")) a.push([v.slice(2), arr[i + 1]?.startsWith("--") || arr[i + 1] === undefined ? true : arr[i + 1]]);
    return a;
  }, [])
);
const graphPath = args.graph, manifestPath = args.manifest, outPath = args.out;
const force = !!args.force, title = args.title || "Architecture";
if (!graphPath || !outPath) { console.error("usage: convert.mjs --graph graph.json [--manifest manifest.json] --out file.excalidraw.md [--force]"); process.exit(2); }
if (fs.existsSync(outPath) && !force) { console.error(`REFUSE: ${outPath} exists. Pass --force only if the user explicitly asked to regenerate/update it.`); process.exit(3); }

const graph = JSON.parse(fs.readFileSync(graphPath, "utf8"));
const manifest = manifestPath && fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : { projects: [] };
const kindOf = Object.fromEntries((manifest.projects || []).map(p => [p.id, p.kind]));

// ---- design-system palette ----
const FILL = { app: "#a5d8ff", website: "#a5d8ff", mobile: "#a5d8ff", service: "#d0bfff", function: "#d0bfff", lib: "#e9ecef", tool: "#fff3bf", external: "#f1f3f5" };
const STROKE = "#1e1e1e", LABEL = "#495057", ASYNC = "#e8590c";
// node.color wins, then node.kind, then external, then manifest kind, then white.
// This lets map-flow color flow participants (which aren't manifest projects) directly.
const fillFor = n => n.color || FILL[n.kind] || (n.type === "external" ? FILL.external : (FILL[kindOf[n.id]] || "#ffffff"));
const labelOf = n => n.label || (manifest.projects.find(p => p.id === n.id)?.name) || n.id;

// ---- dagre layout ----
const g = new dagre.graphlib.Graph({ multigraph: true });
g.setGraph({ rankdir: "LR", nodesep: 60, ranksep: 130, marginx: 50, marginy: 50, edgesep: 30 });
g.setDefaultEdgeLabel(() => ({}));

const W = lbl => Math.max(150, Math.min(320, lbl.length * 8 + 28));
const H = 56;
for (const n of graph.nodes) g.setNode(n.id, { width: W(labelOf(n)), height: H });
graph.edges.forEach((e, i) => g.setEdge(e.from, e.to, { label: e.label || e.protocol, width: ((e.label || e.protocol).length * 7), height: 18, labelpos: "c" }, "e" + i));
dagre.layout(g);

// ---- build excalidraw elements ----
const elements = [];
const textIndex = []; // for ## Text Elements
const boundByRect = {}; // rectId -> [{id,type}]
let seed = 1;
const base = () => ({ angle: 0, strokeColor: STROKE, backgroundColor: "transparent", fillStyle: "solid", strokeWidth: 1, strokeStyle: "solid", roughness: 1, opacity: 100, groupIds: [], frameId: null, roundness: null, seed: seed++, version: 1, versionNonce: seed, isDeleted: false, boundElements: [], updated: 1, link: null, locked: false });

for (const n of graph.nodes) {
  const nd = g.node(n.id), rid = `rect-${n.id}`, tid = `text-${n.id}`;
  const x = nd.x - nd.width / 2, y = nd.y - nd.height / 2;
  boundByRect[rid] = [{ id: tid, type: "text" }];
  elements.push({ ...base(), type: "rectangle", id: rid, x, y, width: nd.width, height: nd.height, backgroundColor: fillFor(n), roundness: { type: 3 }, boundElements: boundByRect[rid] });
  const lbl = labelOf(n);
  elements.push({ ...base(), type: "text", id: tid, x: x + 8, y: y + nd.height / 2 - 12, width: nd.width - 16, height: 24, text: lbl, rawText: lbl, fontSize: 16, fontFamily: 2, textAlign: "center", verticalAlign: "middle", containerId: rid, originalText: lbl, lineHeight: 1.25 });
  textIndex.push(`${lbl} ^${tid}`);
}

graph.edges.forEach((e, i) => {
  const ek = { v: e.from, w: e.to, name: "e" + i };
  const ed = g.edge(ek);
  const pts = ed.points;
  const x0 = pts[0].x, y0 = pts[0].y;
  const aid = `arrow-${e.from}-${e.to}-${i}`, lid = `label-${e.from}-${e.to}-${i}`;
  const async = e.sync === "async";
  const arrow = { ...base(), type: "arrow", id: aid, x: x0, y: y0, width: Math.abs(pts.at(-1).x - x0), height: Math.abs(pts.at(-1).y - y0), strokeColor: async ? ASYNC : STROKE, strokeStyle: async ? "dashed" : "solid", roundness: { type: 2 }, points: pts.map(p => [p.x - x0, p.y - y0]), lastCommittedPoint: null, startBinding: { elementId: `rect-${e.from}`, focus: 0, gap: 4 }, endBinding: { elementId: `rect-${e.to}`, focus: 0, gap: 4 }, startArrowhead: null, endArrowhead: "arrow", boundElements: [{ id: lid, type: "text" }] };
  elements.push(arrow);
  boundByRect[`rect-${e.from}`]?.push({ id: aid, type: "arrow" });
  boundByRect[`rect-${e.to}`]?.push({ id: aid, type: "arrow" });
  const lbl = (e.label || e.protocol) + (async ? "" : "");
  const mid = pts[Math.floor(pts.length / 2)];
  elements.push({ ...base(), type: "text", id: lid, x: mid.x - lbl.length * 3.5, y: mid.y - 10, width: lbl.length * 7, height: 20, strokeColor: async ? ASYNC : LABEL, text: lbl, rawText: lbl, fontSize: 14, fontFamily: 2, textAlign: "center", verticalAlign: "middle", containerId: aid, originalText: lbl, lineHeight: 1.25 });
  textIndex.push(`${lbl} ^${lid}`);
});

// ---- envelope ----
const scene = { type: "excalidraw", version: 2, source: "https://github.com/zsviczian/obsidian-excalidraw-plugin", elements, appState: { gridSize: null, viewBackgroundColor: "#ffffff" }, files: {} };
const md = `---
excalidraw-plugin: parsed
tags: [excalidraw]
---
==⚠  Switch to EXCALIDRAW VIEW in the MORE OPTIONS menu of this document. ⚠== You can decompress Drawing data with the command palette: 'Decompress current Excalidraw file'.

# Excalidraw Data

## Text Elements
${textIndex.join("\n")}

%%
## Drawing
\`\`\`json
${JSON.stringify(scene, null, 1)}
\`\`\`
%%
`;
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, md);
console.error(`OK wrote ${outPath} — ${graph.nodes.length} nodes, ${graph.edges.length} edges`);
