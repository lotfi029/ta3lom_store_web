// Ambient declaration for side-effect CSS imports (e.g. `import '@toast-ui/editor/dist/
// toastui-editor.css'` in markdown-editor.ts) — a third-party library's stylesheet, which
// cannot go through Angular's own `styleUrl` metadata since it is not this component's own
// file. Component styles themselves never use raw imports; this is only for bundling a
// dependency's CSS alongside the component that needs it.
declare module '*.css';
