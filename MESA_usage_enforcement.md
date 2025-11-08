# MESA: Machine-Enforceable Schema for Attribution
## Enhanced Specification - Enforcing Attribution at Point of Use

## The Challenge

**Storage validation** checks: Does the node have `sourceLink` and `creator`?
**Usage enforcement** ensures: When you retrieve/link/display this node, those fields come with it.

This document addresses **usage enforcement** - guaranteeing attribution travels with content.

## Enforcement Mechanisms

### 1. API Response Structure (Required Fields)

The API **always returns** attribution fields for CC-licensed nodes, whether requested or not.

```python
# User requests: GET /api/nodes/evidence-123
# System returns (ENFORCED):
{
  "@id": "pages:evidence-123",
  "title": "Cell migration increases 2x",
  "content": "...",
  # These MUST be included in response:
  "_attribution": {
    "required": true,
    "licenseName": "CC BY 4.0",
    "sourceLink": "https://lab.example.com/dataset-001", 
    "creator": "Jane Smith"
  }
}
```

The `_attribution` wrapper signals: "You cannot use this content without these fields."

### 2. Immutable Attribution Bundle

Create a data structure where attribution cannot be separated from content:

```python
class AttributedNode:
    """Node where content and attribution are inseparable"""
    
    def __init__(self, node_data: Dict):
        self._data = node_data
        self._attribution = self._extract_required_attribution()
        
        if not self._attribution:
            raise ValueError("Cannot create AttributedNode without complete attribution")
    
    @property
    def content(self) -> str:
        """Cannot access content without triggering attribution requirement"""
        if not self._attribution_acknowledged:
            raise AttributionError("Must acknowledge attribution before accessing content")
        return self._data['content']
    
    def get_with_attribution(self) -> Dict:
        """Only way to access node - always includes attribution"""
        return {
            **self._data,
            '_attribution': self._attribution,
            '_attribution_required': True
        }
    
    # No getter for raw data without attribution!
```

### 3. Link/Reference Validation

When creating a **reference** to a node (e.g., Citation, GroundedIn relation), enforce attribution inclusion:

```python
class ReferenceValidator:
    """Validates that references include required attribution"""
    
    def create_reference(
        self, 
        source_node_id: str,
        reference_context: Dict
    ) -> Result:
        """
        Create a reference to a node. For CC-licensed nodes, 
        attribution MUST be included in reference_context.
        """
        node = self.get_node(source_node_id)
        
        if self._is_cc_licensed(node):
            # Check that reference includes attribution
            required = ['sourceLink', 'creator']
            missing = [f for f in required if f not in reference_context]
            
            if missing:
                return Result.error(
                    f"Cannot create reference to CC-licensed node without: {missing}"
                )
        
        # Create reference with embedded attribution
        reference = {
            'target': source_node_id,
            'context': reference_context,
            '_attribution': {
                'sourceLink': node['sourceLink'],
                'creator': node['creator']
            }
        }
        
        return Result.success(reference)
```

### 4. Display/Rendering Hooks

At the UI/rendering layer, enforce attribution display:

```python
class NodeRenderer:
    """Renders nodes with mandatory attribution"""
    
    def render_node(self, node: Dict) -> str:
        """Render node content - automatically includes attribution for CC"""
        
        html = f"<div class='node'>"
        html += f"<h3>{node['title']}</h3>"
        html += f"<div class='content'>{node['content']}</div>"
        
        # AUTOMATIC attribution footer for CC content
        if node.get('licenseName', '').startswith('CC'):
            attribution = self._render_attribution(node)
            html += f"<div class='attribution required'>{attribution}</div>"
        
        html += "</div>"
        return html
    
    def _render_attribution(self, node: Dict) -> str:
        """Generate attribution notice"""
        return f"""
        <p class='license-notice'>
            Licensed under {node['licenseName']}<br>
            Source: <a href="{node['sourceLink']}">{node['sourceLink']}</a><br>
            Creator: {node['creator']}
        </p>
        """
```

### 5. Export/Serialization Control

When exporting nodes (PDF, JSON, etc.), attribution is mandatory:

