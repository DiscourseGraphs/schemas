"""
MESA Usage Enforcement - Ensures attribution travels with content at point of use

This extends MESA validation to enforce that when CC-licensed nodes are 
retrieved, referenced, displayed, or exported, attribution metadata is 
included in the output.
"""

from typing import Dict, List, Optional
from dataclasses import dataclass
from enum import Enum


class UsageError(Exception):
    """Raised when attempting to use content without required attribution"""
    pass


@dataclass
class AttributionBundle:
    """Immutable attribution that must travel with CC content"""
    license_name: str
    source_link: str
    creator: str
    
    def to_dict(self) -> Dict:
        return {
            'licenseName': self.license_name,
            'sourceLink': self.source_link,
            'creator': self.creator,
            '_attributionRequired': True
        }


class AttributedNode:
    """
    Wrapper that makes attribution inseparable from content.
    Cannot access node data without attribution bundle.
    """
    
    def __init__(self, node_data: Dict):
        self._data = node_data
        self._attribution = self._extract_attribution()
        
        if self._requires_attribution() and not self._attribution:
            raise UsageError(
                f"Cannot create AttributedNode for {node_data.get('@id')}: "
                "CC-licensed content missing required attribution fields"
            )
    
    def _requires_attribution(self) -> bool:
        """Check if this node requires attribution"""
        license_name = self._data.get('licenseName', '')
        return license_name.startswith('CC')
    
    def _extract_attribution(self) -> Optional[AttributionBundle]:
        """Extract attribution bundle from node"""
        if not self._requires_attribution():
            return None
        
        license_name = self._data.get('licenseName')
        source_link = self._data.get('sourceLink')
        creator = self._data.get('creator')
        
        if license_name and source_link and creator:
            return AttributionBundle(license_name, source_link, creator)
        
        return None
    
    def get_with_attribution(self) -> Dict:
        """
        The ONLY way to access node data.
        For CC content, attribution is always included.
        """
        result = self._data.copy()
        
        if self._attribution:
            result['_attribution'] = self._attribution.to_dict()
        
        return result
    
    @property 
    def id(self) -> str:
        """Safe to access ID without full attribution"""
        return self._data.get('@id', '')
    
    @property
    def title(self) -> str:
        """Safe to access title without full attribution"""
        return self._data.get('title', '')


class UsageEnforcedAPI:
    """
    API that enforces attribution inclusion at point of use.
    
    All retrieval operations return data with attribution bundled.
    """
    
    def __init__(self, graph_data: Dict):
        self.nodes_by_id = {
            node['@id']: node 
            for node in graph_data.get('@graph', [])
        }
    
    def get_node(self, node_id: str) -> Optional[Dict]:
        """
        ENFORCEMENT POINT 1: Node retrieval
        Returns node with mandatory attribution bundle for CC content
        """
        node_data = self.nodes_by_id.get(node_id)
        if not node_data:
            return None
        
        try:
            attributed = AttributedNode(node_data)
            return attributed.get_with_attribution()
        except UsageError as e:
            print(f"Usage blocked: {e}")
            return None
    
    def create_reference(
        self,
        source_node_id: str,
        reference_context: Dict
    ) -> Dict:
        """
        ENFORCEMENT POINT 2: Reference creation
        When linking to CC content, attribution must be in context
        """
        source_node = self.nodes_by_id.get(source_node_id)
        if not source_node:
            return {'success': False, 'error': 'Source node not found'}
        
        # Check if source is CC-licensed
        license_name = source_node.get('licenseName', '')
        if license_name.startswith('CC'):
            # Verify reference context includes attribution
            required = ['sourceLink', 'creator']
            missing = [f for f in required if not reference_context.get(f)]
            
            if missing:
                return {
                    'success': False,
                    'error': f'Cannot reference CC-licensed node without: {", ".join(missing)}'
                }
        
        # Create reference with embedded attribution
        reference = {
            'sourceNode': source_node_id,
            'context': reference_context,
            'created': '2025-11-08T00:00:00Z'
        }
        
        # Force attribution into reference
        if license_name.startswith('CC'):
            reference['_attribution'] = {
                'licenseName': license_name,
                'sourceLink': source_node['sourceLink'],
                'creator': source_node['creator']
            }
        
        return {'success': True, 'reference': reference}
    
    def query_nodes(self, filters: Dict) -> List[Dict]:
        """
        ENFORCEMENT POINT 3: Query results
        All CC-licensed results include attribution automatically
        """
        # Simple filtering (real implementation would be more sophisticated)
        results = []
        for node in self.nodes_by_id.values():
            # Apply filters...
            if self._matches_filters(node, filters):
                # Ensure attribution for CC content
                attributed = self.get_node(node['@id'])
                if attributed:
                    results.append(attributed)
        
        return results
    
    def _matches_filters(self, node: Dict, filters: Dict) -> bool:
        """Simple filter matching"""
        if not filters:
            return True
        
        for key, value in filters.items():
            if node.get(key) != value:
                return False
        return True


