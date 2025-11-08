# Discourse Graphs with MESA

A machine-enforceable schema for research attribution that ensures proper credit travels with open-licensed content.

## What This Is

**Discourse Graphs** provide a structured way to represent research as interconnected knowledge components:
- **Evidence** nodes capture discrete observations from experiments/datasets
- **Claims** express assertions or conclusions
- **Questions** represent research unknowns
- **Sources** hold supporting materials (code, datasets, design files, lab notes)

Typed relationships connect these nodes—Evidence supports or opposes Claims, Questions motivate research, Evidence is grounded in Sources.

**MESA** (Machine-Enforceable Schema for Attribution) adds automatic attribution enforcement: when you retrieve CC-licensed content, the system guarantees you also get the `sourceLink` and `creator` fields. No manual tracking, no missing credits.

## Why This Matters

Traditional research papers bundle everything together. You can't easily:
- Reuse a single finding without copying entire papers
- Track which evidence supports which claims across papers
- Verify what code/data generated specific results
- Ensure attribution when content is remixed

Discourse graphs make research modular and linkable. MESA ensures that as evidence gets reused across research projects, attribution automatically comes along.

## The Schema

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

**Two levels of enforcement:**

### Level 1: Storage Validation
CC-licensed nodes must contain `sourceLink` + `creator` to be stored.

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

### Level 2: Usage Enforcement
Attribution must be included when CC-licensed content is retrieved, referenced, displayed, or exported.

```python
# Retrieval - Attribution automatically bundled
node = api.get_node('pages:evidence-001')
# Returns: node with '_attribution' bundle attached

# Reference creation - Must include attribution
api.create_reference(
    source='pages:evidence-001',
    context={
        'citation': 'Smith 2024',
        'sourceLink': 'https://lab.example.com/dataset-001',  # Required
        'creator': 'Jane Smith'  # Required
    }
)
# ✗ Without sourceLink/creator: "Cannot reference CC-licensed node without attribution"

# Rendering - Attribution automatically shown
html = renderer.render_html(node)
# Output includes attribution footer with license, source, creator

# Export - Attribution in all outputs
citation = exporter.export_citation(node)
# "Jane Smith. Cell migration increases... Retrieved from https://..."
```

### Five Enforcement Points

1. **Node retrieval** - Attribution bundled in API responses
2. **Reference creation** - Cannot link without attribution in context
3. **Query results** - CC nodes include attribution automatically
4. **Display/rendering** - Attribution footer added to HTML/Markdown
5. **Export operations** - PDFs, citations, JSON include attribution

### Technical Implementation

- **JSON Schema** - Structural validation with conditional rules
- **Python validation** - Storage-layer enforcement (`mesa_reference.py`)
- **Usage enforcement** - Point-of-use enforcement (`mesa_usage_enforcement.py`)
- **AttributedNode wrapper** - Makes content inseparable from attribution

## Files in This Repository

### Schema Definitions
- `simplified_DG_schema.json` - Core discourse graph structure (JSON-LD)
- `mesa_schema.json` - JSON Schema with CC license validation rules

### Implementation
- `mesa_reference.py` - Storage validation and retrieval enforcement
- `mesa_usage_enforcement.py` - Usage-layer enforcement (references, rendering, export)
- `MESA_reference_spec.md` - Retrieval enforcement specification
- `MESA_usage_enforcement.md` - Usage enforcement specification with compliance checklist
- `test_mesa_schema.py` - Validation tests demonstrating enforcement

### Examples
- `dg_validation.py` - Shows validation logic and license inheritance

## Quick Start

### Storage Validation
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

### Usage Enforcement
```python
from mesa_usage_enforcement import UsageEnforcedAPI, NodeRenderer

# Initialize usage enforcement
api = UsageEnforcedAPI(graph_data)
renderer = NodeRenderer()

# Retrieve node - attribution automatically bundled
node = api.get_node('pages:evidence-123')
# node contains '_attribution' bundle

# Create reference - must include attribution
result = api.create_reference(
    source_node_id='pages:evidence-123',
    reference_context={
        'citation': 'Smith et al. 2024',
        'sourceLink': node['_attribution']['sourceLink'],
        'creator': node['_attribution']['creator']
    }
)

# Render with automatic attribution
html = renderer.render_html(node)
# HTML includes attribution footer
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

**Two-level enforcement** - Validate at storage, enforce at usage

**Simple over complex** - CC needs sourceLink + creator (that's it)

**Attribution travels with content** - Not just validated, but bundled in every use

**Enforce at point of use** - References, rendering, exports all check attribution

**Machine-enforceable** - Computers validate and bundle, humans don't track manually

**Fail closed** - Missing attribution blocks operations rather than serving incomplete data

**Composable** - Nodes are modular units that maintain attribution when combined

## Future Directions

- Automatic DOI/ORCID resolution for creator fields
- License compatibility checking (e.g., CC BY → CC BY-SA validation)
- Citation format generation from attribution bundles
- Blockchain-anchored provenance for high-stakes research
- Federation protocol for cross-institution discourse graphs

## License

This schema and reference implementation are released under CC0 1.0 (public domain). Use freely for any purpose.

## Contact

For questions about MESA or discourse graphs, open an issue or reach out to the maintainers.

---

**MESA**: Because attribution shouldn't be optional.
