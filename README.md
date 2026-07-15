# Orbit — Agentic Product Studio

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/xiaolianlian111/orbit-agentic-product-studio)

**Live demo:** https://orbit-agentic-product-studio-111.onrender.com

Orbit turns a plain-language product idea into a working, interactive web app. It is an Atoms-inspired take-home demo focused on one belief: the valuable part of AI app generation is not a chat box, but a visible, reversible product workflow.

## What the reviewer can do

1. Complete the lightweight builder onboarding.
2. Describe a product in Chinese or English, or start from a suggested idea.
3. Watch four specialized agents shape, design, build, and test the product.
4. Use the generated application directly in the preview:
   - add records;
   - search and filter;
   - complete/toggle records;
   - switch between overview, insights, and settings;
   - refresh without losing generated application data.
5. Refine the product through another prompt.
6. Enable **Race Mode** to compare two generated visual directions and promote one.
7. Inspect the product blueprint and data model.
8. Restore any previous version as a new checkpoint.
9. Preview desktop, tablet, and mobile layouts.
10. Export the generated product as a standalone HTML file.

## Product highlights

### Observable multi-agent workflow

Four agents have explicit responsibilities and produce reviewable intermediate artifacts:

- **Mira / Product strategist** — product contract, target user, and success signal.
- **Noa / Experience architect** — primary journey and usability constraints.
- **Kai / Full-stack engineer** — interactive application and persisted data states.
- **Sage / Quality lead** — preflight checks for interaction, persistence, and responsiveness.

### Race Mode

The same intent can produce two visual directions. The builder compares both running applications and chooses which one becomes the next saved version. This is a practical extension of the usual linear chat-to-app flow.

### Two-layer persistence

- Orbit projects, messages, and versions persist in browser `localStorage`.
- Each generated app stores its own user-created records and completion states separately.

### Resilient generation

The Render-compatible Node service at `server.js` uses an OpenAI model when `OPENAI_API_KEY` is configured. If the provider is unavailable or unconfigured, Orbit falls back to an on-device product agent that supports seven product patterns:

- tasks / project management;
- finance / expense tracking;
- habits / routines;
- CRM / lead management;
- inventory;
- events / RSVPs;
- a generic operational dashboard.

The fallback is deliberate: a reviewer can always complete the full workflow without credentials or a healthy third-party service.

## Architecture

```text
Builder prompt
     │
     ▼
Product workflow ── PM → UX → Engineer → QA
     │
     ├── /api/generate (Render Node service, model configured)
     └── local structured agent (resilient fallback)
     │
     ▼
Validated product spec
     │
     ├── Blueprint + data model
     ├── Version checkpoint / Race candidate
     └── Interactive srcdoc application
            └── isolated application persistence
```

The generator returns a constrained product specification rather than arbitrary JavaScript. Orbit owns the renderer and interaction primitives. This reduces hallucinated dependencies, broken builds, and unsafe code execution while keeping the generated experience meaningfully different by product intent.

## Run locally

Run the same Node service used by Render:

```powershell
cd outputs/atoms-demo
npm install
npm start
```

Then open `http://localhost:10000`.

For frontend-only testing, the app can also be opened directly from `index.html` or served with `python -m http.server 4178`. Storage access is guarded for browsers that restrict `localStorage` on `file://`; real model generation requires the Node service.

## Deploy to Render

1. Push this folder to a public GitHub repository.
2. In Render, select **New → Blueprint** and point it at the repository. Render detects `render.yaml` and creates the Web Service.
3. In the service's **Environment** page, set the secret below, then redeploy:

```text
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4.1-mini
```

4. Deploy and test the resulting `onrender.com` URL in a private/incognito window.

Without environment variables, every core flow still works through the deterministic local agent.

The service uses Render's assigned `PORT` automatically and serves both the frontend and `/api/generate`; no CORS configuration is needed because they share an origin.

## Verification

The checked-in application was tested in a real headless Microsoft Edge session across the full flow:

- onboarding completed;
- prompt submitted;
- all four agent stages completed;
- generated project rendered;
- generated iframe loaded 80 style rules;
- generated list rendered three interactive records;
- custom add dialog opened and created a persisted fourth record;
- project, version, and generated record all survived a full page reload;
- mobile preview rendered at 390 px and switched the generated app to a single-column layout;
- public assets returned `200`, while server source and environment-file paths returned `404`.

Static checks were also run against both the studio script and the dynamically generated inline application script.

## Deliberate tradeoffs

- **No authentication service:** onboarding is intentionally local; adding auth before proving the core workflow would increase failure surface without improving the demo's central claim.
- **Constrained schema over arbitrary code generation:** reliability and reviewer testability matter more than supporting every possible application category in this time box.
- **Local persistence over a hosted database:** it demonstrates real persistence with zero setup. The storage adapter is isolated so a hosted relational backend can replace it later.
- **Export instead of one-click production deployment:** external deployment needs explicit credentials and ownership. Orbit completes a production preflight and exports an owned artifact.

## Next priorities

1. Add authenticated cloud projects and cross-device sync.
2. Stream model output and agent artifacts instead of waiting for a complete JSON response.
3. Add a visual element inspector with targeted natural-language edits.
4. Generate backend actions from a constrained server-function schema.
5. Add collaborative review links, comments, and version diffs.
6. Add automated accessibility and interaction tests to the QA agent.
