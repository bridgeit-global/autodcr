declare module "docx-pdf-converter" {
  export function convertDocxToPdf(
    docxBuffer: Buffer | Uint8Array | ArrayBuffer,
    fileName: string
  ): Promise<{ buffer: Buffer | Uint8Array | ArrayBuffer }>;
}
