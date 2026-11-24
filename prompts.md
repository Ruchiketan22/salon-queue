# prompts.md — Prompts used, in order

Every prompt I actually sent to the AI agent (Google Antigravity, models Claude Sonnet 4.6 / Claude Opus 4.6 / GPT-OSS 120B as quota allowed), in order. Local setup, deployment and bug-fixing steps I did by hand in the terminal are included for completeness.

---
## Step 1 — Understand & set up
**Prompt 1.1**
Read AGENTS.md and all of docs/. Summarise the app in 8 bullets and list any questions. Don't write code yet.
Result: WORKED. The agent correctly summarised the app and asked 5 clarifying questions about PIN session persistence, remembering the customer's token on the device, how wait time should work for a customer who picked a specific barber, when the daily token counter resets, and whether to auto-seed demo data.

**Prompt 1.2 (answers)**
Gave simple answers for all 5 questions (store PIN login and the customer's active token in localStorage; use the general wait-time formula for everyone; reset tokens by calendar date; auto-seed the 5 services and 3 barbers on first launch).
Result: WORKED. Agent asked 4 more small questions (barber photos, clearing the saved token on terminal states, TV chime autoplay, case-insensitive barber routes). Answered yes to all four.

**Prompt 1.3 (setup)**
Set up React + Vite + TypeScript + Tailwind, an Express backend, SQLite and Socket.IO with a clean folder structure. Add a health-check endpoint and one `npm run dev` command that starts both. Create empty pages for all 7 screens, the charcoal + gold theme and the EN/GU language toggle. Do not build screen content yet. List changed files and test commands.
Result: WORKED. Project scaffolded, health check endpoint, theme and language toggle all in place.

## Step 2 — Home + Join Queue
**Prompt 2.1**
Build Screen 1 (Home) and Screen 2 (Join Queue) from docs/02-screens.md, connected to the backend with the seeded services and barbers. Validate the 10-digit phone number and the 3-service limit. The live summary must update as services are selected. Mobile-first. Don't touch other screens. List the changed files and how to test.
Result: WORKED. Home and Join screens built with validation, barber chips, duplicate-phone check and live summary bar.

## Step 3 — My Status
**Prompt 3.1**
Build Screen 3 (My Status, /status/:id) from docs/02-screens.md. Show the large token, position in line, the chosen barber and services, and a circular countdown of the estimated wait that updates by itself. Use the wait-time rule in docs/03-flows-rules.md and the backend queue rules module. Add all the states: Waiting, "Start coming to the salon" when 2nd in line, the barber on-break notice, the full-screen gold "It's your turn!" screen with pulse animation and phone vibration when Called, In chair, Done, and No-show with a "Join again" button. Add [ Cancel my spot ] with a confirmation pop-up, only while Waiting. Clear the saved token from localStorage on Done, Cancelled or No-show when the customer clicks "Back to home" or "Join again". The page must update live through Socket.IO. Don't touch other screens. List the changed files and how to test.
Result: WORKED. All 8 visual states, circular SVG progress ring, cancel confirmation modal, and localStorage cleanup implemented.

## Step 4 — Reception Dashboard
**Prompt 4.1**
Build the Reception Dashboard (Screen 4, /reception) from docs/02-screens.md for a 10-inch tablet in landscape. Add the PIN gate for staff screens (reception PIN 1111, saved in localStorage). Customers who join from a phone must appear automatically through Socket.IO. Include: barber cards with status, current customer and time left, and [ Call next ] (enabled only when that barber is free and not on break); the waiting list in order with token, name, services, preferred barber and waiting time; [ + Add walk-in ] with a quick form; [ No-show ] on Called rows and [ Cancel ] on Waiting rows; amber highlight for waits over 60 minutes; and a 10-minute countdown on Called rows. Implement Call next on the backend in the central queue rules module, following docs/03-flows-rules.md exactly: pick the earliest Waiting customer who chose that barber or "Any barber", and never give a customer who chose Ravi to another barber. Don't touch other screens, and don't run npm install or npm rebuild. List the changed files, then give me 3 scenarios I can test by hand in the browser (no curl commands) to prove barber preferences are respected.
Result: PARTLY. Screen built correctly and the barber-preference logic passed all 3 hand-test scenarios. However, right after this prompt the backend crashed with a Node.js / better-sqlite3 version mismatch (NODE_MODULE_VERSION error), because Antigravity's test run used a different Node version (v20 via fnm) than the terminal (v22). Fixed by running `npm rebuild better-sqlite3` under Node 22, and adding a rule to AGENTS.md telling the agent never to switch Node versions or run npm install/rebuild on its own.

## Step 5 — Barber View + TV
**Prompt 5.1**
Build Barber View (Screen 5, /barber/:name, case-insensitive, with the barber PIN 2222 saved in localStorage) and the Waiting Area TV (Screen 6, /display, no PIN) from docs/02-screens.md. Barber View: current customer with name, services and a timer since start; big [ Start ] then [ Done ] buttons; a "Next for you" preview; and an On break / Available toggle. TV: one row per barber with avatar, name and "Now: S-12" (or Free / On break); an "Up next" list of 5 tokens with estimated times; a newly called token flashes gold with a synthesized Web Audio chime, plus a "Click anywhere to enable sound" banner if audio is blocked; text readable from 5 metres at 1920x1080. Enforce status moves on the backend (Called -> In chair -> Done) in the central queue rules module. Start, Done and On break must update Reception, the TV and the customer's phone within 5 seconds through Socket.IO. Don't touch other screens, and don't run npm install or npm rebuild. List the changed files, then give me hand-test steps I can do in the browser only (no curl or node -e commands).
Result: WORKED, across two agent sessions split by the free quota limit (Antigravity: "Your plan's baseline quota will refresh..."). Barber View and TV built, Socket.IO sync confirmed under 5 seconds in all directions.

## Step 6 — Owner Settings
**Prompt 6.1**
Build Owner Settings (Screen 7, /admin) from docs/02-screens.md, with the admin PIN 3333 saved in localStorage. Include: a services table (name in EN and GU, minutes, price, on/off toggle, [ Edit ] and [ + Add service ]); a toggle for each barber being on duty today; an Open / Closed switch for online joining; and today's stats cards (customers served, average wait, no-shows). Turning a service off must hide it from /join immediately. Closing the queue must disable the Join button on Home and /join with the message "Online queue is closed. Walk-ins are welcome at the salon.", and the backend must reject online joins while closed (walk-ins from Reception still work). Barbers not on duty must be hidden from the barber picker and not counted in wait time. Enforce all of this in the central queue rules module on the backend, and update other screens live through Socket.IO. Don't touch unrelated screens, and don't run npm install or npm rebuild. List the changed files, then give me hand-test steps I can do in the browser only (no curl or node -e commands).
Result: PARTLY. The agent hit the free quota limit again on every available model (Claude Sonnet 4.6, Claude Opus 4.6, GPT-OSS 120B) before finishing. The backend routes and rules it had already written worked correctly, but the Admin screen itself was left as a placeholder. I wrote the Owner Settings screen (src/screens/AdminScreen.tsx) and a small Join Queue update (src/screens/JoinScreen.tsx) by hand, reading the existing backend code to match its API exactly, since the agent quota could not be used.

## Step 7 — Rules, edge cases
Reviewed the codebase by hand against docs/03-flows-rules.md instead of spending more agent quota. Found that the no-show re-add rule, barber-on-break rules, cancel restrictions and empty states were already correctly implemented from earlier prompts. The only missing rule was the 8:30 PM online-queue cutoff, which I added by hand to server/queueRules.ts (off by default so the live demo link always works; can be switched on with an environment variable).

## Step 8 — Polish, test checklist
Checked every screen by hand in Gujarati and mobile view (390px width): no overflow or untranslated text found. Ran the full 16-item test checklist from docs/03-flows-rules.md by hand in the browser; all 16 passed, with item 10 (invalid status moves) verified by reading the backend code rather than by hand-testing, since the backend already rejects any move outside Waiting -> Called -> In chair -> Done.

## Step 9 — Deploy
Deployed by hand, no agent prompts:
- Backend on Render: connected the GitHub repo, build command `npm install && npm run build:server`, start command `npm start`.
- Frontend on Vercel: connected the GitHub repo, build command `npm run build:client`, output directory `dist`.
Hit and fixed 3 separate deploy bugs:
1. `better-sqlite3` failed to compile on Vercel because the project defaulted to Node.js 26, which has no prebuilt binary and no C++ compiler available to build one. Fixed by setting Node.js Version to 22.x in Vercel project settings.
2. The frontend called the backend using relative paths (fetch('/api/...')) and the wrong environment variable name (VITE_BACKEND_URL instead of the VITE_API_URL set on Vercel). Fixed by adding src/apiBase.ts and routing every fetch() and the Socket.IO client through it.
3. Visiting /join directly on Vercel returned a 404, because the app is a single-page app and Vercel didn't know to send every route to index.html. Fixed by adding a vercel.json with a rewrite rule (the file was initially saved by Windows as vercel.json.txt due to hidden extensions, which also had to be corrected).

## Fix & iterate prompts used in the middle of the above steps
**Prompt F1 (Node version rule)**
Add one rule to AGENTS.md under "How to work": "Always use the system Node 22 that `node -v` shows. Never switch Node versions (no fnm or nvm). Never run npm install or npm rebuild unless I ask, because it breaks better-sqlite3 for my Node 22." Only edit AGENTS.md and don't change anything else.
Result: WORKED.
