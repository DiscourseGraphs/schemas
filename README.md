# Discourse Graphs: Structured Scientific Knowledge

This repository contains specifications and schemas for creating **discourse graphs**—structured representations of scientific research as interconnected knowledge components.

## What Are Discourse Graphs?

**Discourse Graphs** provide a structured way to represent research as interconnected knowledge components:
- **Evidence** nodes capture discrete observations from experiments/datasets
- **Claims** express assertions or conclusions
- **Questions** represent research unknowns
- **Sources** hold supporting materials (code, datasets, design files, lab notes)

Typed relationships connect these nodes—Evidence supports or opposes Claims, Questions motivate research, Evidence is grounded in Sources.

This repository provides two complementary approaches to working with discourse graphs:

1. **MyST Markdown Syntax** ([discourse-graphs-myst-spec.md](discourse-graphs-myst-spec.md)) - Embed discourse graph semantics directly in MyST Markdown documents using specialized directives and roles
2. **MESA** (Machine-Enforceable Schema for Attribution) - A JSON-based schema with automatic attribution enforcement for CC-licensed content

## Why This Matters

Traditional research papers bundle everything together. You can't easily:
- Reuse a single finding without copying entire papers
- Track which evidence supports which claims across papers
- Verify what code/data generated specific results
- Ensure attribution when content is remixed

Discourse graphs make research modular and linkable. The MyST Markdown syntax makes it easy to embed these semantics directly in your scientific documents. MESA ensures that as evidence gets reused across research projects, attribution automatically comes along.

## Approach 1: MyST Markdown Directives

The **MyST Markdown specification** provides a natural, document-centric way to create discourse graphs. It extends MyST Markdown with custom directives for claims, evidence, and figures, plus roles for inline references.

### Key Features

- **Minimal syntax**: Two core directives (`{claim}` and `{evidence}`), four relation types
- **Progressive complexity**: Start simple, add detail as needed
- **Stable references**: Optional IDs for robust cross-referencing
- **MyST-native**: Follows existing MyST conventions

### Quick Example

```markdown
:::{claim} claim-ppk2-expression
:label: PPK2-based energy regeneration improves protein expression

Adding PPK2 to cell-free expression reactions provides sustained energy 
that increases overall protein yield.
:::

:::{evidence} ev-egfp-50pct
:label: PPK increases eGFP expression by 50%
:supports: claim-ppk2-expression

Fluorescence measurements show consistent 50% increase in eGFP signal 
when 5 mM PPK is added to reactions.
:::

:::{figure} ./figures/ppk-expression.png
:label: fig-ppk-expression
:grounds: ev-egfp-50pct

Barplot showing eGFP fluorescence with and without PPK treatment.
:::
```

For the complete specification, see [discourse-graphs-myst-spec.md](discourse-graphs-myst-spec.md).

## Approach 2: MESA Schema

**MESA** (Machine-Enforceable Schema for Attribution) provides a JSON-based approach with automatic attribution enforcement. When you retrieve CC-licensed content, the system guarantees you also get the `sourceLink` and `creator` fields. No manual tracking, no missing credits.

### Core Node Types

```
Question (QUE)  → What you want to know
  ↓ motivates
Evidence (EVD)  → Discrete observations from data
  ↓ supports/opposes
Claim (CLM)     → Assertions or conclusions
  
Evidence ← groundedIn ← Source → Code, datasets, design files, lab notes
```

### License Fields (All Nodes)

- `licenseName` - e.g., "CC BY 4.0"
- `licenseLink` - URL to license text
- `sourceLink` - Link to original source
- `creator` - Author/creator name
- `attributionStatement` - How to cite
- `rightsStatement` - Usage rights

## MESA: The Enforcement

**One simple rule:** CC-licensed nodes cannot be retrieved without `sourceLink` + `creator`.

```python
# This works - complete attribution
{
  "@id": "pages:evidence-001",
  "title": "Cell migration increases 2x under stimulus",
  "licenseName": "CC BY 4.0",
  "sourceLink": "https://lab.example.com/dataset-001",
  "creator": "Jane Smith"
}

# This is blocked - missing creator
{
  "@id": "pages:evidence-002", 
  "title": "Another finding",
  "licenseName": "CC BY 4.0",
  "sourceLink": "https://lab.example.com/dataset-002"
  # ✗ API returns error: "CC-licensed node missing required fields: creator"
}
```

