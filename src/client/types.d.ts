declare module '*.css' {
    const content: { [className: string]: string };
    export default content;
}

// Add support for Vite's import.meta.env
interface ImportMetaEnv {
  readonly VITE_SERVER_PORT: string;
  // Add other environment variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}