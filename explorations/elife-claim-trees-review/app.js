/* eslint-disable */
'use strict';

// ── Palette (matches the conceptual-schema diagram) ────────────────────
// yellow = Question · green = Claim/Hypothesis · coral = Evidence · off-white = Source
const ROLE_COLORS = {
  empirical: '#e8645a',          // coral — Evidence
  hypothesis: '#5fb85f',         // deep green — strongest claim
  prediction: '#a8e0a3',         // light green — derived claim
  interpretation: '#7dcc7d',     // canonical green — meta-claim
  scope: '#d8c170',              // muted yellow — qualification
  'literature-context': '#e8e8e8', // off-white — Source-like
};

const DG_TYPE_COLORS = {
  Claim: '#7dcc7d',     // green
  Evidence: '#e8645a',  // coral
  Source: '#e8e8e8',    // off-white
};

// Edge colors keyed by relation type token (last path segment / qname tail)
const EDGE_COLORS = {
  'claimrel:tests': '#7dcc7d',
  'claimrel:entails': '#5fb85f',
  'claimrel:interprets': '#e07ad1',
  'claimrel:scopes': '#d8c170',
  'cito:disagreesWith': '#e8645a',
  'cito:citesAsSourceDocument': '#9aa3b3',
  // DG-normalized predicates
  supports: '#7dcc7d',
  opposedBy: '#e8645a',
  interpretedAs: '#e07ad1',
};

// ── Utilities ──────────────────────────────────────────────────────────
const DG_NS = 'https://discoursegraphs.org/ontology#';
const BIBO_DOI = 'http://purl.org/ontology/bibo/doi';

const stripNs = (iri) => (iri || '').replace(DG_NS, '').replace(/^.*[#/]/, '');
const lastPath = (iri) => (iri || '').split('/').filter(Boolean).pop();
const truncate = (s, n = 90) =>
  !s ? '' : s.length <= n ? s : s.slice(0, n - 1) + '…';

const escapeHtml = (s) =>
  (s == null ? '' : String(s))
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// ── Build canonical view models from the raw data ──────────────────────

// Each OXA claim → node; each .relations entry → edge.
function buildOxaModel(oxa) {
  const nodes = oxa.children.map((c) => ({
    id: c.identifier,
    role: c.role,
    epistemicStrength: c.epistemicStrength,
    text: (c.children && c.children[0] && c.children[0].value) || '',
    displayClaim: c.metadata && c.metadata.displayClaim,
    shortClaim: c.metadata && c.metadata.shortClaim,
    concepts: (c.metadata && c.metadata.concepts) || [],
    panel: c.panel || (c.metadata && c.metadata.panel) || null,
    uuid: c.metadata && c.metadata.uuid,
    doi: c.metadata && c.metadata.doi,
    raw: c,
  }));
  const nodeIds = new Set(nodes.map((n) => n.id));

  const edges = [];
  const dropped = [];
  for (const c of oxa.children) {
    for (const r of c.relations || []) {
      if (r.xref === '*' || !nodeIds.has(r.xref)) {
        dropped.push({
          source: c.identifier,
          target: r.xref,
          relationType: r.relationType,
          reason: r.xref === '*' ? 'wildcard target (whole-paper scope)' : 'unresolved target id',
        });
        continue;
      }
      edges.push({
        source: c.identifier,
        target: r.xref,
        relationType: r.relationType,
      });
    }
  }
  return { nodes, edges, dropped, meta: oxa.metadata, identifier: oxa.identifier };
}

// JSON-LD: entity nodes (Claim/Evidence/Source) + reified Relation objects → edges
function buildJsonldModel(jld) {
  const graph = jld['@graph'] || [];
  const entities = [];
  const relationObjs = [];

  for (const node of graph) {
    const t = stripNs(node['@type']);
    if (t === 'Relation') {
      relationObjs.push(node);
    } else {
      entities.push({
        id: node['@id'],
        type: t,
        content: node[DG_NS + 'content'],
        role: node[DG_NS + 'role'],
        epistemicStrength: node[DG_NS + 'epistemicStrength'],
        panel: node[DG_NS + 'panel'] || null,
        authors: node[DG_NS + 'authors'] || null,
        doi: node[BIBO_DOI] || null,
        raw: node,
      });
    }
  }

  const edges = relationObjs.map((r, i) => {
    const src = r[DG_NS + 'source'] && r[DG_NS + 'source']['@id'];
    const tgt = r[DG_NS + 'target'] && r[DG_NS + 'target']['@id'];
    return {
      id: 'rel-' + i,
      source: src,
      target: tgt,
      relationType: stripNs(r[DG_NS + 'relationType']),
      originalRelationType: r[DG_NS + 'originalRelationType'],
    };
  });

  return { nodes: entities, edges, raw: jld };
}

// TTL: extract per-property metadata + count usage from OXA data
function buildTtlModel(ttlText, oxa) {
  // Find each block "claimrel:name a owl:ObjectProperty ; ... ."
  const blocks = ttlText.split(/\n(?=claimrel:\w+\s*\n\s*a owl:ObjectProperty)/g);
  const props = [];
  for (const b of blocks) {
    const nameMatch = b.match(/claimrel:(\w+)\s*\n\s*a owl:ObjectProperty/);
    if (!nameMatch) continue;
    const name = nameMatch[1];
    const parentMatch = b.match(/rdfs:subPropertyOf\s+(cito:\w+)/);
    const labelMatch = b.match(/rdfs:label\s+"([^"]+)"/);
    const commentMatch = b.match(/rdfs:comment\s+"([^"]+)"/);
    props.push({
      qname: 'claimrel:' + name,
      name,
      parent: parentMatch ? parentMatch[1] : null,
      label: labelMatch ? labelMatch[1] : name,
      comment: commentMatch ? commentMatch[1] : '',
    });
  }

  // Count usage in OXA edges + report cito:* parents and how often they appear directly
  const usage = {};
  for (const c of oxa.children) {
    for (const r of c.relations || []) {
      usage[r.relationType] = (usage[r.relationType] || 0) + 1;
    }
  }

  // Group by parent
  const byParent = {};
  for (const p of props) {
    const par = p.parent || '(no parent)';
    (byParent[par] = byParent[par] || []).push({
      ...p,
      usage: usage[p.qname] || 0,
    });
  }

  // Add cito parents themselves as their own "parent buckets" and count direct usage
  const directlyUsedCito = Object.keys(usage).filter((k) => k.startsWith('cito:'));
  for (const c of directlyUsedCito) {
    byParent[c] = byParent[c] || [];
  }

  return { props, byParent, usage, directlyUsedCito };
}