```python
class NodeExporter:
    """Exports nodes with enforced attribution"""
    
    def export_to_pdf(self, node_ids: List[str]) -> bytes:
        """Export nodes to PDF - CC-licensed nodes include attribution"""
        
        pdf = PDFDocument()
        
        for node_id in node_ids:
            node = self.get_node(node_id)
            
            # Add content
            pdf.add_section(node['title'], node['content'])
            
            # MANDATORY attribution for CC content
            if node.get('licenseName', '').startswith('CC'):
                pdf.add_attribution_footer(
                    license=node['licenseName'],
                    source=node['sourceLink'],
                    creator=node['creator']
                )
        
        return pdf.render()
    
    def export_to_json(self, node_ids: List[str]) -> str:
        """Export to JSON - attribution fields are non-optional"""
        
        nodes = []
        for node_id in node_ids:
            node = self.get_node(node_id)
            
            # Filter fields, but attribution is always included
            filtered = {
                '@id': node['@id'],
                'title': node['title'],
                'content': node['content']
            }
            
            if node.get('licenseName', '').startswith('CC'):
                # FORCE attribution fields into export
                filtered.update({
                    'licenseName': node['licenseName'],
                    'sourceLink': node['sourceLink'],
                    'creator': node['creator'],
                    '_attributionRequired': True
                })
            
            nodes.append(filtered)
        
        return json.dumps(nodes)
```

### 6. Query/Filter Results

When querying for nodes, attribution is automatically included in results:

```python
class GraphQuery:
    """Query interface with attribution enforcement"""
    
    def find_evidence_for_claim(self, claim_id: str) -> List[Dict]:
        """Find all evidence supporting a claim"""
        
        results = self._execute_query(
            "MATCH (e:Evidence)-[:Supports]->(c:Claim {id: $claim_id})",
            claim_id=claim_id
        )
        
        # Post-process: ensure CC-licensed results include attribution
        return [
            self._ensure_attribution(node) 
            for node in results
        ]
    
    def _ensure_attribution(self, node: Dict) -> Dict:
        """Guarantee attribution fields for CC content"""
        if node.get('licenseName', '').startswith('CC'):
            # If somehow these are missing, fetch them
            if not node.get('sourceLink') or not node.get('creator'):
                complete_node = self.get_complete_node(node['@id'])
                node['sourceLink'] = complete_node['sourceLink']
                node['creator'] = complete_node['creator']
        
        return node
```

## Implementation Strategy

### Phase 1: Storage Layer
✓ Validate nodes have attribution on creation/update

### Phase 2: Retrieval Layer (Current MESA)
✓ Block retrieval of incomplete CC-licensed nodes

### Phase 3: Usage Layer (This Enhancement)
Enforce attribution inclusion at:
- API responses (immutable attribution bundle)
- Reference creation (attribution in context)
- Display/rendering (automatic attribution footer)
- Export operations (PDF, JSON, etc.)
- Query results (post-processing to ensure attribution)

## Technical Patterns

### Pattern 1: Wrapper Object
Wrap CC-licensed content in an object that prevents access without attribution

### Pattern 2: Mandatory Fields
API responses always include attribution fields (no field selection override)

### Pattern 3: Rendering Hooks
UI/export layers automatically append attribution

### Pattern 4: Reference Validation
Creating links/citations requires attribution metadata

### Pattern 5: Audit Logging
Log all accesses to CC content, verify attribution was included

## Compliance Requirements

A system enforces attribution at point of use if:

- [ ] API responses for CC content always include `sourceLink` and `creator`
- [ ] References to CC nodes cannot be created without attribution metadata
- [ ] Display/rendering automatically shows attribution for CC content
- [ ] Export functions (PDF, JSON, etc.) include attribution in output
- [ ] Query results automatically bundle attribution with CC nodes
- [ ] Client applications cannot access CC content without attribution fields
- [ ] Audit trail confirms attribution traveled with content

## Example: End-to-End Enforcement

```python
# User action: View evidence panel
panel_id = "pages:evidence-123"

# 1. Retrieval (Phase 2 enforcement)
node = api.get_node(panel_id)  # Blocked if missing attribution

# 2. Usage (Phase 3 enforcement) 
# User wants to create a reference to this evidence
reference = api.create_reference(
    source_node_id=panel_id,
    reference_context={
        'citation': 'Smith et al. 2024',
        # Must include these for CC content:
        'sourceLink': node['sourceLink'],
        'creator': node['creator']
    }
)

# 3. Display
html = renderer.render_node(node)  # Auto-includes attribution footer

# 4. Export
pdf = exporter.export_to_pdf([panel_id])  # Attribution in PDF

# At every step, attribution was enforced by the system
```

## Key Insight

**Storage validation** says: "This node has the data"
**Usage enforcement** says: "You cannot use this node without that data"

MESA now covers both: nodes must have attribution (validation) AND usage must include attribution (enforcement).
