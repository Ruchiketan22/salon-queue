# AGENTS.md — Salon Queue Management

Queue app for a salon: customers join from their phone, watch their wait time and get called; reception and barbers run the queue; a TV in the waiting area shows who is next.

## Read first
- docs/01-brief.md -> features and what NOT to build
- docs/02-screens.md -> every screen's layout and behaviour
- docs/03-flows-rules.md -> flows, queue rules, test checklist

If code and docs disagree, the docs win. Ask me before changing a doc.

## Stack
- Frontend: React + Vite + TypeScript + Tailwind CSS
- Backend: Node + Express, SQLite for storage, Socket.IO for live updates
- Run everything with `npm run dev` (frontend and backend together)
- Before adding any other library or storage, explain the choice in 3 lines and wait for my OK
- Hosting: Vercel (frontend), Render (backend). No `localhost` URLs in the code; use environment variables
- The first line after the title in README.md must be the live link

## How to work
- Always use the system Node 22 that `node -v` shows. Never switch Node versions (no fnm or nvm). Never run npm install or npm rebuild unless I ask, because it breaks better-sqlite3 for my Node 22.
- One screen or one feature per task. Don't touch other screens.
- Plan first for big steps: show the plan and files you will create, then wait for my OK.
- Theme: charcoal (#1F2937) + gold (#D4A017), rounded cards, mobile-first (390px wide), then tablet and TV.
- All visible text comes from the EN/GU language file. No hard-coded labels.
- Queue rules (who is next, wait time, status moves) live in ONE module on the backend. Frontend only displays results; never re-implement rules there.
- Enforce rules and validation on the backend, not only in the UI.
- Tap targets on phone screens are at least 44px.
- Use realistic dummy data: Indian names, ₹ prices, barbers Ravi, Amit, Imran.
- Never add features from the "Don't build" list in docs/01-brief.md.
- Do not claim something works unless you ran and tested it.
- After each task: list the changed files and how I can test the change by hand.
