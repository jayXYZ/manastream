export const meta = {
  name: 'todo-fix-loop',
  description: 'Loop over a todo file: verify the first open task, fix it, review the fix, mark it done, commit',
  whenToUse: 'Work through open tasks in todo.md (or another task file) one at a time with a fix agent, a review agent, and a commit. Pass {file, maxTasks} as args. Requires a clean working tree: it refuses to start when unrelated changes are present, so a task commit can never absorb them.',
  phases: [
    { title: 'Preflight', detail: 'Refuse to start from a dirty working tree' },
    { title: 'Fix', detail: 'Fable agent picks the first open task, verifies it, implements the fix', model: 'fable' },
    { title: 'Review', detail: 'Fable agent reviews the diff and fixes anything wrong', model: 'fable' },
    { title: 'Finalize', detail: 'Mark the task complete and commit' },
  ],
}

// ---------------------------------------------------------------------------
// Inputs. Pass via Workflow args, e.g. { file: 'TASK.md', maxTasks: 3 }.
// ---------------------------------------------------------------------------
const FILE = (args && args.file) || 'todo.md'
// Iterations are strictly serial: each one mutates the working tree and
// commits, so nothing here fans out. maxTasks caps how many tasks one run
// will process; omit it to keep going until no open task remains. Zero is a
// valid cap (process nothing), so the absent case is checked explicitly
// rather than through a truthiness fallback, and anything that is not a
// non-negative integer is rejected instead of silently meaning "unlimited".
function parseMaxTasks(value) {
  if (value === undefined || value === null || value === '') return Infinity
  const parsed = typeof value === 'number' ? value : Number(String(value).trim())
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`maxTasks must be a non-negative integer, got ${JSON.stringify(value)}`)
  }
  return parsed
}
const MAX_TASKS = parseMaxTasks(args && args.maxTasks)
const ATTRIBUTION = 'Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>'

const OPEN_TASK_RULES = `
How to read ${FILE}:
- A task is OPEN unless it is marked done. A task is DONE when it is a
  checkbox item written "- [x]", or when its heading or first line starts
  with "[DONE]" or "[NOT AN ISSUE]".
- "First open task" means the first open task in file order, top to bottom.
- Tasks may be markdown checkboxes ("- [ ] ...") or headed sections
  ("### 1. Title" followed by Where / Why / Fix / Done when). Use whichever
  the file uses.
`

// Shared guidance for any stage that touches Convex code. The convex-* skills
// are installed in .claude/skills (from get-convex/agent-skills via
// `npx convex ai-files install`) and load through the Skill tool.
const CONVEX_SKILLS = `
Convex skills: this project's backend is Convex and the convex-* skills are
installed in .claude/skills. When the task touches anything under convex/,
load the relevant skills with the Skill tool BEFORE reading or editing the
code, and follow them. Start with "convex" (the router) and then pick the
specific ones that match the work, for example:
- convex-expert for writing or changing functions, schemas, indexes, crons,
  validators, auth wiring, or components
- convex-reviewer for reviewing Convex code (security, validators, patterns)
- convex-authz for ownership / access-control problems
- convex-performance-audit for read amplification, full-table scans, OCC
- convex-migration-helper for schema changes or backfills
- convex-test / convex-verify for writing or extending convex-test suites
- convex-docs when you need the exact API for the installed Convex version
Also read convex/_generated/ai/guidelines.md first, as CLAUDE.md requires.
Skip all of this only when the task does not touch convex/ at all.
`

const FIX_SCHEMA = {
  type: 'object',
  properties: {
    found: { type: 'boolean', description: 'false when the file has no open task left' },
    taskId: { type: 'string', description: 'Exact heading text or checkbox line of the task, so later stages can find it' },
    taskTitle: { type: 'string' },
    isRealIssue: { type: 'boolean', description: 'true when you confirmed the problem exists in the code' },
    verification: { type: 'string', description: 'What you checked to confirm or refute the issue' },
    implemented: { type: 'boolean', description: 'true when the fix is in the working tree' },
    summary: { type: 'string', description: 'What changed and why, or why nothing changed' },
    filesChanged: { type: 'array', items: { type: 'string' } },
    checksRun: { type: 'string', description: 'Typecheck / test commands run and their outcome' },
  },
  required: ['found', 'taskId', 'taskTitle', 'isRealIssue', 'implemented', 'summary', 'filesChanged'],
}

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    approved: { type: 'boolean', description: 'true when the change is correct and complete after your fixes' },
    issuesFound: { type: 'array', items: { type: 'string' } },
    fixesApplied: { type: 'array', items: { type: 'string' } },
    filesChanged: { type: 'array', items: { type: 'string' }, description: 'Every file you created or modified while reviewing; empty when you changed nothing' },
    checksRun: { type: 'string' },
    summary: { type: 'string' },
  },
  required: ['approved', 'issuesFound', 'fixesApplied', 'filesChanged', 'summary'],
}