### Enforcement Points

- **Node retrieval** - Validation before serving data
- **JSON Schema** - Structural validation with conditional rules
- **Python API** - Reference implementation with automatic bundling

## Files in This Repository

### Specifications
- **[discourse-graphs-myst-spec.md](discourse-graphs-myst-spec.md)** - Complete MyST Markdown specification for embedding discourse graphs in documents
- **[MESA_reference_spec.md](MESA_reference_spec.md)** - Complete MESA specification with compliance checklist

### Schema Definitions
- `simplified_DG_schema.json` - Core discourse graph structure (JSON-LD)
- `mesa_schema.json` - JSON Schema with CC license validation rules
- `evidence_json_schema.json` - Evidence node schema

### Implementation
- `mesa_reference.py` - Python enforcement engine
- `test_mesa_schema.py` - Validation tests demonstrating enforcement (if exists)

### Examples (MESA)
- `dg_validation.py` - Shows validation logic and license inheritance (if exists)
- `COMMIT_MESSAGE.txt` - Summary of changes from base schema (if exists)

## Quick Start

```python
from mesa_reference import MESAReference, DiscourseGraphAPI

# Load your discourse graph
graph_data = {...}  # Your JSON-LD graph

# Initialize MESA enforcement
mesa = MESAReference(graph_data)
api = DiscourseGraphAPI(mesa)

# Try to retrieve a node
response = api.get_node('pages:evidence-123')

if response['success']:
    node = response['data']
    # Guaranteed: if CC-licensed, has sourceLink + creator
    print(f"Retrieved: {node['title']}")
    print(f"Creator: {node['creator']}")
else:
    # Node blocked due to incomplete attribution
    print(f"Blocked: {response['error']}")
```

## Use Cases

### Research Labs
Create evidence panels with automatic attribution tracking. When datasets are CC-licensed, links and credit automatically propagate through derived analyses.

### Open Science
Share findings as structured evidence nodes instead of static PDFs. Others can reference specific claims while attribution metadata travels automatically.

### Meta-Research
Build knowledge graphs where every connection preserves provenance. Trace which datasets generated which evidence supporting which claims.

### Collaborative Research
Team members reference each other's work knowing attribution is enforced at the system level, not manually maintained in documents.

## Design Philosophy

**Simple over complex** - One rule (CC needs sourceLink + creator) instead of elaborate schemes

**Enforce at retrieval** - Check once when serving data, not at every operation

**Machine-enforceable** - Computers validate, humans don't track attribution manually

**Fail closed** - Missing attribution blocks retrieval rather than serving incomplete data

**Composable** - Nodes are modular units that maintain attribution when combined

## Future Directions

- Automatic DOI/ORCID resolution for creator fields
- License compatibility checking (e.g., CC BY → CC BY-SA validation)
- Citation format generation from attribution bundles
- Blockchain-anchored provenance for high-stakes research
- Federation protocol for cross-institution discourse graphs

## License

This schema and reference implementation are released under CC0 1.0 (public domain). Use freely for any purpose.

## Contributing

We welcome contributions to improve discourse graphs specifications and implementations!

### How to Contribute

- **Report issues**: Found a bug or have a feature request? [Open an issue](https://github.com/DiscourseGraphs/schemas/issues) on GitHub
- **Suggest improvements**: Have ideas for enhancing the MyST spec or MESA schema? [Open an issue](https://github.com/DiscourseGraphs/schemas/issues) to discuss
- **Submit changes**: Ready to contribute code or documentation? [Open a pull request](https://github.com/DiscourseGraphs/schemas/pulls)

For questions about the MyST specification, refer to the [discourse-graphs-myst-spec.md](discourse-graphs-myst-spec.md) or reach out via GitHub issues.

## Contact

For questions about MESA or discourse graphs, open an issue or reach out to the maintainers.

---

**MESA**: Because attribution shouldn't be optional.