// ── Cytoscape stylesheets ──────────────────────────────────────────────
function oxaStylesheet() {
  return [
    {
      selector: 'node',
      style: {
        'background-color': (ele) => ROLE_COLORS[ele.data('role')] || '#888',
        label: (ele) =>
          truncate(ele.data('shortClaim') || ele.data('displayClaim') || ele.data('id'), 40),
        'font-size': 9,
        color: '#cdd3df',
        'text-wrap': 'wrap',
        'text-max-width': 140,
        'text-valign': 'bottom',
        'text-margin-y': 4,
        width: (ele) =>
          14 + (ele.data('relCount') || 0) * 3,
        height: (ele) =>
          14 + (ele.data('relCount') || 0) * 3,
        'border-width': 1,
        'border-color': '#0b0d11',
      },
    },
    {
      selector: 'node:selected',
      style: {
        'border-width': 3,
        'border-color': '#fff',
      },
    },
    {
      selector: 'edge',
      style: {
        width: 1.2,
        'line-color': (ele) => EDGE_COLORS[ele.data('relationType')] || '#555',
        'target-arrow-color': (ele) => EDGE_COLORS[ele.data('relationType')] || '#555',
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
        'arrow-scale': 0.8,
        opacity: 0.7,
      },
    },
    {
      selector: 'edge:selected',
      style: {
        width: 2.5,
        opacity: 1,
      },
    },
    {
      selector: '.faded',
      style: {
        opacity: 0.12,
      },
    },
  ];
}

function jsonldStylesheet() {
  return [
    {
      selector: 'node',
      style: {
        'background-color': (ele) => DG_TYPE_COLORS[ele.data('type')] || '#888',
        shape: (ele) =>
          ele.data('type') === 'Source'
            ? 'diamond'
            : ele.data('type') === 'Evidence'
            ? 'round-rectangle'
            : 'ellipse',
        label: (ele) => truncate(ele.data('label'), 40),
        'font-size': 9,
        color: '#cdd3df',
        'text-wrap': 'wrap',
        'text-max-width': 140,
        'text-valign': 'bottom',
        'text-margin-y': 4,
        width: (ele) => 14 + (ele.data('relCount') || 0) * 3,
        height: (ele) => 14 + (ele.data('relCount') || 0) * 3,
        'border-width': 1,
        'border-color': '#0b0d11',
      },
    },
    {
      selector: 'node:selected',
      style: { 'border-width': 3, 'border-color': '#fff' },
    },
    {
      selector: 'edge',
      style: {
        width: 1.4,
        'line-color': (ele) => EDGE_COLORS[ele.data('relationType')] || '#555',
        'target-arrow-color': (ele) => EDGE_COLORS[ele.data('relationType')] || '#555',
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
        'arrow-scale': 0.8,
        opacity: 0.7,
        label: (ele) => ele.data('relationType') || '',
        'font-size': 8,
        color: '#8b95a7',
        'text-rotation': 'autorotate',
        'text-background-color': '#0f1115',
        'text-background-opacity': 0.85,
        'text-background-padding': 2,
      },
    },
    { selector: 'edge:selected', style: { width: 2.5, opacity: 1 } },
    { selector: '.faded', style: { opacity: 0.1 } },
  ];
}

// ── State + render ─────────────────────────────────────────────────────
const state = {
  oxa: null,
  jld: null,
  ttl: null,
  cy: null,
  view: 'oxa',
};

