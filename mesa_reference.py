"""
MESA: Machine-Enforceable Schema for Attribution
Node Reference Edition - Enforces attribution on retrieval
"""

from typing import Dict, List, Optional, Union
from dataclasses import dataclass


@dataclass
class AttributionBundle:
    """Required attribution fields that must travel with CC-licensed nodes"""
    license_name: str
    source_link: str
    creator: str
    
    def to_dict(self) -> Dict:
        return {
            'licenseName': self.license_name,
            'sourceLink': self.source_link,
            'creator': self.creator
        }


class MESAReference:
    """
    Enforces attribution requirements when nodes are retrieved/referenced.
    
    Core principle: CC-licensed nodes ALWAYS include attribution metadata.
    """
    
    def __init__(self, graph_data: Dict):
        self.nodes_by_id = {
            node['@id']: node 
            for node in graph_data.get('@graph', [])
        }
    
    def get_node(self, node_id: str) -> Optional[Dict]:
        """
        ENFORCEMENT POINT: Retrieve a node with required attribution
        
        If node has CC license, automatically includes:
        - licenseName
        - sourceLink  
        - creator
        
        Returns None if node not found or missing required attribution.
        """
        node = self.nodes_by_id.get(node_id)
        if not node:
            return None
        
        # Check if this is CC-licensed content
        license_name = node.get('licenseName', '')
        if license_name.startswith('CC'):
            # Verify required attribution fields exist
            attribution = self._extract_attribution(node)
            if not attribution:
                # Cannot serve CC content without complete attribution
                print(f"WARNING: Node {node_id} has CC license but missing attribution fields")
                return None
            
            # Return node with guaranteed attribution fields
            return self._bundle_with_attribution(node, attribution)
        
        # Non-CC content can be returned as-is
        return node
    
    def get_nodes(self, node_ids: List[str]) -> List[Dict]:
        """
        Retrieve multiple nodes with enforcement
        
        Any CC-licensed nodes automatically include attribution.
        Nodes with incomplete attribution are excluded.
        """
        nodes = []
        for node_id in node_ids:
            node = self.get_node(node_id)
            if node:
                nodes.append(node)
        return nodes
    
    def get_node_with_dependencies(self, node_id: str) -> Dict:
        """
        Retrieve a node along with all nodes it references (via GroundedIn)
        
        All CC-licensed nodes in the tree include attribution.
        """
        node = self.get_node(node_id)
        if not node:
            return None
        
        # Find all GroundedIn references
        grounded_in_ids = self._extract_grounded_in_refs(node)
        dependencies = self.get_nodes(grounded_in_ids)
        
        return {
            'node': node,
            'dependencies': dependencies
        }
    
    def _extract_attribution(self, node: Dict) -> Optional[AttributionBundle]:
        """Extract required attribution fields from node"""
        license_name = node.get('licenseName', '')
        source_link = node.get('sourceLink', '')
        creator = node.get('creator', '')
        
        # All three must be present and non-empty
        if license_name.startswith('CC') and source_link and creator:
            return AttributionBundle(
                license_name=license_name,
                source_link=source_link,
                creator=creator
            )
        
        return None
    
    def _bundle_with_attribution(
        self, 
        node: Dict, 
        attribution: AttributionBundle
    ) -> Dict:
        """
        Ensure attribution fields are explicitly included in node data.
        
        Even if fields exist in node, we explicitly add them to guarantee
        they're present in any view/export of this data.
        """
        bundled = node.copy()
        bundled.update(attribution.to_dict())
        return bundled
    
    def _extract_grounded_in_refs(self, node: Dict) -> List[str]:
        """Extract node IDs that this node is GroundedIn"""
        # This is simplified - in reality would parse the content or
        # look at a separate relations structure
        refs = []
        content = node.get('content', '')
        
        # Simple extraction (would be more sophisticated in practice)
        if 'derivedFrom' in node:
            refs.append(node['derivedFrom'])
        
        return refs
    
    def validate_node_for_retrieval(self, node_id: str) -> tuple[bool, Optional[str]]:
        """
        Check if a node can be retrieved according to MESA rules.
        
        Returns: (can_retrieve, error_message)
        """
        node = self.nodes_by_id.get(node_id)
        if not node:
            return False, f"Node {node_id} not found"
        
        license_name = node.get('licenseName', '')
        if license_name.startswith('CC'):
            # Check required fields
            missing = []
            if not node.get('sourceLink'):
                missing.append('sourceLink')
            if not node.get('creator'):
                missing.append('creator')
            
            if missing:
                return False, f"CC-licensed node missing required fields: {', '.join(missing)}"
        
        return True, None


