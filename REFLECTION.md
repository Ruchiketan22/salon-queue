# Reflection

**One thing the agent got wrong:**
After building the Reception Dashboard, the backend crashed with a Node.js native-module error (`NODE_MODULE_VERSION` mismatch in `better-sqlite3`). The AI coding agent's own test runs were silently using a different Node.js version (v20, through a version manager called fnm) than the one my terminal used to run the app (v22). Each time the agent tested its own code, it rebuilt the SQLite database driver for Node 20, which then crashed the moment I tried to run the same project in my own terminal on Node 22. This happened twice, after two different prompts, before I understood the real cause.

**How I noticed:**
The browser showed nothing but repeated "ECONNREFUSED" proxy errors for every API and Socket.IO call, which looked like the frontend was broken. Running the backend directly with `npx tsx server/server.ts` (instead of through the combined `npm run dev` script) showed the real error underneath: `NODE_MODULE_VERSION 115` vs `127`, which pointed directly at a Node.js version clash rather than a bug in the generated code.

**How I fixed my prompt or doc:**
Short-term, I ran `npm rebuild better-sqlite3` to rebuild the driver for Node 22 each time it happened. To stop it recurring, I added a permanent rule to `AGENTS.md` under "How to work": *"Always use the system Node 22 that `node -v` shows. Never switch Node versions (no fnm or nvm). Never run npm install or npm rebuild unless I ask, because it breaks better-sqlite3 for my Node 22."* After that rule was added, the problem did not happen again in later steps.

**What I would do differently next time:**
I would add that Node-version rule to `AGENTS.md` right from Step 1, before the agent ever ran a test, instead of discovering the problem by trial and error after two separate crashes.