function initData() {
  state.oxa = buildOxaModel(window.OXA_DATA);
  state.jld = buildJsonldModel(window.JSONLD_DATA);
  state.ttl = buildTtlModel(window.TTL_TEXT, window.OXA_DATA);

  // Header
  document.getElementById('paper-title').textContent = state.oxa.meta.title;
  document.getElementById('paper-authors').textContent = state.oxa.meta.authors.join(', ');
  document.getElementById('paper-doi').textContent = 'DOI: ' + state.oxa.meta.doi;
  document.getElementById('paper-doi').href = 'https://doi.org/' + state.oxa.meta.doi;

  // Tab counts
  document.getElementById('count-oxa').textContent =
    state.oxa.nodes.length + ' / ' + state.oxa.edges.length;
  document.getElementById('count-jld').textContent =
    state.jld.nodes.length + ' / ' + state.jld.edges.length;
  document.getElementById('count-ttl').textContent = state.ttl.props.length;
}

function destroyCy() {
  if (state.cy) {
    state.cy.destroy();
    state.cy = null;
  }
}

function renderOxaView() {
  destroyCy();
  document.getElementById('cy').classList.remove('hidden');
  document.getElementById('ttl-view').classList.add('hidden');

  const { nodes, edges } = state.oxa;
  const degree = {};
  for (const e of edges) {
    degree[e.source] = (degree[e.source] || 0) + 1;
    degree[e.target] = (degree[e.target] || 0) + 1;
  }

  const cyNodes = nodes.map((n) => ({
    data: {
      id: n.id,
      role: n.role,
      shortClaim: n.shortClaim,
      displayClaim: n.displayClaim,
      relCount: degree[n.id] || 0,
    },
  }));
  const cyEdges = edges.map((e, i) => ({
    data: {
      id: 'e' + i,
      source: e.source,
      target: e.target,
      relationType: e.relationType,
    },
  }));

  state.cy = cytoscape({
    container: document.getElementById('cy'),
    elements: [...cyNodes, ...cyEdges],
    style: oxaStylesheet(),
    layout: {
      name: 'cose',
      animate: false,
      idealEdgeLength: 110,
      nodeRepulsion: 12000,
      gravity: 0.25,
      padding: 30,
    },
    wheelSensitivity: 0.2,
  });

  state.cy.on('tap', 'node', (evt) => showOxaNode(evt.target.data('id')));
  state.cy.on('tap', 'edge', (evt) => showOxaEdge(evt.target.data()));
  state.cy.on('tap', (evt) => {
    if (evt.target === state.cy) clearSidebar();
  });

  renderOxaLegend();
  renderOxaDiff();
}

function renderJsonldView() {
  destroyCy();
  document.getElementById('cy').classList.remove('hidden');
  document.getElementById('ttl-view').classList.add('hidden');

  const { nodes, edges } = state.jld;
  const degree = {};
  for (const e of edges) {
    degree[e.source] = (degree[e.source] || 0) + 1;
    degree[e.target] = (degree[e.target] || 0) + 1;
  }

  const cyNodes = nodes.map((n) => ({
    data: {
      id: n.id,
      type: n.type,
      label: lastPath(n.id) || n.content || n.id,
      relCount: degree[n.id] || 0,
    },
  }));
  const cyEdges = edges.map((e) => ({
    data: {
      id: e.id,
      source: e.source,
      target: e.target,
      relationType: e.relationType,
      originalRelationType: e.originalRelationType,
    },
  }));

  state.cy = cytoscape({
    container: document.getElementById('cy'),
    elements: [...cyNodes, ...cyEdges],
    style: jsonldStylesheet(),
    layout: {
      name: 'cose',
      animate: false,
      idealEdgeLength: 120,
      nodeRepulsion: 13000,
      gravity: 0.22,
      padding: 30,
    },
    wheelSensitivity: 0.2,
  });

  state.cy.on('tap', 'node', (evt) => showJsonldNode(evt.target.data('id')));
  state.cy.on('tap', 'edge', (evt) => showJsonldEdge(evt.target.data()));
  state.cy.on('tap', (evt) => {
    if (evt.target === state.cy) clearSidebar();
  });

  renderJsonldLegend();
  renderJsonldDiff();
}

