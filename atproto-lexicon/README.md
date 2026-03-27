# Discourse Graphs ATProto Lexicon (Prototype)

**NSID namespace:** `org.discoursegraphs.*`

## Overview

This is a prototype ATProto Lexicon for the Discourse Graphs protocol — a schema
for federated scientific synthesis infrastructure built on structured networks of
claims, evidence, and their relationships.

The design follows two sets of principles simultaneously:

**From the Discourse Grammar spec:**
- Base schema of 4 node types (Question, Claim, Evidence, Source) + 4 relation types
  (Supports, Opposes, Addresses, Informs)
- Claims and evidence are deliberately separate first-class types
- Relations are reified (separate assertions with own metadata), not node attributes
- Incremental formalization: nodes born with minimal required formality, progressively
  refined with affordances and payoffs at each level
- Local label variations mapped to base types for interoperability

**From ATProto Lexicon conventions (Lexinomicon):**
- lowerCamelCase for field names
- Open unions and knownValues (not closed enums) for extensibility
- Fields not marked required unless truly necessary for functionality
- Designed for forward/backward compatibility and schema evolution
- Records keyed by TID for natural ordering

## Lexicon Files

### Core (Base Schema)

| File | NSID | Type | Description |
|------|------|------|-------------|
| `defs.json` | `org.discoursegraphs.defs` | defs | Shared types: epistemicStatus, localLabel, sourceRef, provenanceInfo |
| `question.json` | `org.discoursegraphs.question` | record | Research questions organizing inquiry |
| `claim.json` | `org.discoursegraphs.claim` | record | Assertional statements with epistemic status |
| `evidence.json` | `org.discoursegraphs.evidence` | record | Evidence bundles: interpretation + artifact reference |
| `source.json` | `org.discoursegraphs.source` | record | Source documents, datasets, experiments |
| `supports.json` | `org.discoursegraphs.supports` | record | Reified support relations |
| `opposes.json` | `org.discoursegraphs.opposes` | record | Reified opposition relations |
| `addresses.json` | `org.discoursegraphs.addresses` | record | Claim-addresses-question relations |
| `informs.json` | `org.discoursegraphs.informs` | record | Source-informs-evidence (and other informing) relations |

### Extensions

| File | NSID | Variation | Description |
|------|------|-----------|-------------|
| `issue.json` | `org.discoursegraphs.issue` | Lab | Future experiment / investigation to resolve evidence gaps |
| `pattern.json` | `org.discoursegraphs.pattern` | HCI | Conceptual design patterns abstracted from implementations |
| `artifact.json` | `org.discoursegraphs.artifact` | HCI | Concrete systems instantiating patterns |
| `endorsement.json` | `org.discoursegraphs.endorsement` | Core | Accountability layer: belief/validation of statements |

## Key Design Decisions

### Why relations are separate records (not embedded)
The spec is explicit: "relations should be separate assertions (with their own metadata)
rather than attributes of a discourse node." This means every support/oppose/address
relation is its own record with:
- Its own author (via ATProto repo ownership)
- Its own provenance (manual, AI-assisted, etc.)
- Its own timestamp
- Optional warrant (the reasoning justifying the relation)

This is critical for the accountability layer. When scientist A says evidence E supports
claim C, that's a distinct assertional act from scientist B saying the same thing. The
relation records capture this.

### Incremental formalization via optional fields
Almost every field except the core text content and createdAt is optional. A claim can
start as just a sentence. Over time, the author (or AI assistance) can add:
- epistemicStatus (is this a hypothesis? a well-supported claim?)
- localLabel (what does my community call this?)
- tags, provenance, etc.

This matches the spec's principle that "discourse graph entities [should] be born with
only the absolute minimum required formality."

### knownValues, not enums
ATProto's knownValues pattern (open string with documented known values) is used for
epistemicStatus, relationStrength, sourceType, etc. This means:
- Communities can extend with their own values without breaking schema
- Old clients gracefully handle new values they don't recognize
- No schema migration needed when a new community adds "conjecture" as an
  epistemic status

### Local labels for interoperability
The localLabel type lets a community say "we call claims 'hypotheses' in our lab" while
the base type mapping ensures federation still works. An appview aggregating across
communities can display local labels while querying on base types.

### Provenance as a first-class concern
Every node and relation carries optional provenanceInfo following PROV-O semantics:
- wasGeneratedBy: manual authoring vs. AI-assisted extraction
- wasAttributedTo: the responsible agent (DID)
- validatedBy: who has reviewed AI-generated content
- derivedFrom: what records this was derived from

This is essential for the tiered trust model: personal graphs → community synthesis →
cross-community federation.

## Example: E. coli Glucose Repression (Lab Discourse Graph)

