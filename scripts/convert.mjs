#!/usr/bin/env node
// Atlas: a graph spec -> .excalidraw.md, in Node with no browser/DOM (the "option 5" path).
// Two modes via --type:
//   flowchart (default): { nodes:[{id,label,kind|color|type}], edges:[{from,to,label,sync}] }
//                        laid out with dagre. Used by write-excalidraw (topology) and
//                        map-flow (flowchart flows).
//   sequence:            { participants:[{id,label,kind|color}], messages:[{from,to,label,sync}] }
//                        deterministic lifelines + timed message arrows (no dagre, no browser).
//                        Used by map-flow for sequenceDiagram flows.
// classDiagram is intentionally NOT handled here (multi-line member boxes + relation arrowheads) —
// use the in-plugin Mermaid-to-Excalidraw for that.
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
const force = !!args.force, type = args.type || "flowchart";
if (!graphPath || !outPath) { console.error("usage: convert.mjs [--type flowchart|sequence] --graph spec.json [--manifest manifest.json] --out file.excalidraw.md [--force]"); process.exit(2); }
if (fs.existsSync(outPath) && !force) { console.error(`REFUSE: ${outPath} exists. Pass --force only if the user explicitly asked to regenerate/update it.`); process.exit(3); }

const spec = JSON.parse(fs.readFileSync(graphPath, "utf8"));
const manifest = manifestPath && fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : { projects: [] };
const kindOf = Object.fromEntries((manifest.projects || []).map(p => [p.id, p.kind]));

// ---- design-system palette ----
const FILL = { app: "#a5d8ff", website: "#a5d8ff", mobile: "#a5d8ff", service: "#d0bfff", function: "#d0bfff", lib: "#e9ecef", tool: "#fff3bf", external: "#f1f3f5" };
const STROKE = "#1e1e1e", LABEL = "#495057", ASYNC = "#e8590c", LIFELINE = "#adb5bd";
// node.color wins, then node.kind, then external, then manifest kind, then white.
const fillFor = n => n.color || FILL[n.kind] || (n.type === "external" ? FILL.external : (FILL[kindOf[n.id]] || "#ffffff"));
const labelOf = n => n.label || (manifest.projects.find(p => p.id === n.id)?.name) || n.id;

const elements = [];
const textIndex = []; // for ## Text Elements
let seed = 1;
const base = () => ({ angle: 0, strokeColor: STROKE, backgroundColor: "transparent", fillStyle: "solid", strokeWidth: 1, strokeStyle: "solid", roughness: 1, opacity: 100, groupIds: [], frameId: null, roundness: null, seed: seed++, version: 1, versionNonce: seed, isDeleted: false, boundElements: [], updated: 1, link: null, locked: false });

// ---- flowchart mode (dagre) ----
function buildFlowchart(graph) {
  const boundByRect = {};
  const g = new dagre.graphlib.Graph({ multigraph: true });
  g.setGraph({ rankdir: "LR", nodesep: 60, ranksep: 130, marginx: 50, marginy: 50, edgesep: 30 });
  g.setDefaultEdgeLabel(() => ({}));
  const W = lbl => Math.max(150, Math.min(320, lbl.length * 8 + 28)), H = 56;
  for (const n of graph.nodes) g.setNode(n.id, { width: W(labelOf(n)), height: H });
  graph.edges.forEach((e, i) => g.setEdge(e.from, e.to, { label: e.label || e.protocol, width: (e.label || e.protocol).length * 7, height: 18, labelpos: "c" }, "e" + i));
  dagre.layout(g);

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
    const ed = g.edge({ v: e.from, w: e.to, name: "e" + i }), pts = ed.points;
    const x0 = pts[0].x, y0 = pts[0].y, aid = `arrow-${e.from}-${e.to}-${i}`, lid = `label-${e.from}-${e.to}-${i}`;
    const async = e.sync === "async";
    elements.push({ ...base(), type: "arrow", id: aid, x: x0, y: y0, width: Math.abs(pts.at(-1).x - x0), height: Math.abs(pts.at(-1).y - y0), strokeColor: async ? ASYNC : STROKE, strokeStyle: async ? "dashed" : "solid", roundness: { type: 2 }, points: pts.map(p => [p.x - x0, p.y - y0]), lastCommittedPoint: null, startBinding: { elementId: `rect-${e.from}`, focus: 0, gap: 4 }, endBinding: { elementId: `rect-${e.to}`, focus: 0, gap: 4 }, startArrowhead: null, endArrowhead: "arrow", boundElements: [{ id: lid, type: "text" }] });
    boundByRect[`rect-${e.from}`]?.push({ id: aid, type: "arrow" });
    boundByRect[`rect-${e.to}`]?.push({ id: aid, type: "arrow" });
    const lbl = e.label || e.protocol, mid = pts[Math.floor(pts.length / 2)];
    elements.push({ ...base(), type: "text", id: lid, x: mid.x - lbl.length * 3.5, y: mid.y - 10, width: lbl.length * 7, height: 20, strokeColor: async ? ASYNC : LABEL, text: lbl, rawText: lbl, fontSize: 14, fontFamily: 2, textAlign: "center", verticalAlign: "middle", containerId: aid, originalText: lbl, lineHeight: 1.25 });
    textIndex.push(`${lbl} ^${lid}`);
  });
  return `${graph.nodes.length} nodes, ${graph.edges.length} edges`;
}

