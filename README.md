# Salon Queue Management System

**Live demo:** https://salon-queue-frontend-smoky.vercel.app

**Hosted on:** Vercel (frontend) + Render (backend)

**Test PINs:** Reception `1111` · Barber `2222` · Admin `3333`

## About
A mobile-first queue app for a salon. Customers join from their phone, see their position and estimated wait, and are alerted when it is their turn. Reception manages the queue on a tablet, barbers tap Start / Done on their phone, and a TV in the waiting area shows who is next. Labels are available in English and Gujarati.

## Screens
| Screen | URL | Used by |
|---|---|---|
| Home | `/` | Customer |
| Join Queue | `/join` | Customer |
| My Status | `/status/:id` | Customer |
| Reception Dashboard | `/reception` | Receptionist (tablet) |
| Barber View | `/barber/:name` | Barber (phone) |
| Waiting Area TV | `/display` | TV |
| Owner Settings | `/admin` | Owner |

## 📍 Application Routes

| Page | Route | User / Device | Live Link |
|---|---|---|---|
| Home | `/` | Customer | [Open](https://salon-queue-frontend-smoky.vercel.app/) |
| Join Queue | `/join` | Customer | [Open](https://salon-queue-frontend-smoky.vercel.app/join) |
| My Status | `/status/:id` | Customer | [Open](https://salon-queue-frontend-smoky.vercel.app/status/:id) |
| Reception Dashboard | `/reception` | Receptionist (Tablet) | [Open](https://salon-queue-frontend-smoky.vercel.app/reception) |
| Barber View | `/barber/:name` | Barber (Phone) | [Open](https://salon-queue-frontend-smoky.vercel.app/barber/:name) |
| Waiting Area TV | `/display` | TV | [Open](https://salon-queue-frontend-smoky.vercel.app/display) |
| Owner Settings | `/admin` | Owner | [Open](https://salon-queue-frontend-smoky.vercel.app/admin) |

> **Note:** Routes containing `:id` or `:name` require a specific customer ID or barber name to access the corresponding page.

## Tech stack
React + Vite + TypeScript + Tailwind CSS, Node/Express, SQLite, Socket.IO.

## Run locally
```
npm install
npm run dev
```

## Docs
- `AGENTS.md` – instructions for the coding agent
- `docs/01-brief.md`, `docs/02-screens.md`, `docs/03-flows-rules.md`
- `prompts.md` – every prompt used, in order
- `REFLECTION.md` – what the agent got wrong and how I fixed it


