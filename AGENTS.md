## 1. Context & Authority
- Read relevant documentation (`PHASE.md`, requirements, architecture specs) before making changes.
- Adhere strictly to assigned phase scope. Do not over-engineer or touch unassigned modules.

## 2. Code Quality & Architecture
- Follow industry-standard design patterns (SOLID, DRY, KISS, Separation of Concerns).
- Strict typing only (`any` is prohibited). No silent catch blocks, global mutation, or hidden state.
- Keep components, functions, and modules thin and single-purposed.
- Validate all data at boundaries using schema validation (Zod / class-validator).

## 3. Git & Execution Discipline
- Commit after every single logical change with clear, technical commit messages.
- Inspect diffs before committing; verify no secrets, environment variables, or build artifacts are staged.
- Write unit and integration tests alongside code modifications; ensure all tests pass before committing.

## 4. Skills
- Before implementation, check for relevant installed skills and use them when applicable.
- Prefer the simplest relevant skill; do not invoke unrelated skills.