function renderTtlView() {
  destroyCy();
  document.getElementById('cy').classList.add('hidden');
  document.getElementById('ttl-view').classList.remove('hidden');

  const target = document.getElementById('ttl-view');
  const { props, byParent, usage } = state.ttl;

  // Build CiTO parent descriptions (hardcoded common ones since the TTL imports CiTO but doesn't define them)
  const parentInfo = {
    'cito:refutes': 'CiTO — citing entity refutes statements / methods / conclusions of cited entity.',
    'cito:confirms': 'CiTO — citing entity confirms findings of cited entity.',
    'cito:disagreesWith': 'CiTO — citing entity expresses disagreement with the cited entity.',
    'cito:cites': 'CiTO — generic citation predicate (root of most claim relations).',
    'cito:citesAsSourceDocument': 'CiTO — citing entity uses the cited entity as a source document.',
  };

  const parents = Object.keys(byParent).sort();
  const childrenHtml = parents
    .map((par) => {
      const directCount = usage[par] || 0;
      const sub = byParent[par]
        .sort((a, b) => b.usage - a.usage)
        .map(
          (p) => `
        <div class="ttl-child" data-prop="${escapeHtml(p.qname)}">
          <div class="child-name">${escapeHtml(p.qname)}</div>
          <div class="child-label">${escapeHtml(p.label)}</div>
          <div class="child-usage ${p.usage > 0 ? 'used' : 'unused'}">
            ${p.usage > 0 ? 'Used ' + p.usage + '× in Headley' : 'Not used in Headley'}
          </div>
        </div>`
        )
        .join('');
      return `
      <div class="ttl-parent">
        <div class="parent-name">${escapeHtml(par)}${
        directCount ? ` <span style="color:var(--muted);font-weight:400;">(directly used ${directCount}× in OXA)</span>` : ''
      }</div>
        <div class="parent-desc">${escapeHtml(parentInfo[par] || '')}</div>
        ${sub ? `<div class="ttl-children">${sub}</div>` : ''}
      </div>`;
    })
    .join('');

  target.innerHTML = `
    <h2>Claim Relations Vocabulary (TTL)</h2>
    <div class="summary">
      8 OWL ObjectProperties extending CiTO, each declared as a <code>rdfs:subPropertyOf</code> a CiTO predicate so SPARQL queries against CiTO still see them.
      Usage counts below come from <code>headley.oxa.json</code>.
    </div>
    <div class="ttl-tree">${childrenHtml}</div>
    ${reviewNotesHtml()}
  `;

  target.querySelectorAll('.ttl-child').forEach((el) => {
    el.addEventListener('click', () => showTtlProp(el.dataset.prop));
  });
  target.querySelector('.review-notes')?.scrollIntoView; // no-op, just keep ref
}

// ── Legends ───────────────────────────────────────────────────────────
function renderOxaLegend() {
  const { nodes, edges } = state.oxa;
  const roleCounts = {};
  for (const n of nodes) roleCounts[n.role] = (roleCounts[n.role] || 0) + 1;
  const edgeCounts = {};
  for (const e of edges) edgeCounts[e.relationType] = (edgeCounts[e.relationType] || 0) + 1;

  const roleRows = Object.entries(roleCounts)
    .sort((a, b) => b[1] - a[1])
    .map(
      ([r, c]) =>
        `<div class="legend-row"><span class="legend-swatch" style="background:${ROLE_COLORS[r] || '#888'}"></span>${escapeHtml(r)}<span class="legend-count">${c}</span></div>`
    )
    .join('');
  const edgeRows = Object.entries(edgeCounts)
    .sort((a, b) => b[1] - a[1])
    .map(
      ([t, c]) =>
        `<div class="legend-row"><span class="legend-swatch line" style="background:${EDGE_COLORS[t] || '#555'}"></span><code style="font-size:11px;">${escapeHtml(t)}</code><span class="legend-count">${c}</span></div>`
    )
    .join('');
  document.getElementById('legend').innerHTML = `
    <h4>OXA: Node role</h4>
    ${roleRows}
    <h4 style="margin-top:10px">OXA: Relation type</h4>
    ${edgeRows}
  `;
}

function renderJsonldLegend() {
  const { nodes, edges } = state.jld;
  const typeCounts = {};
  for (const n of nodes) typeCounts[n.type] = (typeCounts[n.type] || 0) + 1;
  const predCounts = {};
  for (const e of edges) predCounts[e.relationType] = (predCounts[e.relationType] || 0) + 1;

  const typeRows = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .map(
      ([t, c]) =>
        `<div class="legend-row"><span class="legend-swatch" style="background:${DG_TYPE_COLORS[t] || '#888'}"></span>${escapeHtml(t)}<span class="legend-count">${c}</span></div>`
    )
    .join('');
  const predRows = Object.entries(predCounts)
    .sort((a, b) => b[1] - a[1])
    .map(
      ([t, c]) =>
        `<div class="legend-row"><span class="legend-swatch line" style="background:${EDGE_COLORS[t] || '#555'}"></span><code style="font-size:11px;">dg:${escapeHtml(t)}</code><span class="legend-count">${c}</span></div>`
    )
    .join('');
  document.getElementById('legend').innerHTML = `
    <h4>DG JSON-LD: Node type</h4>
    ${typeRows}
    <h4 style="margin-top:10px">DG JSON-LD: relationType</h4>
    ${predRows}
  `;
}

// ── Diff panes ─────────────────────────────────────────────────────────
function renderOxaDiff() {
  const o = state.oxa;
  const j = state.jld;
  document.getElementById('diff').innerHTML = `
    <h4>OXA vs DG JSON-LD</h4>
    <div class="item"><span class="num">${o.nodes.length}</span> Claim nodes in OXA → <span class="num">${j.nodes.length}</span> entity nodes in DG</div>
    <div class="item"><span class="num">${o.edges.length}</span> relations in OXA → <span class="num">${j.edges.length}</span> Relation objects in DG</div>
    <div class="item warn">⚠ <span class="num">${o.dropped.length}</span> OXA relations dropped from DG export</div>
    <div class="item"><span class="num">${o.nodes.filter((n) => n.concepts.length).length}</span> claims carry <code>metadata.concepts</code> (lost in DG)</div>
    <div class="item"><span class="num">${o.nodes.filter((n) => n.displayClaim).length}</span> claims carry <code>displayClaim</code> (lost in DG)</div>
  `;
}