const PREFLIGHT_SCHEMA = {
  type: 'object',
  properties: {
    clean: { type: 'boolean', description: 'true when git status reports no modified, staged, or untracked files' },
    dirtyPaths: { type: 'array', items: { type: 'string' }, description: 'Every path git status listed, empty when clean' },
  },
  required: ['clean', 'dirtyPaths'],
}

const FINALIZE_SCHEMA = {
  type: 'object',
  properties: {
    committed: { type: 'boolean' },
    commitSha: { type: 'string' },
    commitMessage: { type: 'string' },
    notes: { type: 'string' },
  },
  required: ['committed', 'notes'],
}

const results = []
let iteration = 0

// ---------------------------------------------------------------------------
// 0. Preflight: the finalize stage commits the task's changes, and it cannot
// tell a pre-existing edit from one the fix or review agent made. Rather than
// trust it to sort that out, require a clean tree before the first task.
// ---------------------------------------------------------------------------
const preflight = await agent(
  `In the repository at the current working directory, run
\`git status --porcelain --untracked-files=all\` and report the result.
Do not change anything. clean=true only when the output is completely empty;
otherwise list every path it printed in dirtyPaths.`,
  { label: 'preflight', phase: 'Preflight', effort: 'low', schema: PREFLIGHT_SCHEMA },
)

if (!preflight) {
  log('Preflight agent returned nothing; refusing to start.')
  return { file: FILE, processed: 0, results, error: 'preflight-failed' }
}
if (!preflight.clean) {
  log(`Working tree is not clean (${preflight.dirtyPaths.length} path(s)); commit or move that work first so a task commit cannot absorb it:\n  ${preflight.dirtyPaths.join('\n  ')}`)
  return { file: FILE, processed: 0, results, error: 'dirty-working-tree', dirtyPaths: preflight.dirtyPaths }
}