```json
// A researcher's question
{
  "$type": "org.discoursegraphs.question",
  "text": "What is the mechanism by which glucose represses lac operon expression in E. coli?",
  "tags": ["ecoli", "glucoseRepression", "lacOperon"],
  "createdAt": "2026-03-10T14:00:00Z"
}

// A claim addressing that question
{
  "$type": "org.discoursegraphs.claim",
  "text": "Glucose repression of the lac operon is primarily mediated by cAMP-CRP regulation rather than inducer exclusion.",
  "epistemicStatus": "hypothesis",
  "localLabel": {
    "label": "Hypothesis",
    "baseType": "org.discoursegraphs.claim"
  },
  "createdAt": "2026-03-10T14:05:00Z"
}

// Evidence from a specific experiment
{
  "$type": "org.discoursegraphs.evidence",
  "text": "In CRP knockout strains, lac operon expression was reduced by 95% even in the presence of IPTG and absence of glucose, indicating CRP is necessary for activation.",
  "localLabel": {
    "label": "Result",
    "baseType": "org.discoursegraphs.evidence"
  },
  "contextEntities": [
    { "name": "E. coli K-12 MG1655 ΔCRP", "entityType": "strain" },
    { "name": "β-galactosidase assay", "entityType": "method" }
  ],
  "createdAt": "2026-03-10T14:10:00Z"
}

// A support relation (reified — separate record with its own author)
{
  "$type": "org.discoursegraphs.supports",
  "subject": "at://did:plc:abc123/org.discoursegraphs.evidence/3lr...",
  "object": "at://did:plc:abc123/org.discoursegraphs.claim/3lr...",
  "strength": "strong",
  "warrant": "CRP knockout eliminates the regulatory pathway, so loss of expression directly implicates CRP-mediated activation as the dominant mechanism.",
  "provenance": {
    "wasGeneratedBy": "manualAuthoring",
    "wasAttributedTo": "did:plc:abc123"
  },
  "createdAt": "2026-03-10T14:15:00Z"
}

// An issue: a future experiment to strengthen the claim
{
  "$type": "org.discoursegraphs.issue",
  "text": "Measure inducer exclusion contribution by comparing intracellular IPTG concentrations in glucose+ vs glucose- conditions in wild-type and PTS mutant strains.",
  "motivatedBy": "at://did:plc:abc123/org.discoursegraphs.claim/3lr...",
  "status": "open",
  "createdAt": "2026-03-10T14:20:00Z"
}
```

## Relationship to Other Standards

| Standard | Role in this schema |
|----------|-------------------|
| ATProto | Transport, identity (DIDs), repo storage, federation |
| Nanopublications | Provenance-rich knowledge representation; DG records can be compiled to nanopubs |
| PROV-O | Semantics for provenanceInfo fields |
| ORCID | Can be linked via DID ↔ ORCID mapping in endorsement/provenance |
| SEPIO | Extensible scientific argument schemas; informs warrant and evidence structure |
| JSON-LD | Future: `@context` overlay mapping DG lexicons to RDF IRIs for semantic web interop |

## JSON-LD Interoperability Layer

While ATProto lexicons are not natively JSON-LD, records can be mapped to JSON-LD via
a context document. A future `org.discoursegraphs.context` could provide:

```json
{
  "@context": {
    "dg": "https://w3id.org/discoursegraphs/",
    "prov": "http://www.w3.org/ns/prov#",
    "schema": "http://schema.org/",
    "text": "schema:description",
    "claim": "dg:Claim",
    "evidence": "dg:Evidence",
    "supports": "dg:supports",
    "opposes": "dg:opposes",
    "wasGeneratedBy": "prov:wasGeneratedBy",
    "wasAttributedTo": "prov:wasAttributedTo"
  }
}
```

This enables discourse graph records to be consumed by semantic web tooling and
compiled into nanopublications without changing the ATProto data model.

## Open Questions

1. **Should the namespace be `org.discoursegraphs.*` or something under a domain
   the project controls?** The NSID needs to map to a domain for lexicon resolution.

2. **How should domain-specific entity types (cell lines, methods, etc.) interoperate?**
   Currently `contextEntities` on evidence is a simple array. Could these be their own
   records with community-managed type ontologies?

3. **Should endorsements reference specific versions of records?** ATProto records
   can be updated; an endorsement of version N might not apply to version N+1.

4. **How should cross-community "warrant disputes" be modeled?** When community A
   says method X is sufficient evidence and community B disagrees, this should surface
   as claims in the graph per the spec — but the UX pattern for this needs design.

5. **What's the right granularity for compilation to nanopublications?** A single
   DG supports relation might map to one nanopub, or a cluster of claim + evidence +
   relations might be one nanopub.