function renderJsonldDiff() {
  const o = state.oxa;
  const j = state.jld;
  const typeCounts = {};
  for (const n of j.nodes) typeCounts[n.type] = (typeCounts[n.type] || 0) + 1;

  const roleToType = {};
  for (const n of j.nodes) {
    const k = n.role || '(no role)';
    if (!roleToType[k]) roleToType[k] = new Set();
    roleToType[k].add(n.type);
  }

  const mapRows = Object.entries(roleToType)
    .map(([r, ts]) => `<div class="item">role <code>${escapeHtml(r)}</code> → ${[...ts].join(', ')}</div>`)
    .join('');

  document.getElementById('diff').innerHTML = `
    <h4>DG JSON-LD: role → type mapping</h4>
    ${mapRows}
    <h4 style="margin-top:10px">Lost from OXA</h4>
    <div class="item warn">⚠ <code>metadata.concepts</code>, <code>displayClaim</code>, <code>shortClaim</code>, <code>uuid</code> on all nodes</div>
    <div class="item warn">⚠ <span class="num">${o.dropped.length}</span> <code>claimrel:scopes</code> edges with <code>xref:"*"</code> (whole-paper scope) — silently dropped</div>
  `;
}

// ── Sidebar render ─────────────────────────────────────────────────────
function clearSidebar() {
  document.getElementById('sidebar').innerHTML =
    '<div class="empty">Click a node or edge to inspect.</div>';
}

function showOxaNode(id) {
  const n = state.oxa.nodes.find((x) => x.id === id);
  if (!n) return clearSidebar();
  const outgoing = state.oxa.edges.filter((e) => e.source === id);
  const incoming = state.oxa.edges.filter((e) => e.target === id);
  const droppedOut = state.oxa.dropped.filter((e) => e.source === id);

  const relRow = (r, dir) => {
    const otherId = dir === 'out' ? r.target : r.source;
    const otherNode = state.oxa.nodes.find((x) => x.id === otherId);
    const label = otherNode ? truncate(otherNode.shortClaim || otherNode.displayClaim || otherId, 70) : otherId;
    return `<div class="rel-row">
      <span class="rel-type" style="color:${EDGE_COLORS[r.relationType] || '#fff'}">${dir === 'out' ? '→' : '←'} ${escapeHtml(r.relationType)}</span>
      <span class="rel-target" data-jump="${escapeHtml(otherId)}">${escapeHtml(label)}</span>
    </div>`;
  };

  const droppedRow = (r) => `
    <div class="rel-row dropped">
      <span class="rel-type" style="color:${EDGE_COLORS[r.relationType] || '#fff'}">→ ${escapeHtml(r.relationType)}</span>
      <span class="rel-target">${escapeHtml(r.target)} (dropped: ${escapeHtml(r.reason)})</span>
    </div>`;

  const conceptsHtml = n.concepts.length
    ? `<div class="concepts">${n.concepts.map((c) => `<span>${escapeHtml(c)}</span>`).join('')}</div>`
    : '';

  document.getElementById('sidebar').innerHTML = `
    <div class="pill role" style="border-left:3px solid ${ROLE_COLORS[n.role] || '#888'};padding-left:6px;">${escapeHtml(n.role)}</div>
    <div class="pill strength">${escapeHtml(n.epistemicStrength)}</div>
    ${n.panel ? `<div class="pill">panel: ${escapeHtml(JSON.stringify(n.panel))}</div>` : ''}

    <div class="id-line">${escapeHtml(n.id)}</div>

    ${n.displayClaim ? `<h3>Display claim</h3><div class="display">${escapeHtml(n.displayClaim)}</div>` : ''}
    ${n.shortClaim ? `<h3>Short claim</h3><div class="display">${escapeHtml(n.shortClaim)}</div>` : ''}
    <h3>Full text</h3>
    <div class="content">${escapeHtml(n.text)}</div>

    ${conceptsHtml ? `<h3>Concepts (OXA only)</h3>${conceptsHtml}` : ''}

    ${outgoing.length ? `<h3>Outgoing relations (${outgoing.length})</h3>${outgoing.map((r) => relRow(r, 'out')).join('')}` : ''}
    ${incoming.length ? `<h3>Incoming relations (${incoming.length})</h3>${incoming.map((r) => relRow(r, 'in')).join('')}` : ''}
    ${droppedOut.length ? `<h3>Dropped from DG export</h3>${droppedOut.map(droppedRow).join('')}` : ''}

    <h3>Metadata</h3>
    <div class="id-line">uuid: ${escapeHtml(n.uuid || '—')}</div>
    ${n.doi ? `<div class="id-line">doi: ${escapeHtml(n.doi)}</div>` : ''}
  `;

  document.querySelectorAll('.rel-target[data-jump]').forEach((el) => {
    el.addEventListener('click', () => {
      const tid = el.dataset.jump;
      state.cy?.elements().unselect();
      state.cy?.$id(tid).select();
      state.cy?.center(state.cy.$id(tid));
      showOxaNode(tid);
    });
  });
}

