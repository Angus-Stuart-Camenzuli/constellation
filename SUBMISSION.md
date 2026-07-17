# Hoobit Hacks 2026 — submission checklist

Work top to bottom. Rule numbers reference the Devpost post.

## 1. Repo hygiene (~30 min) — do this FIRST

- [ ] **Check the API key was never committed**: `git log --all --full-history -- server/.env`
      → if that shows ANY commit, rotate the key at console.anthropic.com before the repo goes public. Non-negotiable.
- [ ] Confirm `.gitignore` covers `server/.env` and `node_modules`.
- [ ] Push to a **public GitHub repo** (rule 2: stays public until 1 month after winners).
- [ ] Write README (your voice, short): what it is, one screenshot, quickstart
      (`npm install`, two terminals: `npm run dev` + `npm run server:mock`; live mode
      needs `ANTHROPIC_API_KEY` in `server/.env`), tech stack, AI disclosure (see §4),
      "desktop only" note.
- [ ] Fresh-clone test: clone into a new folder, follow your own README exactly. If it
      doesn't run, judges' won't either.
- [ ] Optional tidy: delete the commented-out `<fog>` line in Scene.jsx.

## 2. Make the prototype accessible (rule 1)

Pick one:

- [ ] **Recommended: deploy MOCK mode publicly.** No key exposure, zero API cost,
      anyone can click through the entire experience with fixture content. Easiest
      shape: serve the Vite build from the Express server (`app.use(express.static('dist'))`
      after `npm run build`) and deploy the one Node app to Render/Railway/Fly free tier
      with `--mock`. Note in README + Devpost: "hosted demo runs on fixtures; live AI
      generation shown in video and available by running locally with an API key."
- [ ] Fallback (allowed by the post): public repo + YouTube video only. Weaker — they
      emphasize "working prototype, not proof of concept."
- [ ] Whichever you pick: test the final URL in an incognito window.

## 3. Demo video (the centerpiece — judges may only ever see this)

- [ ] 2–3 minutes, YouTube (public or unlisted), 1080p minimum.
- [ ] **Capture system audio** — the hum, whoosh, and hover ticks are half the vibe.
- [ ] Script written BY YOU (organizers explicitly call out AI scripts). Talk like you
      talk. A few mistakes reads human — they said so themselves.
- [ ] Have the mock server ready as fallback if wifi dies mid-take; disclose if used.

Suggested shot list (record real generation; narrate during the ~30s wait — that IS
the demo, not dead air):

1. Cold open: landing screen, type a real idea (not a recipe app), Enter → warp.
2. Constellation births: point out blue arc = AI generating, stars ignite in
   dependency order, three edges converge into PLANNING last.
3. Hover a star → ring + summary panel → click into REQUIREMENTS.
4. Inside: pan around, drag two frames to rearrange, hit COPY on the DDL or stories.
5. ESC out → zoom INTO wireframes with the scroll wheel (show the second entry path).
6. End wide on the full constellation. One sentence on what's next (conversation).

## 4. Devpost form

- [ ] Write-up in your own voice. Devpost's usual sections: inspiration / what it does /
      how we built it / challenges / accomplishments / what we learned / what's next.
- [ ] **Theme defense** (rule 3) — one solid paragraph you can stand behind connecting
      Constellation to the theme.
- [ ] **AI disclosure** (rule 5, required). Honest version of the facts:
      - Claude (via the Claude desktop app) was used heavily for coding, debugging,
        and design discussion, working under your direction — you made the design
        calls, reviewed and pasted code, and did all testing.
      - The app itself calls claude-sonnet-5 at runtime to generate artifacts.
      - Write-up and video script: written by you without AI.
- [ ] Team details (rule 7): name, contact email, Discord username, GitHub username,
      age, institution, country.
- [ ] Gallery images (3–5 screenshots): landing screen; constellation mid-generation
      with blue arcs; the requirements board; a wireframe board; full constellation
      with planning converged.

### Facts inventory for your write-up (facts to draw on — the prose is yours)

- Problem: in chat interfaces, ideas get buried in transcripts and never revisited.
  Constellation gives AI output *places* — artifacts live in space, you fly between them.
- What's real: type a product idea → a staged Claude pipeline generates requirements →
  (architecture + database + wireframes in parallel) → planning. The constellation's
  edges ARE the dependency graph — stars ignite as their generation completes.
- Artifacts: user stories with acceptance criteria, use case / context / component /
  data-flow diagrams (auto-laid-out SVG), ERD + data dictionary + real DDL, wireframes
  rendered as app skeletons, Gantt with milestones, risk register.
- Interaction: hyperspace intro, hover panels, click-or-zoom to dive into a star
  (veil flash, the sky re-seeds), pan/zoom/drag-to-arrange boards, copy buttons.
- Tech: React + Vite + React Three Fiber (frontend), Node/Express + Anthropic API
  with schema-forced tool use (backend), mock mode with fixtures for offline demos.
- Honest challenges you actually hit (great write-up material): React Compiler
  freeze semantics (three separate incidents), a CSS-cascade bug where an animation
  silently beat per-frame inline styles, a phantom "orb" that turned out to be the
  browser's white backdrop leaking through a 94%-transparent gradient, a hover↔drift
  feedback oscillator, and the model nesting whole artifacts under a stray `scope` key.
- What's next: conversation — a prompt bar inside each board so you talk to the
  artifact and new frames ignite; edits propagating staleness to dependent nodes.

## 5. Admin (rules 6, 8)

- [ ] Join the Discord, follow its rules.
- [ ] Read the grading criteria when released and sanity-check the submission against it.
- [ ] Confirm the actual deadline **and its timezone** once dates are posted.

## Suggested order for today

Repo hygiene → deploy decision → record video (do 2–3 takes) → write-up → form +
screenshots → admin → done by early afternoon → fishing/skating regardless of weather.
