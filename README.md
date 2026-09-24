# AWS Exam Prep

AWS certification practice app with an AI tutor: RAG pipeline (query rewriting → retrieval → Cohere Rerank → answers with citations), semantic cache, answer verification / grounding, and input/output security guards (prompt-injection, PII and secret masking), covered by automated tests.

## Data not included

The question bank (`src/data/questions.json`), learner data (`data/`) and secrets (`.env`) are **not** part of this repository.
To run locally:

1. Copy `src/data/questions.sample.json` to `src/data/questions.json` (or supply your own question set).
2. Copy `.env.example` to `.env` and fill in your own values.
3. `npm install && npm run dev`

---

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