function showOxaEdge(d) {
  const sNode = state.oxa.nodes.find((x) => x.id === d.source);
  const tNode = state.oxa.nodes.find((x) => x.id === d.target);
  document.getElementById('sidebar').innerHTML = `
    <h3>OXA Relation</h3>
    <div class="content"><code>${escapeHtml(d.relationType)}</code></div>
    <h3>Source claim</h3>
    <div class="rel-row"><span class="rel-type">${escapeHtml(sNode.role)}</span><span class="rel-target" data-jump="${escapeHtml(sNode.id)}">${escapeHtml(sNode.shortClaim || sNode.displayClaim || sNode.id)}</span></div>
    <h3>Target claim</h3>
    <div class="rel-row"><span class="rel-type">${escapeHtml(tNode.role)}</span><span class="rel-target" data-jump="${escapeHtml(tNode.id)}">${escapeHtml(tNode.shortClaim || tNode.displayClaim || tNode.id)}</span></div>
  `;
  document.querySelectorAll('.rel-target[data-jump]').forEach((el) => {
    el.addEventListener('click', () => showOxaNode(el.dataset.jump));
  });
}

function showJsonldNode(id) {
  const n = state.jld.nodes.find((x) => x.id === id);
  if (!n) return clearSidebar();
  const outgoing = state.jld.edges.filter((e) => e.source === id);
  const incoming = state.jld.edges.filter((e) => e.target === id);

  const relRow = (r, dir) => {
    const otherId = dir === 'out' ? r.target : r.source;
    const otherNode = state.jld.nodes.find((x) => x.id === otherId);
    const label = otherNode ? truncate(otherNode.content || lastPath(otherNode.id), 70) : otherId;
    return `<div class="rel-row">
      <span class="rel-type" style="color:${EDGE_COLORS[r.relationType] || '#fff'}">${dir === 'out' ? '→' : '←'} dg:${escapeHtml(r.relationType)}</span>
      <span class="rel-target" data-jump="${escapeHtml(otherId)}">${escapeHtml(label)}</span>
    </div>
    ${r.originalRelationType ? `<div class="rel-row"><span class="rel-type" style="color:var(--muted)">orig</span><span style="color:var(--muted);font-size:11px;"><code>${escapeHtml(r.originalRelationType)}</code></span></div>` : ''}`;
  };

  const pillClass =
    n.type === 'Claim' ? 'type-claim' : n.type === 'Evidence' ? 'type-evidence' : 'type-source';

  document.getElementById('sidebar').innerHTML = `
    <div class="pill ${pillClass}">dg:${escapeHtml(n.type)}</div>
    ${n.role ? `<div class="pill role">role: ${escapeHtml(n.role)}</div>` : ''}
    ${n.epistemicStrength ? `<div class="pill strength">${escapeHtml(n.epistemicStrength)}</div>` : ''}
    ${n.panel ? `<div class="pill">panel: ${escapeHtml(JSON.stringify(n.panel))}</div>` : ''}

    <div class="id-line">${escapeHtml(n.id)}</div>

    <h3>Content</h3>
    <div class="content">${escapeHtml(n.content || '')}</div>

    ${n.authors ? `<h3>Authors</h3><div>${n.authors.map(escapeHtml).join(', ')}</div>` : ''}
    ${n.doi ? `<h3>DOI</h3><div><a href="https://doi.org/${escapeHtml(n.doi)}" target="_blank">${escapeHtml(n.doi)}</a></div>` : ''}

    ${outgoing.length ? `<h3>Outgoing (${outgoing.length})</h3>${outgoing.map((r) => relRow(r, 'out')).join('')}` : ''}
    ${incoming.length ? `<h3>Incoming (${incoming.length})</h3>${incoming.map((r) => relRow(r, 'in')).join('')}` : ''}

    <h3>Fields absent vs OXA</h3>
    <div class="item warn" style="font-size:12px;color:var(--warn);">No <code>concepts</code>, <code>displayClaim</code>, <code>shortClaim</code>, or <code>uuid</code> on this DG node.</div>
  `;

  document.querySelectorAll('.rel-target[data-jump]').forEach((el) => {
    el.addEventListener('click', () => {
      const tid = el.dataset.jump;
      state.cy?.elements().unselect();
      state.cy?.$id(tid).select();
      state.cy?.center(state.cy.$id(tid));
      showJsonldNode(tid);
    });
  });
}