class NodeRenderer:
    """
    ENFORCEMENT POINT 4: Display/Rendering
    Automatically includes attribution in rendered output
    """
    
    def render_html(self, node: Dict) -> str:
        """Render node as HTML with automatic attribution"""
        html = f'<div class="discourse-node" data-id="{node.get("@id")}">\n'
        html += f'  <h3>{node.get("title")}</h3>\n'
        html += f'  <div class="content">{node.get("content", "")}</div>\n'
        
        # Automatic attribution footer for CC content
        if '_attribution' in node:
            attr = node['_attribution']
            html += f'  <div class="attribution-required">\n'
            html += f'    <p><strong>License:</strong> {attr["licenseName"]}</p>\n'
            html += f'    <p><strong>Source:</strong> <a href="{attr["sourceLink"]}">{attr["sourceLink"]}</a></p>\n'
            html += f'    <p><strong>Creator:</strong> {attr["creator"]}</p>\n'
            html += f'  </div>\n'
        
        html += '</div>'
        return html
    
    def render_markdown(self, node: Dict) -> str:
        """Render node as Markdown with automatic attribution"""
        md = f"# {node.get('title')}\n\n"
        md += f"{node.get('content', '')}\n\n"
        
        # Automatic attribution section for CC content
        if '_attribution' in node:
            attr = node['_attribution']
            md += "---\n\n"
            md += "**Attribution Required**\n\n"
            md += f"- License: {attr['licenseName']}\n"
            md += f"- Source: [{attr['sourceLink']}]({attr['sourceLink']})\n"
            md += f"- Creator: {attr['creator']}\n"
        
        return md


class NodeExporter:
    """
    ENFORCEMENT POINT 5: Export operations
    Attribution is mandatory in all export formats
    """
    
    def export_json(self, nodes: List[Dict]) -> str:
        """
        Export to JSON - attribution fields are always included
        """
        import json
        
        # Attribution fields are non-negotiable for CC content
        export_data = []
        for node in nodes:
            # Always include attribution if present
            export_data.append(node)
        
        return json.dumps(export_data, indent=2)
    
    def export_citation(self, node: Dict, format: str = 'apa') -> str:
        """
        Generate citation - requires attribution for CC content
        """
        if '_attribution' not in node:
            # No attribution required
            return f"{node.get('title')} (source information not available)"
        
        attr = node['_attribution']
        
        if format == 'apa':
            return (
                f"{attr['creator']}. {node.get('title')}. "
                f"Retrieved from {attr['sourceLink']}. "
                f"Licensed under {attr['licenseName']}."
            )
        else:
            return (
                f"{attr['creator']}, \"{node.get('title')}\", "
                f"{attr['sourceLink']} ({attr['licenseName']})"
            )


# Example usage and tests
if __name__ == '__main__':
    
    # Sample graph
    graph = {
        '@graph': [
            {
                '@id': 'pages:evidence-001',
                '@type': 'pages:zsoX6_bEl',
                'title': 'Cell migration increases under stimulus',
                'content': 'We observed 2x increase in migration speed...',
                'licenseName': 'CC BY 4.0',
                'licenseLink': 'https://creativecommons.org/licenses/by/4.0/',
                'sourceLink': 'https://lab.example.com/dataset-001',
                'creator': 'Jane Smith'
            },
            {
                '@id': 'pages:evidence-002',
                '@type': 'pages:zsoX6_bEl',
                'title': 'Temperature affects enzyme activity',
                'content': 'Enzyme activity peaks at 37°C...',
                'licenseName': 'All Rights Reserved',
                'creator': 'John Doe'
            }
        ]
    }
    
    api = UsageEnforcedAPI(graph)
    renderer = NodeRenderer()
    exporter = NodeExporter()
    
    print("=" * 70)
    print("ENFORCEMENT POINT 1: Node Retrieval")
    print("=" * 70)
    node = api.get_node('pages:evidence-001')
    print(f"Retrieved node: {node.get('title')}")
    print(f"Has attribution bundle: {'_attribution' in node}")
    if '_attribution' in node:
        print(f"Attribution: {node['_attribution']}")
    print()
    
    print("=" * 70)
    print("ENFORCEMENT POINT 2: Reference Creation")
    print("=" * 70)
    
    # Try creating reference WITHOUT attribution (should fail)
    result1 = api.create_reference(
        'pages:evidence-001',
        {'citation': 'Smith 2024'}  # Missing sourceLink and creator!
    )
    print(f"Reference without attribution: {result1['success']}")
    if not result1['success']:
        print(f"  Error: {result1['error']}")
    print()
    
    # Try creating reference WITH attribution (should succeed)
    result2 = api.create_reference(
        'pages:evidence-001',
        {
            'citation': 'Smith 2024',
            'sourceLink': 'https://lab.example.com/dataset-001',
            'creator': 'Jane Smith'
        }
    )
    print(f"Reference with attribution: {result2['success']}")
    if result2['success']:
        print(f"  Has embedded attribution: {'_attribution' in result2['reference']}")
    print()
    
    print("=" * 70)
    print("ENFORCEMENT POINT 3: Query Results")
    print("=" * 70)
    results = api.query_nodes({'@type': 'pages:zsoX6_bEl'})
    print(f"Query returned {len(results)} nodes")
    for r in results:
        has_attr = '_attribution' in r
        print(f"  - {r['title']}: Attribution included = {has_attr}")
    print()
    
    print("=" * 70)
    print("ENFORCEMENT POINT 4: Rendering")
    print("=" * 70)
    html = renderer.render_html(node)
    print("HTML output includes attribution:")
    print(html)
    print()
    
    print("=" * 70)
    print("ENFORCEMENT POINT 5: Export")
    print("=" * 70)
    citation = exporter.export_citation(node, format='apa')
    print(f"Citation: {citation}")
