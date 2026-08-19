// El paquete npm 'pdfmake' no publica tipos para su clase server-side
// PdfPrinter (solo para el bundle de navegador). Se declara mínimamente
// aquí para poder usarla desde TypeScript sin recurrir a `any` disperso.
declare module 'pdfmake/src/printer' {
  import { Readable } from 'stream';

  interface FontDescriptor {
    normal: string;
    bold?: string;
    italics?: string;
    bolditalics?: string;
  }

  type FontMap = Record<string, FontDescriptor>;

  class PdfPrinter {
    constructor(fonts: FontMap);
    createPdfKitDocument(docDefinition: Record<string, unknown>): Readable & {
      end: () => void;
    };
  }

  export = PdfPrinter;
}