function showJsonldEdge(d) {
  const sNode = state.jld.nodes.find((x) => x.id === d.source);
  const tNode = state.jld.nodes.find((x) => x.id === d.target);
  document.getElementById('sidebar').innerHTML = `
    <h3>DG Relation (reified)</h3>
    <div class="content">
      <div>predicate: <code>dg:${escapeHtml(d.relationType)}</code></div>
      <div style="margin-top:6px;color:var(--muted);">original: <code>${escapeHtml(d.originalRelationType || '—')}</code></div>
    </div>
    <h3>Source</h3>
    <div class="rel-row"><span class="rel-type">dg:${escapeHtml(sNode.type)}</span><span class="rel-target" data-jump="${escapeHtml(sNode.id)}">${escapeHtml(truncate(sNode.content || '', 100))}</span></div>
    <h3>Target</h3>
    <div class="rel-row"><span class="rel-type">dg:${escapeHtml(tNode.type)}</span><span class="rel-target" data-jump="${escapeHtml(tNode.id)}">${escapeHtml(truncate(tNode.content || '', 100))}</span></div>
  `;
  document.querySelectorAll('.rel-target[data-jump]').forEach((el) => {
    el.addEventListener('click', () => showJsonldNode(el.dataset.jump));
  });
}

function showTtlProp(qname) {
  const p = state.ttl.props.find((x) => x.qname === qname);
  if (!p) return clearSidebar();
  const oxaUses = [];
  for (const c of window.OXA_DATA.children) {
    for (const r of c.relations || []) {
      if (r.relationType === qname) oxaUses.push({ src: c.identifier, tgt: r.xref });
    }
  }
  document.getElementById('sidebar').innerHTML = `
    <h3>${escapeHtml(p.qname)}</h3>
    <div class="id-line">"${escapeHtml(p.label)}"</div>
    <div class="pill">parent: <code>${escapeHtml(p.parent || '—')}</code></div>
    <h3>Definition</h3>
    <div class="content">${escapeHtml(p.comment)}</div>
    <h3>Used in Headley (${oxaUses.length})</h3>
    ${
      oxaUses.length
        ? oxaUses.map((u) => `<div class="rel-row"><span class="rel-target">${escapeHtml(u.src)} → ${escapeHtml(u.tgt)}</span></div>`).join('')
        : '<div class="empty">Not used in this paper.</div>'
    }
  `;
}

