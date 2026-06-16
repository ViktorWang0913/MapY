# Contributing

Thanks for helping improve MapY.

## Good Feedback

When reporting a problem, include:

- What you were trying to design
- The exact steps you took
- What you expected to happen
- What actually happened
- Your MapY version and operating system
- A screenshot or JSON file if it helps explain the issue

Send feedback to `mapy_zstudio@163.com`.

## Local Checks

Before submitting code changes, run:

```bash
npm test -- --run
npm run build
```

For desktop packaging changes, also run:

```bash
npm run tauri:build
```

## Project Direction

MapY should stay focused on 2D level and world planning:

- scenes
- structure pixels
- identifiers
- connections
- local JSON files
- image export

Avoid turning the project into a generic whiteboard, SaaS dashboard, or unrelated game engine.