while (iteration < MAX_TASKS) {
  iteration++

  // -------------------------------------------------------------------------
  // 1. Fix agent: find the first open task, verify it is real, implement it.
  // -------------------------------------------------------------------------
  const fix = await agent(
    `You are working in the repository at the current working directory.

Read ${FILE}. ${OPEN_TASK_RULES}
${CONVEX_SKILLS}
Your job, for the FIRST open task only:
1. Identify it and record its exact heading or checkbox line as taskId.
2. If it touches convex/, load the relevant convex skills as described above.
3. Open every file the task references (and any it should reference) and
   verify the described problem actually exists in the code today. Do not
   trust the task text; confirm it against the source. If the problem has
   already been fixed or was never real, set isRealIssue=false, set
   implemented=false, explain in verification, and change NOTHING.
4. If it is real, implement a complete fix. Follow the task's "Fix" and
   "Done when" guidance when present, and the loaded skills' patterns for
   Convex code. Keep the change scoped to this task.
5. Run the project's typecheck and tests (${FILE} may say which commands;
   otherwise use what package.json provides) and fix any failures you caused.
6. Do NOT edit ${FILE} and do NOT commit. Leave the changes in the working
   tree for the review stage.

If ${FILE} has no open task, return found=false.`,
    { label: `fix #${iteration}`, phase: 'Fix', model: 'fable', schema: FIX_SCHEMA },
  )

  if (!fix) { log(`Iteration ${iteration}: fix agent returned nothing; stopping.`); break }
  if (!fix.found) { log(`No open tasks left in ${FILE}.`); break }
  log(`Iteration ${iteration}: "${fix.taskTitle}" — real issue: ${fix.isRealIssue}, implemented: ${fix.implemented}`)

  // -------------------------------------------------------------------------
  // Not a real issue: record that in the todo file so the loop moves on,
  // commit the note, and continue with the next task.
  // -------------------------------------------------------------------------
  if (!fix.isRealIssue) {
    const note = await agent(
      `In ${FILE}, find this task exactly: ${JSON.stringify(fix.taskId)}.
Mark it as not an issue: for a checkbox item change "- [ ]" to "- [x]" and
append " — not an issue: ${fix.verification || fix.summary}"; for a headed
task prefix the heading text with "[NOT AN ISSUE] " and add one line under
the heading: "> Not an issue: ${fix.verification || fix.summary}".
Change nothing else. Then run:
  git add ${FILE}
  git commit -m "Mark todo task as not an issue: ${fix.taskTitle}" -m "${ATTRIBUTION}"
Return the commit sha.`,
      { label: `note #${iteration}`, phase: 'Finalize', effort: 'low', schema: FINALIZE_SCHEMA },
    )
    results.push({ task: fix.taskTitle, outcome: 'not-an-issue', reason: fix.verification, commit: note && note.commitSha })
    continue
  }

  if (!fix.implemented) {
    log(`Iteration ${iteration}: task is real but the fix agent could not implement it. Stopping so a human can look.`)
    results.push({ task: fix.taskTitle, outcome: 'blocked', reason: fix.summary })
    break
  }

  // -------------------------------------------------------------------------
  // 2. Review agent: fresh eyes on the uncommitted diff, fixes anything wrong.
  // -------------------------------------------------------------------------
  const review = await agent(
    `You are reviewing an uncommitted change in the repository at the current
working directory. Run \`git status\` and \`git diff\` to see it.

The change is meant to complete this task from ${FILE}:
  ${fix.taskTitle}
Task heading: ${fix.taskId}
Implementer's summary: ${fix.summary}
Files the implementer says changed: ${fix.filesChanged.join(', ')}
Checks the implementer ran: ${fix.checksRun || 'none reported'}
${CONVEX_SKILLS}
Review it as a senior engineer would:
- If the diff touches convex/, load the convex-reviewer skill (and any other
  relevant convex skill from the list above) before reading the diff, and
  apply its checklist.
- Re-read the task in ${FILE} and confirm the diff fully satisfies its
  "Done when" condition (or the task's intent if there is none).
- Look for correctness bugs, missed call sites, broken types, regressions,
  and anything unrelated that leaked into the diff.
- Check the project's rules for this code (for Convex code the guidelines
  in convex/_generated/ai/guidelines.md and the loaded skills apply).
- Run the typecheck and tests yourself.
Fix any problem you find directly in the working tree. Do NOT edit ${FILE}
and do NOT commit. Set approved=true only when you would merge this.`,
    { label: `review #${iteration}`, phase: 'Review', model: 'fable', schema: REVIEW_SCHEMA },
  )

  if (!review) {
    log(`Iteration ${iteration}: review agent returned nothing; leaving changes uncommitted.`)
    results.push({ task: fix.taskTitle, outcome: 'review-failed' })
    break
  }
  log(`Iteration ${iteration}: review ${review.approved ? 'approved' : 'NOT approved'} — ${review.issuesFound.length} issue(s), ${review.fixesApplied.length} fix(es) applied`)

  if (!review.approved) {
    log(`Iteration ${iteration}: reviewer did not approve. Leaving the working tree uncommitted for a human. Stopping.`)
    results.push({ task: fix.taskTitle, outcome: 'not-approved', issues: review.issuesFound, summary: review.summary })
    break
  }

  // -------------------------------------------------------------------------
  // 3. Finalize: mark the task done in the todo file and commit the task's
  // own files. The tree was clean at preflight and every earlier commit in
  // this run was made here, so the files the fix and review agents reported
  // are the complete set; anything else is left unstaged and reported.
  // -------------------------------------------------------------------------
  const taskPaths = [...new Set([...fix.filesChanged, ...review.filesChanged])].filter((path) => path !== FILE)
  const done = await agent(
    `In the repository at the current working directory:

1. In ${FILE}, find this task exactly: ${JSON.stringify(fix.taskId)}.
   Mark it complete: for a checkbox item change "- [ ]" to "- [x]"; for a
   headed task prefix the heading text with "[DONE] " (keep the number and
   title). Change nothing else in the file.
2. Stage ONLY these paths, one \`git add -- <path>\` each (skip any that
   does not exist):
   ${FILE}
   ${taskPaths.join('\n   ')}
   Never run \`git add -A\`, \`git add .\` or \`git add -u\`. Then run
   \`git status --porcelain\`: any other modified or untracked path is not
   part of this task. Leave it unstaged and list it in notes.
3. Commit with a subject line that describes the fix, not the task number,
   a body that summarises the change, and this trailer as the last line:
   ${ATTRIBUTION}
   Implementer summary: ${fix.summary}
   Reviewer summary: ${review.summary}
4. Return the commit sha and message. Do not push.`,
    { label: `commit #${iteration}`, phase: 'Finalize', effort: 'low', schema: FINALIZE_SCHEMA },
  )

  results.push({
    task: fix.taskTitle,
    outcome: done && done.committed ? 'committed' : 'commit-failed',
    commit: done && done.commitSha,
    files: fix.filesChanged,
    reviewFixes: review.fixesApplied,
    notes: done && done.notes,
  })
  if (!done || !done.committed) { log(`Iteration ${iteration}: commit failed; stopping.`); break }
}

log(`Processed ${results.length} task(s).`)
return { file: FILE, processed: results.length, results }