// ---- sequence mode (deterministic: lifelines + timed arrows, no dagre) ----
function buildSequence(s) {
  const P = s.participants || [], M = s.messages || [];
  const idx = Object.fromEntries(P.map((p, i) => [p.id, i]));
  const MARGIN = 50, PH = 48, GAPTOP = 48, ROW = 64, BOTTOMPAD = 40;
  const colW = Math.max(190, ...P.map(p => (p.label || p.id).length * 9 + 50));
  const PW = colW - 50;
  const colX = i => MARGIN + i * colW + colW / 2;          // lifeline / column center x
  const firstY = MARGIN + PH + GAPTOP;
  const bottomY = firstY + Math.max(0, M.length - 1) * ROW + BOTTOMPAD;

  P.forEach((p, i) => {
    const cx = colX(i), x = cx - PW / 2, gid = `grp-${p.id}`;
    const rid = `rect-${p.id}`, tid = `text-${p.id}`, lid = `life-${p.id}`;
    elements.push({ ...base(), type: "rectangle", id: rid, x, y: MARGIN, width: PW, height: PH, backgroundColor: fillFor(p), roundness: { type: 3 }, groupIds: [gid], boundElements: [{ id: tid, type: "text" }] });
    const lbl = p.label || p.id;
    elements.push({ ...base(), type: "text", id: tid, x: x + 6, y: MARGIN + PH / 2 - 12, width: PW - 12, height: 24, text: lbl, rawText: lbl, fontSize: 15, fontFamily: 2, textAlign: "center", verticalAlign: "middle", containerId: rid, originalText: lbl, lineHeight: 1.25, groupIds: [gid] });
    // lifeline: vertical dashed line under the header (grouped with it so they move together)
    elements.push({ ...base(), type: "line", id: lid, x: cx, y: MARGIN + PH, width: 0, height: bottomY - (MARGIN + PH), strokeColor: LIFELINE, strokeStyle: "dashed", points: [[0, 0], [0, bottomY - (MARGIN + PH)]], lastCommittedPoint: null, startBinding: null, endBinding: null, startArrowhead: null, endArrowhead: null, groupIds: [gid] });
    textIndex.push(`${lbl} ^${tid}`);
  });

  M.forEach((m, j) => {
    const si = idx[m.from], ti = idx[m.to];
    if (si === undefined || ti === undefined) return;       // skip messages to unknown participants
    const y = firstY + j * ROW, async = m.sync === "async", aid = `msg-${j}`, lid = `msglabel-${j}`;
    const lbl = m.label || "";
    const col = async ? ASYNC : STROKE;
    if (m.from === m.to) {                                   // self-message: small loop to the right
      const cx = colX(si), loopW = 46, dy = 26;
      elements.push({ ...base(), type: "arrow", id: aid, x: cx, y, width: loopW, height: dy, strokeColor: col, strokeStyle: async ? "dashed" : "solid", roundness: { type: 2 }, points: [[0, 0], [loopW, 0], [loopW, dy], [0, dy]], lastCommittedPoint: null, startBinding: null, endBinding: null, startArrowhead: null, endArrowhead: "arrow", boundElements: [] });
      if (lbl) { elements.push({ ...base(), type: "text", id: lid, x: cx + loopW + 8, y: y + dy / 2 - 9, width: lbl.length * 7, height: 18, strokeColor: async ? ASYNC : LABEL, text: lbl, rawText: lbl, fontSize: 13, fontFamily: 2, textAlign: "left", verticalAlign: "middle", containerId: null, originalText: lbl, lineHeight: 1.25 }); textIndex.push(`${lbl} ^${lid}`); }
      return;
    }
    const x0 = colX(si), x1 = colX(ti);
    elements.push({ ...base(), type: "arrow", id: aid, x: x0, y, width: x1 - x0, height: 0, strokeColor: col, strokeStyle: async ? "dashed" : "solid", roundness: null, points: [[0, 0], [x1 - x0, 0]], lastCommittedPoint: null, startBinding: null, endBinding: null, startArrowhead: null, endArrowhead: "arrow", boundElements: lbl ? [{ id: lid, type: "text" }] : [] });
    if (lbl) {                                               // label bound to the arrow (Excalidraw centers it on the line)
      const mx = (x0 + x1) / 2;
      elements.push({ ...base(), type: "text", id: lid, x: mx - lbl.length * 3.4, y: y - 20, width: lbl.length * 7, height: 18, strokeColor: async ? ASYNC : LABEL, text: lbl, rawText: lbl, fontSize: 13, fontFamily: 2, textAlign: "center", verticalAlign: "middle", containerId: aid, originalText: lbl, lineHeight: 1.25 });
      textIndex.push(`${lbl} ^${lid}`);
    }
  });
  return `${P.length} participants, ${M.length} messages`;
}

// ---- dispatch ----
let summary;
if (type === "sequence") {
  if (!Array.isArray(spec.participants)) { console.error("ERROR: --type sequence needs { participants:[...], messages:[...] }"); process.exit(2); }
  summary = buildSequence(spec);
} else {
  if (!Array.isArray(spec.nodes)) { console.error("ERROR: --type flowchart needs { nodes:[...], edges:[...] }"); process.exit(2); }
  summary = buildFlowchart(spec);
}

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
console.error(`OK wrote ${outPath} (${type}) — ${summary}`);
