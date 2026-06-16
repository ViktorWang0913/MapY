# MapY

MapY is a local-first 2D map and level planning app for Metroidvania-style games. It helps creators build maps from scenes, structure pixels, identifiers, and connections, then save the project as JSON or export images for review.

## Current Status

MapY is in early development. The Windows build is shared for free use and feedback.

Feedback email: `mapy_zstudio@163.com`

## Features

- Scene-based 2D map planning
- Structure pixel editing inside scenes
- Reusable identifier types and identifier instances
- World mode for scene connections
- Local JSON open/save
- Image export for documentation and review
- Windows desktop packaging through Tauri

## Tech Stack

- Vite
- React
- TypeScript
- Tauri v2
- Konva / react-konva
- Zustand
- Vitest

## Requirements

- Node.js 20+
- npm
- Rust stable toolchain
- Windows 10/11 x64 for the packaged desktop build
- Microsoft C++ Build Tools and WebView2 runtime for Tauri development on Windows

## Development

Install dependencies:

```bash
npm install
```

Run the web editor in development mode:

```bash
npm run dev
```

Then open:

```text
http://127.0.0.1:5173/
```

Run the Tauri desktop app in development mode:

```bash
npm run tauri:dev
```

Run tests:

```bash
npm test -- --run
```

Build the frontend:

```bash
npm run build
```

Build the Windows desktop installer:

```bash
npm run tauri:build
```

The Windows NSIS installer is generated under:

```text
src-tauri/target/release/bundle/nsis/
```

## Release

GitHub Release `v0.1.0` should include the Windows installer:

```text
MapY_0.1.0_x64-setup.exe
```

The installer is not code signed yet. Windows may show an unknown publisher warning.

## License

MapY is released under the MIT License. See [LICENSE](./LICENSE).
