# Discourse Graphs for MyST Markdown: Phase 1 Specification

**Version:** 1.0-draft  
**Date:** 2025-12-17  
**Authors:** 
- Matt Akamatsu (ORCID: [0000-0002-0286-5310](https://orcid.org/0000-0002-0286-5310))
- Claude Opus 4.5 (Anthropic, December 2025)

**Status:** Proposal

---

## Overview

In our lab, it is possible to make meaningful progress on an experimental or engineering workflow in a single day. However, current tools separate data from claims and do not support continuous workflows. They also make it challenging to rigorously share work across labs.

This specification defines a set of MyST Markdown directives and roles for embedding **discourse graph** semantics directly into scientific documents. By creating fit-for-purpose Markdown syntax, we can promote better data management practices and enable collaboration at scale, making it possible for a distributed network of labs to collaboratively build a rich knowledge base.

### Goals

1. Let researchers systematically make connections between conclusions and supporting evidence
2. Provide a natural mechanism for keeping Developer Notes short and focused
3. Enable connections to be identified between papers and across working groups
4. Create a foundation for queryable databases combining formulations, designs, and performance data

### Design Principles

- **Minimal syntax**: Two core directives, four relation types
- **Progressive complexity**: Start simple, add detail as needed
- **Stable references**: Optional IDs for robust cross-referencing
- **MyST-native**: Follow existing MyST conventions for directives and roles

---

## Core Concepts

### The Discourse Graph Model

Discourse graphs decompose scientific arguments into modular, reusable components:

| Node Type | Description | Example |
|-----------|-------------|---------|
| **Claim** | An interpretive assertion or conclusion | "PPK2-based energy regeneration improves protein expression" |
| **Evidence** | An empirical observation tied to data | "eGFP expression increased 50% with PPK treatment" |

These nodes are connected by **relations**:

| Relation | Meaning |
|----------|---------|
| `supports` | Evidence or claim supports another claim |
| `opposes` | Evidence or claim contradicts another claim |
| `informs` | Node provides context for another node |
| `grounds` | Figure or data grounds an evidence statement |

### The Three-Layer Structure

```
┌─────────────────────────────────────┐
│  CLAIM                              │
│  (interpretive statement)           │
└─────────────────────────────────────┘
          ▲ supports
┌─────────────────────────────────────┐
│  EVIDENCE                           │
│  (empirical observation)            │
└─────────────────────────────────────┘
          ▲ grounds
┌─────────────────────────────────────┐
│  FIGURE / DATA                      │
│  (visual or raw representation)     │
└─────────────────────────────────────┘
```

---

## Syntax Reference

### The `{claim}` Directive

Claims are interpretive statements—conclusions drawn from evidence. They are the "so what" of your research.

**Syntax:**

```markdown
:::{claim} claim-ppk2-expression
:label: PPK2-based energy regeneration improves in vitro protein expression

This claim synthesizes our observations about the effect of PPK2 on 
cell-free expression systems.
:::
```

The argument after `{claim}` is an optional stable identifier. If omitted, references must match the `:label:` value.

**Parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| Argument (after `{claim}`) | No | Stable identifier for referencing |
| `:label:` | Yes | Human-readable claim statement |
| Content body | No | Optional extended description |

### The `{evidence}` Directive

Evidence nodes capture empirical observations—what you actually measured or observed. They should be grounded in figures, tables, or data.

**Syntax:**

```markdown
:::{evidence} ev-ppk-egfp-50pct
:label: PPK increases eGFP expression in Nucleus Cytosol by 50%
:supports: claim-ppk2-expression

In this experiment, we observed a consistent 50% increase in eGFP 
fluorescence intensity when PPK was added to the reaction mixture.
:::
```

**Supporting multiple claims:**

```markdown
:::{evidence} ev-ppk-dose-response
:label: PPK shows dose-dependent effect on expression
:supports: [claim-ppk2-expression, claim-dose-response]

Expression levels correlated with PPK concentration across the 
tested range (0.1-10 mM).
:::
```

**Parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| Argument | No | Stable identifier |
| `:label:` | Yes | Concise description of the observation |
| `:supports:` | No | Claim ID(s) or label(s) this evidence supports |
| `:opposes:` | No | Claim ID(s) or label(s) this evidence contradicts |
| Content body | No | Extended description or context |

### Extending the `{figure}` Directive

Figures ground evidence by providing visual or data-based support. We extend MyST's existing `{figure}` directive with discourse graph relations.

**Syntax:**

```markdown
:::{figure} ./figures/ppk-expression-barplot.png
:label: fig-ppk-expression
:grounds: ev-ppk-egfp-50pct

Barplot showing eGFP fluorescence intensity with and without PPK 
treatment. Error bars indicate standard deviation (n=3).
:::
```

**Grounding multiple evidence nodes:**

```markdown
:::{figure} ./figures/dose-response-curve.png
:label: fig-dose-response
:grounds: [ev-ppk-egfp-50pct, ev-ppk-dose-response]

Dose-response curve showing eGFP expression as a function of PPK 
concentration.
:::
```

**Referencing Jupyter notebook cell outputs:**

When your figure is generated by a code cell, reference it using the `#` prefix:

```markdown
:::{figure} #fig-my-cool-result
:label: fig-expression-analysis
:grounds: ev-ppk-egfp-50pct

Expression analysis generated from raw fluorescence data.
:::
```

The corresponding notebook cell should have a label comment:

```python
#| label: fig-my-cool-result

import matplotlib.pyplot as plt
my_dataset = load_data('path/to/data.csv')
processed_data = process_my_data(my_dataset)
fig = plt.plot(processed_data)
plt.show()
```

**Parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| Argument | Yes | Path to image file or `#cell-label` reference |
| `:label:` | Yes | Figure identifier for cross-referencing |
| `:grounds:` | No | Evidence ID(s) or label(s) this figure supports |
| Content body | Yes | Figure caption |

---

## Inline References with Roles

For referencing discourse nodes within prose, use inline role syntax:

**Referencing a claim:**

```markdown
Our results provide strong support for {claim}`claim-ppk2-expression`, 
particularly under low-salt conditions.
```

**Referencing evidence:**

```markdown
As shown in {evidence}`ev-ppk-egfp-50pct`, the effect was consistent 
across replicates.
```

Roles resolve references by searching for matching IDs first, then falling back to label matching.

---

## Complete Example

Here's a full DevNote demonstrating the syntax:

```markdown
---
title: "DevNote: PPK2 Energy Regeneration Effects"
authors:
  - name: Jane Researcher
date: 2025-01-15
---

# PPK2 Energy Regeneration in Cell-Free Systems

## Claims

:::{claim} claim-ppk2-improves-expression
:label: PPK2-based energy regeneration improves in vitro protein expression

Adding PPK2 to cell-free expression reactions provides a sustained 
energy source that increases overall protein yield.
:::

:::{claim} claim-dose-dependent
:label: The PPK2 effect is dose-dependent within the tested range

Expression improvements scale with PPK2 concentration between 0.1-10 mM.
:::

## Evidence

:::{evidence} ev-egfp-50pct-increase
:label: PPK increases eGFP expression in Nucleus Cytosol by 50%
:supports: claim-ppk2-improves-expression

Fluorescence measurements show consistent 50% increase in eGFP signal 
when 5 mM PPK is added to reactions.
:::

:::{evidence} ev-dose-response
:label: Expression scales linearly with PPK concentration
:supports: [claim-ppk2-improves-expression, claim-dose-dependent]

Dose-response experiments (0.1, 1, 5, 10 mM PPK) show linear relationship 
between PPK concentration and expression level (R² = 0.94).
:::

## Figures

:::{figure} #fig-expression-barplot
:label: fig-ppk-barplot
:grounds: ev-egfp-50pct-increase

Comparison of eGFP expression with and without PPK treatment.
:::

:::{figure} ./figures/dose-response.png
:label: fig-dose-response
:grounds: ev-dose-response

Dose-response curve for PPK concentration vs. expression level.
:::

## Discussion

Our experiments provide {evidence}`ev-egfp-50pct-increase` supporting 
the hypothesis that {claim}`claim-ppk2-improves-expression`. The 
{evidence}`ev-dose-response` further suggests this is not a threshold 
effect but scales with concentration.
```

---

## Reference Resolution

When a relation (`:supports:`, `:grounds:`, etc.) specifies a target, the resolver follows this order:

1. **Exact ID match**: If the value matches a node's argument ID exactly
2. **Label match**: If the value matches a node's `:label:` value exactly
3. **Partial label match**: If the value is a unique substring of a label (with warning)
4. **Error**: If no match or ambiguous matches found

**Recommendation:** Use stable IDs for any node that will be referenced across documents or that you expect to rename.

---

## AST Representation

For implementers: discourse graph directives produce the following AST node structures.

**Claim node:**

```json
{
  "type": "claim",
  "id": "claim-ppk2-expression",
  "label": "PPK2-based energy regeneration improves in vitro protein expression",
  "children": [
    { "type": "paragraph", "children": [...] }
  ]
}
```

**Evidence node:**

```json
{
  "type": "evidence",
  "id": "ev-ppk-egfp-50pct",
  "label": "PPK increases eGFP expression in Nucleus Cytosol by 50%",
  "relations": [
    { "type": "supports", "target": "claim-ppk2-expression" }
  ],
  "children": [
    { "type": "paragraph", "children": [...] }
  ]
}
```

**Figure node (extended):**

```json
{
  "type": "figure",
  "id": "fig-ppk-barplot",
  "src": "#fig-expression-barplot",
  "relations": [
    { "type": "grounds", "target": "ev-egfp-50pct-increase" }
  ],
  "children": [
    { "type": "caption", "children": [...] }
  ]
}
```

---

## Known Limitations (Phase 1)

The following features are explicitly **out of scope** for Phase 1:

1. **Custom node types**: Only `claim` and `evidence` are supported
2. **Custom relation types**: Only `supports`, `opposes`, `informs`, and `grounds`
3. **Relation attributes**: No confidence levels, provenance, or other metadata on relations
4. **Namespace prefixes**: No CURIE-style extensibility (e.g., `dg:claim`)
5. **Bidirectional relation syntax**: Relations are declared on the source node only
6. **Cross-document resolution**: References within a single document/project only

These limitations are intentional to reduce complexity and encourage adoption. Phase 2 will address extensibility based on user feedback.

---

## Open Questions for Implementation

### Jupyter Cell Linkage

When a figure references a notebook cell output (`#fig-my-cool-result`), the cell consumes a dataset and produces a figure. Should this provenance chain be explicit in the AST?

**Current behavior:** The cell label links figure to code; data provenance is implicit in the code itself.

**Possible enhancement:** A `:data-source:` option on cells or figures that explicitly names the input dataset, enabling queries like "show all claims grounded in figures derived from dataset X."

We defer this to Phase 2 pending user feedback on whether implicit linkage is sufficient.

### Rendering

How should discourse nodes render in different output formats?

| Format | Proposed Rendering |
|--------|-------------------|
| HTML | Colored boxes with expandable relation links |
| PDF | Numbered statements with cross-references |
| JATS | `<statement>` elements with custom attributes |

Renderer implementation details are out of scope for this syntax specification.

---

## Development notes

Ongoing development notes can be found at this Roam Research page: [Project/DG in MyST markdown](https://roamresearch.com/#/app/discourse-graphs/page/AJu-6cwmT). Please get in touch by email if you'd like to contribute via github or this page.  

## Appendix: Relation Semantics

| Relation | Source → Target | Semantics |
|----------|-----------------|-----------|
| `supports` | Evidence → Claim | The evidence provides positive support for the claim |
| `supports` | Claim → Claim | The first claim, if true, supports the second |
| `opposes` | Evidence → Claim | The evidence contradicts or weakens the claim |
| `opposes` | Claim → Claim | The claims are in tension |
| `informs` | Evidence → Claim | The evidence provides relevant context |
| `grounds` | Figure → Evidence | The figure provides visual/data support for the observation |

---

## Changelog

- **v1.0-draft (2025-12-17)**: Initial Phase 1 specification
