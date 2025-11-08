# MESA: Machine-Enforceable Schema for Attribution
## Node Reference Edition

## Purpose
MESA ensures that when nodes are retrieved, viewed, or referenced, required attribution information automatically comes along with them.

## Core Enforcement Rule

**When retrieving/referencing a node:**
1. Check the node's `licenseName` field
2. If license starts with "CC":
   - MUST also retrieve and include `sourceLink`
   - MUST also retrieve and include `creator` (author field)
   - MUST bundle these fields together in any output/display

## Use Cases

### ✓ Compliant Retrieval
```json
// User requests node pages:evidence-123
// System returns:
{
  "@id": "pages:evidence-123",
  "title": "Cell migration speed increases 2x...",
  "licenseName": "CC BY 4.0",
  "sourceLink": "https://example.com/dataset",
  "creator": "Jane Smith"
}
```

### ✗ Non-Compliant Retrieval
```json
// User requests node pages:evidence-123
// System returns incomplete data:
{
  "@id": "pages:evidence-123",
  "title": "Cell migration speed increases 2x..."
  // Missing: licenseName, sourceLink, creator
}
```

## Implementation Requirements

A compliant MESA implementation MUST:

1. **Check license on every node retrieval**
2. **Bundle attribution fields** with CC-licensed nodes
3. **Never serve CC-licensed content** without its attribution
4. **Apply recursively** when retrieving multiple related nodes

## Enforcement Point

**Node Retrieval API** - validate before returning data to user

## Scope

MESA applies to:
- **Evidence nodes** (`@type: pages:zsoX6_bEl`)
- **Source nodes** (`@type: pages:rVONqNC48`)

All node types with CC licenses must include complete attribution.

## Technical Implementation

### JSON Schema Validation
The `mesa_schema.json` file provides formal validation:
- Conditional requirement: if `licenseName` matches `^CC.*`, then `sourceLink` and `creator` are required
- Both fields must be non-empty strings
- Validation can be applied at API boundaries or database layer

### Python Enforcement
The `mesa_reference.py` module provides:
- `MESAReference.get_node()` - retrieves nodes with automatic attribution bundling
- `MESAReference.validate_node_for_retrieval()` - pre-check if node can be retrieved
- `DiscourseGraphAPI` - example API integration with enforcement

### Example Integration

```python
from mesa_reference import MESAReference, DiscourseGraphAPI

# Initialize with graph data
mesa = MESAReference(graph_data)
api = DiscourseGraphAPI(mesa)

# Retrieve node - automatically enforces attribution
response = api.get_node('pages:evidence-123')

if response['success']:
    node = response['data']
    # Guaranteed to have licenseName, sourceLink, creator if CC-licensed
else:
    # Node blocked due to incomplete attribution
    print(response['error'])
```

## Compliance Checklist

A system is MESA-compliant if it:
- [ ] Validates `licenseName` on every node retrieval
- [ ] Requires `sourceLink` for all CC-licensed nodes
- [ ] Requires `creator` for all CC-licensed nodes  
- [ ] Blocks retrieval of incomplete CC-licensed nodes
- [ ] Bundles attribution fields with node data in responses
- [ ] Applies enforcement to both Evidence and Source nodes
- [ ] Logs enforcement actions for audit trail
