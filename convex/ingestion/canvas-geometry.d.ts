declare module "@napi-rs/canvas/geometry.js" {
  export const DOMMatrix: typeof globalThis.DOMMatrix
  const geometry: { DOMMatrix: typeof globalThis.DOMMatrix }
  export default geometry
}

declare module "pdfjs-dist/build/pdf.mjs" {
  export * from "pdfjs-dist"
}

declare module "pdfjs-dist/build/pdf.worker.mjs" {
  export const WorkerMessageHandler: unknown
}
