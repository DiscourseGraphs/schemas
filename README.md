# Discourse Graphs: Structured Scientific Knowledge

This repository contains early-stage prototype specifications and schemas for creating **discourse graphs**—structured representations of scientific research as interconnected knowledge components. It is intendend for discussion.

## What Are Discourse Graphs?

**Discourse Graphs** provide a structured way to represent research as interconnected knowledge components:
- **Evidence** nodes capture discrete observations from experiments/datasets
- **Claims** express assertions or conclusions
- **Questions** represent research unknowns
- **Sources** hold supporting materials (code, datasets, design files, lab notes)

Typed relationships connect these nodes—Evidence supports or opposes Claims, Questions motivate research, Evidence is grounded in Sources.

This repository represents a conceptual schema that grounds discussion about discourse graphs: [conceptual-schema-draft.md](conceptual-schema-draft.md). 

The formal schema can be found as [Web Ontology Language (OWL/RDF)](https://discoursegraphs.com/schema/dg_core.ttl) and [ATProto lexicon](https://github.com/DiscourseGraphs/schemas/tree/main/atproto-lexicon). These formal schemas are drafts meant for further discussion. 

This repository also describes two exploratory, hypothetical approaches to working with discourse graphs:

1. **MyST Markdown Syntax** ([discourse-graphs-myst-spec.md](discourse-graphs-myst-spec.md)) - Embed discourse graph semantics directly in MyST Markdown documents using specialized directives and roles
2. **MESA** (Machine-Enforceable Schema for Attribution) - A JSON-based schema with automatic attribution enforcement for CC-licensed content

## Why This Matters

Traditional research papers bundle everything together. You can't easily:
- Reuse a single finding without copying entire papers
- Track which evidence supports which claims across papers
- Verify what code/data generated specific results
- Ensure attribution when content is remixed

Discourse graphs make research modular and linkable. The MyST Markdown syntax will make it easy to embed these semantics directly in your scientific documents. MESA will ensure that as evidence gets reused across research projects, attribution automatically comes along.

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


