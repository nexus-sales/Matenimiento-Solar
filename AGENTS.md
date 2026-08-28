<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:npm-install-rules -->
# npm install — usar siempre WSL, nunca PowerShell

npm en Windows no materializa el subarbol WASM opcional de
`@tailwindcss/oxide-wasm32-wasi`, asi que el `package-lock.json` generado ahi
**nunca** describe el arbol que npm construye en Linux. El despliegue falla en
`npm ci` antes de compilar nada:

```
npm error Missing: @emnapi/core@1.11.3 from lock file
npm error Invalid: lock file's @emnapi/wasi-threads@1.2.1 does not satisfy 1.2.3
```

Comprobado en este proyecto, no es teorico.

**Siempre que haya que instalar o actualizar una dependencia:**

```
wsl
cd "/mnt/e/IA/Produccion/Clientes/Sr energia"
npm install <paquete>
```

Para editar codigo, VSCode en Windows es totalmente valido; esto solo aplica a
`npm install` / `npm ci`.
<!-- END:npm-install-rules -->
