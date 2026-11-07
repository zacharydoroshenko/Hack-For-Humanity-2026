# AI usage log

The hackathon rules say: *"Say what the AI did. Tell judges which models and agents you used."*
Add a line whenever an AI tool meaningfully helps.

## In the product (runtime)

| Model | Job | Where |
|---|---|---|
| Gemini (`GEMINI_MODEL`) | MTS alert text → structured closure (stop IDs, alternative) | `pipeline/gemini/normalize_alerts.py` |
| Gemini | Plain-English trip request → routing settings | `pipeline/gemini/prompts/parse_request.md` |
| Gemini | Step-by-step reroute explanation | `backend/explain.py` |

## In development (building it)

| Tool | What it did |
|---|---|
| Claude Code (Claude Opus 5.5) | Wrote ARCHITECTURE.md from the hackathon criteria, scaffolded the repo skeleton (contract, fixtures, backend stubs, frontend) |
| | |
