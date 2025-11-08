"""
Test MESA JSON Schema validation
"""

import json
from jsonschema import validate, ValidationError

# Load the schema
with open('/home/claude/mesa_schema.json', 'r') as f:
    schema = json.load(f)

print("=" * 60)
print("MESA JSON Schema Validation Tests")
print("=" * 60)
print()

# Test 1: Valid CC-licensed evidence with all required fields
test1 = {
    "@id": "pages:test-001",
    "@type": "pages:zsoX6_bEl",
    "title": "Test Evidence",
    "licenseName": "CC BY 4.0",
    "licenseLink": "https://creativecommons.org/licenses/by/4.0/",
    "sourceLink": "https://example.com/data",
    "creator": "Jane Smith"
}

print("Test 1: Valid CC-licensed evidence")
try:
    validate(instance=test1, schema=schema)
    print("✓ VALID - Has CC license with sourceLink and creator")
except ValidationError as e:
    print(f"✗ INVALID: {e.message}")
print()

# Test 2: CC-licensed evidence missing sourceLink
test2 = {
    "@id": "pages:test-002",
    "@type": "pages:zsoX6_bEl",
    "title": "Test Evidence",
    "licenseName": "CC BY 4.0",
    "creator": "Jane Smith"
    # Missing sourceLink!
}

print("Test 2: CC-licensed evidence missing sourceLink")
try:
    validate(instance=test2, schema=schema)
    print("✗ Should have failed validation!")
except ValidationError as e:
    print(f"✓ BLOCKED - {e.message}")
print()

# Test 3: CC-licensed evidence missing creator
test3 = {
    "@id": "pages:test-003",
    "@type": "pages:zsoX6_bEl",
    "title": "Test Evidence",
    "licenseName": "CC BY 4.0",
    "sourceLink": "https://example.com/data"
    # Missing creator!
}

print("Test 3: CC-licensed evidence missing creator")
try:
    validate(instance=test3, schema=schema)
    print("✗ Should have failed validation!")
except ValidationError as e:
    print(f"✓ BLOCKED - {e.message}")
print()

# Test 4: Non-CC-licensed evidence (no requirements)
test4 = {
    "@id": "pages:test-004",
    "@type": "pages:zsoX6_bEl",
    "title": "Test Evidence",
    "licenseName": "All Rights Reserved"
    # No sourceLink or creator needed for non-CC
}

print("Test 4: Non-CC-licensed evidence (no attribution required)")
try:
    validate(instance=test4, schema=schema)
    print("✓ VALID - Non-CC license doesn't require sourceLink/creator")
except ValidationError as e:
    print(f"✗ INVALID: {e.message}")
print()

# Test 5: Valid CC-licensed source
test5 = {
    "@id": "pages:test-005",
    "@type": "pages:rVONqNC48",
    "title": "Test Dataset",
    "licenseName": "CC0 1.0",
    "sourceLink": "https://example.com/dataset",
    "creator": "Research Team",
    "sourceType": "Dataset"
}

print("Test 5: Valid CC-licensed source")
try:
    validate(instance=test5, schema=schema)
    print("✓ VALID - Source with CC license and required fields")
except ValidationError as e:
    print(f"✗ INVALID: {e.message}")
print()

# Test 6: CC-licensed source with empty creator
test6 = {
    "@id": "pages:test-006",
    "@type": "pages:rVONqNC48",
    "title": "Test Dataset",
    "licenseName": "CC BY 4.0",
    "sourceLink": "https://example.com/dataset",
    "creator": ""  # Empty string not allowed
}

print("Test 6: CC-licensed source with empty creator")
try:
    validate(instance=test6, schema=schema)
    print("✗ Should have failed validation!")
except ValidationError as e:
    print(f"✓ BLOCKED - {e.message}")
print()

print("=" * 60)
print("Summary: MESA enforces CC licenses require sourceLink + creator")
print("=" * 60)
