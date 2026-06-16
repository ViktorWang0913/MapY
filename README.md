# MapY

MapY is a local-first 2D map planning app for Metroidvania-style games.

## Features

- Scene-based map planning
- Structure pixel editing
- Reusable identifiers
- World connections
- Local JSON open/save
- Image export
- Windows desktop build

## Stack

Vite, React, TypeScript, Tauri v2, Konva, Zustand, Vitest.

## Requirements

- Node.js 20+
- Rust stable
- Windows 10/11 x64 for desktop packaging
- Microsoft C++ Build Tools and WebView2 runtime

## Development

```bash
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:5173/editor
```

Desktop dev:

```bash
npm run tauri:dev
```

Checks:

```bash
npm test -- --run
npm run build
```

Windows installer:

```bash
npm run tauri:build
```

Output:

```text
src-tauri/target/release/bundle/nsis/
```

## Feedback

`mapy_zstudio@163.com`

## License

MIT