// ── Review notes (embedded at bottom of TTL view) ──────────────────────
function reviewNotesHtml() {
  return `
  <div class="review-notes">
    <h2>⚑ Review notes — things to look at closely</h2>
    <details open>
      <summary>2 relations are silently dropped during DG export</summary>
      <p>
        The two <code>claimrel:scopes</code> edges in OXA use <code>xref: "*"</code>
        (a wildcard meaning "applies to the whole paper") for <code>l5-model-single-cell-scope</code>
        and <code>naturalistic-drive-parameterization</code>. These don't survive the JSON-LD pass:
        the DG export contains zero <code>scopes</code> relations. Either the wildcard semantics
        need a first-class encoding (e.g. an edge to the paper Source node) or the export should at
        minimum log the drop.
      </p>
    </details>
    <details open>
      <summary>"empirical" claims are remapped to <code>dg:Evidence</code></summary>
      <p>
        All 14 empirical-role OXA claims become <code>dg:Evidence</code> in the JSON-LD. In our
        conceptual schema, Evidence is defined as "bundles observation + method; curated from
        Sources" — the eLife empirical claims are short text statements with no method or source
        bundling. The mapping conflates "empirical claim" with "evidence-for-a-claim". This is
        worth a conversation: should the eLife pipeline emit DG Evidence (with the observation/
        method fields filled where possible), or should empirical first-pass claims stay as
        <code>dg:Claim</code> until they've been tied to a Source?
      </p>
    </details>
    <details>
      <summary><code>scope</code> claims are also remapped to <code>dg:Evidence</code></summary>
      <p>
        The 2 scope-role claims (e.g. "Our model is a single layer-5 cell") become
        <code>dg:Evidence</code>. Scope statements aren't observations — they're qualifications
        on the applicability of other claims. This seems like the wrong target type.
      </p>
    </details>
    <details>
      <summary><code>literature-context</code> is promoted to <code>dg:Source</code></summary>
      <p>
        One literature-context claim becomes a <code>dg:Source</code> node alongside the paper
        itself. Interesting choice — it makes the prior-literature reference a citable source
        within the graph. But it conflates "this paper" (an article) with "a literature claim
        we're contextualizing against". Worth deciding whether prior-literature contexts deserve
        their own node type or should always become Sources with a DOI.
      </p>
    </details>
    <details>
      <summary>Relation-type collapse loses semantic distinctions</summary>
      <p>
        Five OXA relation types map to three DG predicates:
        <code>claimrel:tests</code> (8×), <code>claimrel:entails</code> (6×), and
        <code>cito:citesAsSourceDocument</code> (6×) all become <code>dg:supports</code>.
        These are very different epistemic moves — "tests" is outcome-neutral, "entails" is
        deductive, "citesAsSourceDocument" is provenance. Flattening them to "supports" hides
        information the OXA source captured. Recommend either (a) expanding DG's relation set
        to preserve the CiTO/claimrel granularity, or (b) keeping the <code>originalRelationType</code>
        as a first-class queryable field rather than a flat string.
      </p>
    </details>
    <details>
      <summary>Suspicious use of <code>cito:citesAsSourceDocument</code></summary>
      <p>
        This predicate is used on 6 prediction→hypothesis edges (e.g.
        <code>prediction-beta-optimal-distal → hypothesis-frequency-compartment-matching</code>).
        CiTO's intended semantics is "the citing entity uses the cited entity as a source
        document" — typically for whole-document citations. A prediction "deriving from" a
        hypothesis seems closer to <code>claimrel:requires</code> or a new
        <code>claimrel:derivedFrom</code>. This pattern should probably get its own predicate.
      </p>
    </details>
    <details>
      <summary>Bidirectional <code>cito:disagreesWith</code> edges are duplicated</summary>
      <p>
        For competing claim pairs (e.g. <code>beta-gates-distal-apical-inputs</code> vs
        <code>gamma-gates-proximal-basal-inputs</code>) the disagreement is stored as two edges,
        one in each direction. That's twice the work of an undirected edge with no information
        gain. Either declare disagreesWith symmetric or pick a single canonical direction.
      </p>
    </details>
    <details>
      <summary>3 of the 8 claim-rel extensions are never used in Headley</summary>
      <p>
        <code>claimrel:rulesOut</code>, <code>claimrel:replicates</code>, <code>claimrel:contradicts</code>,
        and <code>claimrel:requires</code> are defined in the TTL but have zero usage in
        <code>headley.oxa.json</code>. This may be fine (one paper sample), but worth confirming
        across the full 10-paper corpus that these extensions actually get exercised.
      </p>
    </details>
    <details>
      <summary>Heavy metadata loss: concepts, displayClaim, shortClaim, uuid</summary>
      <p>
        OXA carries rich per-claim metadata: <code>concepts</code> keyword lists (26/26 claims),
        <code>displayClaim</code> (a curator-written human-readable version, 26/26),
        <code>shortClaim</code> (an even shorter version, on some), and a UUID. None of this
        survives the DG JSON-LD export. The concepts list in particular is valuable indexing
        signal that should probably round-trip. Recommend extending the DG <code>@context</code>
        to include these fields rather than discarding them.
      </p>
    </details>
    <details>
      <summary>Only 1 paper of 10 has downloadable exports</summary>
      <p>
        The standards page references a 10-paper, 231-claim corpus, but only
        <code>headley.{oxa.json,dg.jsonld}</code> are actually served. The other 9 papers exist
        as web pages but no exports are linked from the standards page or the paper pages.
        Worth asking Zach whether the full corpus exports exist somewhere and just aren't
        linked, or whether Headley is a pilot ahead of bulk generation.
      </p>
    </details>
    <details>
      <summary>Top-level <code>@id</code>/<code>@type</code> missing on the JSON-LD document</summary>
      <p>
        The DG JSON-LD has only <code>@context</code> and <code>@graph</code> at the top —
        no <code>@id</code>, no <code>@type</code>, no document-level metadata about the export
        itself (generation date, version, exporter identity, license). Adding these would help
        with provenance when these files start circulating.
      </p>
    </details>
    <details>
      <summary>DG <code>opposedBy</code> direction is potentially reversed</summary>
      <p>
        OXA has <code>X cito:disagreesWith Y</code>. The DG export maps this to
        <code>X dg:opposedBy Y</code>. But the natural reading of "X disagrees with Y" is
        "X opposes Y" (active), not "X is opposed by Y" (passive). Check that the source/target
        on these edges hasn't been flipped semantically.
      </p>
    </details>
    <details>
      <summary>Where do Methods, Data, Authors live?</summary>
      <p>
        The DG core model in <code>conceptual-schema-draft.md</code> uses Evidence to bundle
        observation + method curated from Sources. The eLife exports have no method nodes, no
        data references, no author attribution on claims. The pipeline is currently
        claim-tree-only. If we want DG-native files we should be specifying how methods and
        author attribution flow into the export.
      </p>
    </details>
    <details>
      <summary>No Research Question node — the top of the conceptual tree is missing</summary>
      <p>
        In our four-node conceptual schema, Research Question is the apex node that Claims
        "address". The eLife claim trees have no Question type — the highest-level node is a
        <code>hypothesis</code>-role Claim. That's why the yellow swatch in our palette has no
        usage in this dataset. Worth deciding whether the extraction pipeline should attempt to
        recover the paper's driving question (often present in the abstract's first sentences)
        as a first-class node, or whether eLife claim trees are deliberately scoped to start at
        the hypothesis level.
      </p>
    </details>
  </div>`;
}

// ── Tab switching ──────────────────────────────────────────────────────
function setView(v) {
  state.view = v;
  document.querySelectorAll('.tab').forEach((el) => {
    el.classList.toggle('active', el.dataset.view === v);
  });
  clearSidebar();
  if (v === 'oxa') renderOxaView();
  else if (v === 'jld') renderJsonldView();
  else if (v === 'ttl') renderTtlView();
  // Show/hide overlay panes
  document.getElementById('legend').classList.toggle('hidden', v === 'ttl');
  document.getElementById('diff').classList.toggle('hidden', v === 'ttl');
}

// ── Init ───────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initData();
  document.querySelectorAll('.tab').forEach((el) => {
    el.addEventListener('click', () => setView(el.dataset.view));
  });
  setView('oxa');
});
