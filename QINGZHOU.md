# Qingzhou for Windows

This fork implements the approved Chinese desktop UI on Clash Verge Rev 2.5.10.
It uses a separate application ID, service namespace, core filenames and Windows startup tasks.
Official upstream application updates are disabled for this fork.

The desktop UI is enabled on Windows. Android and macOS development is paused at the owner's request.
The inherited cross-platform auto-build workflow skips scheduled runs in this fork and can only be started manually.

The Windows executable and installer have been built. Targeted frontend tests and isolated bundled-core routing tests pass. Complete native GUI, installer and TUN acceptance remains pending; browser render fixtures are not native screenshots.

## Run

Use the Windows installer or extract the complete Windows application archive and run `qingzhou.exe`. Keep the two bundled core executables and the `resources` directory beside the application.

Launch the application from the Windows account that will use it. The application keeps its own configuration under `%APPDATA%/io.github.qingzhou.client` and retains ownership checks on that directory. The standard launcher does not enable a remote debugging port.

## Build

Install the Node, pnpm and Rust versions pinned by this repository, plus the Visual Studio C++ build tools and Windows SDK.

```sh
pnpm install --frozen-lockfile
pnpm prebuild x86_64-pc-windows-msvc
node scripts/generate-qingzhou-icons.mjs
pnpm exec tauri build --config src-tauri/tauri.qingzhou.conf.json
```

The background service is built from the corresponding vendored source. Its executable authentication and ownership checks remain enabled.
The boat icon has an SVG master in `src/assets/qingzhou.svg`; the icon generator produces application and tray variants.

The GPL license and upstream attribution are retained.
