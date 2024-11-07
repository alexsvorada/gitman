# gitman

A project that is created to solidify my knowledge of the git versioning system.
It is designed to work with a local directory that contains git repositories and manage repositories both remote and local
utilizing the Bun $ (terminal) API and the GitHub API.

To implement:
Backups
Parallelization
Remote branch tracking
Interactivity: Repository filtering and selection, Dry-run mode, Config file support, Auto-ask to archive very old repos, Summary report
Tests
Error handling
Git conflict handling: compare history and warn, offer options to resolve
Detailed logging and progress tracking
Rate limit handling

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.1.33. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