# Example API integration
class DiscourseGraphAPI:
    """API that enforces MESA on all retrievals"""
    
    def __init__(self, mesa: MESAReference):
        self.mesa = mesa
    
    def get_node(self, node_id: str) -> Dict:
        """
        API endpoint: Get a single node
        Automatically includes attribution for CC-licensed content
        """
        # Validate first
        can_retrieve, error = self.mesa.validate_node_for_retrieval(node_id)
        if not can_retrieve:
            return {
                'success': False,
                'error': error
            }
        
        # Retrieve with enforcement
        node = self.mesa.get_node(node_id)
        if not node:
            return {
                'success': False,
                'error': 'Node not available (missing required attribution)'
            }
        
        return {
            'success': True,
            'data': node
        }
    
    def get_evidence_panel(self, evidence_id: str) -> Dict:
        """
        API endpoint: Get evidence with all its dependencies
        All CC-licensed nodes include attribution
        """
        result = self.mesa.get_node_with_dependencies(evidence_id)
        if not result:
            return {
                'success': False,
                'error': 'Evidence not found or incomplete attribution'
            }
        
        return {
            'success': True,
            'data': result
        }


# Example usage and tests
if __name__ == '__main__':
    
    # Sample graph data
    graph = {
        '@graph': [
            {
                '@id': 'pages:evidence-001',
                '@type': 'pages:zsoX6_bEl',
                'title': 'Cell migration increases under stimulus',
                'licenseName': 'CC BY 4.0',
                'licenseLink': 'https://creativecommons.org/licenses/by/4.0/',
                'sourceLink': 'https://example.com/dataset-001',
                'creator': 'Jane Smith',
                'content': 'Detailed findings...'
            },
            {
                '@id': 'pages:evidence-002',
                '@type': 'pages:zsoX6_bEl',
                'title': 'Another finding',
                'licenseName': 'CC BY 4.0',
                'sourceLink': 'https://example.com/dataset-002',
                # Missing creator!
                'content': 'More findings...'
            },
            {
                '@id': 'pages:source-001',
                '@type': 'pages:rVONqNC48',
                'title': 'Research Dataset',
                'licenseName': 'CC0 1.0',
                'sourceLink': 'https://example.com/raw-data',
                'creator': 'Lab Team'
            }
        ]
    }
    
    mesa = MESAReference(graph)
    api = DiscourseGraphAPI(mesa)
    
    print("=" * 60)
    print("Test 1: Retrieve valid CC-licensed evidence")
    print("=" * 60)
    response = api.get_node('pages:evidence-001')
    if response['success']:
        node = response['data']
        print(f"✓ Retrieved: {node['title']}")
        print(f"  License: {node['licenseName']}")
        print(f"  Source: {node['sourceLink']}")
        print(f"  Creator: {node['creator']}")
    else:
        print(f"✗ {response['error']}")
    print()
    
    print("=" * 60)
    print("Test 2: Attempt to retrieve CC-licensed node missing creator")
    print("=" * 60)
    response = api.get_node('pages:evidence-002')
    if response['success']:
        print(f"✓ Retrieved: {response['data']['title']}")
    else:
        print(f"✗ BLOCKED: {response['error']}")
    print()
    
    print("=" * 60)
    print("Test 3: Validation check before retrieval")
    print("=" * 60)
    for node_id in ['pages:evidence-001', 'pages:evidence-002']:
        can_retrieve, error = mesa.validate_node_for_retrieval(node_id)
        if can_retrieve:
            print(f"✓ {node_id}: Ready for retrieval")
        else:
            print(f"✗ {node_id}: {error}")
    print()
    
    print("=" * 60)
    print("Test 4: Bulk retrieval")
    print("=" * 60)
    nodes = mesa.get_nodes(['pages:evidence-001', 'pages:evidence-002', 'pages:source-001'])
    print(f"Requested 3 nodes, successfully retrieved {len(nodes)} nodes")
    print("Retrieved nodes:")
    for node in nodes:
        print(f"  - {node['title']} (creator: {node.get('creator', 'N/A')})")
