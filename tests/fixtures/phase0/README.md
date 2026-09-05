# Phase 0 golden fixtures

These synthetic documents contain no real personal or financial data. They are
generated for this repository and may be used to validate whole-document image
and PDF extraction.

- `receipt.png`: clear, single-page photographed-receipt analogue.
- `invoice.pdf`: digital, single-page invoice.
- `expected.json`: fields used for the initial accuracy check.

Upload both files from the protected `/app` route. Compare the validated JSON
with `expected.json`; the UI reports processing latency, token usage, and the
estimated Gateway model cost for each extraction.
