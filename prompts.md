# prompts.md — Prompts used, in order

Instructions: paste each prompt EXACTLY as you typed it into Antigravity/Codex, including ones that failed. Below are the planned prompts; edit them to match what you really used and add the extra fix/bug prompts as you go. Mark each: WORKED / PARTLY / FAILED, with one line on what happened.

---
## Step 1 — Understand & set up
**Prompt 1.1**
Read AGENTS.md and all of docs/. Summarise the app in 8 bullets and list any questions. Don't write code yet.
Result: WORKED - Read AGENTS.md and docs/, provided an 8-bullet architectural summary, and confirmed clarifying questions.

**Prompt 1.2**
Set up React + Vite + TypeScript + Tailwind, an Express backend, SQLite and Socket.IO with a clean folder structure. Add a health-check endpoint and one `npm run dev` command that starts both. Create empty pages for all 7 screens, the charcoal + gold theme and the EN/GU language toggle. Do not build screen content yet. List changed files and test commands.
Result: WORKED - Project structure created with React, Vite, TS, Tailwind, Express, SQLite, Socket.IO, health-check endpoint, single dev command, and 7 placeholder screens with EN/GU toggle.

## Step 2 — Home + Join Queue
**Prompt 2.1**
Build Screen 1 (Home) and Screen 2 (Join Queue) from docs/02-screens.md with dummy services and barbers Ravi, Amit and Imran. Validate the 10-digit phone number and the 3-service limit. The live summary must update as services are selected. Mobile-first. Don't touch other screens.
Result: WORKED - Built Screen 1 and Screen 2 with backend connectivity, live summary bar, 10-digit phone validation, 3-service limit warning, barber break tags, and duplicate phone prevention.

## Step 3 — My Status
**Prompt 3.1**
After Confirm, create the customer on the backend, give a daily token (S-1, S-2...) and open My Status. Show position and estimated wait using the rule in docs/03-flows-rules.md. Add the "Start coming" and "It's your turn" states. Block a second active spot for the same phone.
Result: ...

## Step 4 — Reception Dashboard
**Prompt 4.1**
Build the Reception Dashboard (Screen 4) for a 10-inch tablet in landscape. Customers who join from a phone must appear automatically. Implement Call next with the barber-preference rules exactly, plus Add walk-in, No-show and Cancel. Then give me 3 scenarios I can try by hand to prove barber preferences are respected.
Result: ...

## Step 5 — Barber View + TV
**Prompt 5.1**
Build Barber View (Screen 5) and the Waiting Area TV (Screen 6). Start/Done and On break must update Reception, TV and the customer's phone within 5 seconds.
Result: ...

## Step 6 — Owner Settings
**Prompt 6.1**
Build Screen 7. Turning off a service hides it from Join; closing the queue disables online joining with a clear message. Add today's stats cards.
Result: ...

## Step 7 — Rules, edge cases, polish
**Prompt 7.1**
Implement the no-show, cancel and barber-on-break rules from docs/03-flows-rules.md on the backend. Add friendly empty states such as "No one waiting - walk right in!".
Result: ...

**Prompt 7.2 (Polish)**
Check every screen in Gujarati. Fix any text that overflows or isn't translated. Make sure tap targets are at least 44px on phone screens.
Result: ...

**Prompt 7.3 (Verify)**
Run the full test checklist in docs/03-flows-rules.md and report pass/fail for each item with how you checked it. Fix failures without changing the design.
Result: ...

## Step 8 — Deploy & live link
**Prompt 8.1**
Prepare this app for deployment: frontend on Vercel, backend on Render. Check the build command, environment variables and that no localhost URLs remain. Give me step-by-step deploy instructions for my exact setup. Then put the live link at the very top of README.md as **Live demo:** <url> with the test PINs right below it.
Result: ...

## Fix & iterate prompts (add every bug/tweak prompt you used)
**Prompt F1**
...
Result: ...
