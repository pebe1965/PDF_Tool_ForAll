export interface TextAnnotation {
  id: string;
  type: 'text';
  pageNumber: number; // 1-indexed
  x: number; // normalized 0..1 or pixel relative to viewport
  y: number; // normalized 0..1
  text: string;
  fontSize: number;
  color: string; // e.g. '#000000', '#0071E3'
  width?: number;
  fontFamily?: 'Helvetica' | 'Times' | 'Courier';
  isBold?: boolean;
  isItalic?: boolean;
  textAlign?: 'left' | 'center' | 'right';
  backgroundColor?: string; // 'transparent', '#FFFFFF', '#FEF08A'
}

export interface SignatureAnnotation {
  id: string;
  type: 'signature';
  pageNumber: number; // 1-indexed
  x: number; // normalized 0..1
  y: number; // normalized 0..1
  width: number; // normalized 0..1 relative to page width
  height: number; // normalized 0..1 relative to page height
  dataUrl: string; // PNG base64
}

export interface ImageAnnotation {
  id: string;
  type: 'image';
  pageNumber: number; // 1-indexed
  x: number; // normalized 0..1
  y: number; // normalized 0..1
  width: number; // normalized 0..1 relative to page width
  height: number; // normalized 0..1 relative to page height
  dataUrl: string; // PNG base64
  aspectRatio: number; // natural image width / height
  lockAspectRatio?: boolean;
  name?: string;
}

export interface HighlightAnnotation {
  id: string;
  type: 'highlight';
  pageNumber: number; // 1-indexed
  x: number; // normalized 0..1
  y: number; // normalized 0..1
  width: number; // normalized 0..1
  height: number; // normalized 0..1
  color: string; // e.g. '#FACC15', '#4ADE80', '#F472B6', '#60A5FA'
}

export interface RedactionAnnotation {
  id: string;
  type: 'redaction';
  pageNumber: number; // 1-indexed
  x: number; // normalized 0..1
  y: number; // normalized 0..1
  width: number; // normalized 0..1
  height: number; // normalized 0..1
  label?: string; // optional label like 'DSGVO' or 'Geschwärzt'
}

export interface ShapeAnnotation {
  id: string;
  type: 'shape';
  pageNumber: number; // 1-indexed
  shapeType: 'check' | 'cross' | 'rect' | 'circle' | 'arrow';
  x: number; // normalized 0..1
  y: number; // normalized 0..1
  width: number; // normalized 0..1
  height: number; // normalized 0..1
  color: string; // hex color
  strokeWidth?: number;
}

export interface FreehandDrawingAnnotation {
  id: string;
  type: 'drawing';
  pageNumber: number;
  points: { x: number; y: number }[]; // normalized 0..1
  color: string;
  strokeWidth: number;
}

export type Annotation =
  | TextAnnotation
  | SignatureAnnotation
  | FreehandDrawingAnnotation
  | ImageAnnotation
  | HighlightAnnotation
  | RedactionAnnotation
  | ShapeAnnotation;

export interface PageMetadata {
  pageNumber: number;
  width: number;
  height: number;
  rotation: number;
}

export interface MergePageItem {
  id: string;
  fileId: string;
  fileName: string;
  pageIndex: number; // 0-indexed in the original file
  pageNumber: number; // displayed as 1, 2, ...
  rotation: number; // 0, 90, 180, 270
  thumbnailUrl?: string;
  fileBytes: ArrayBuffer;
}

export interface PdfFormFieldItem {
  name: string;
  type: 'text' | 'checkbox' | 'dropdown' | 'optionlist' | 'radio' | 'unknown';
  value: string | boolean;
  options?: string[];
  readOnly?: boolean;
}

export interface PdfDocumentMetadata {
  title: string;
  author: string;
  subject: string;
  keywords: string;
  creator: string;
  producer: string;
}

export interface PageDecorationsConfig {
  // Page numbers / Bates
  enablePageNumbers: boolean;
  pageNumberFormat: 'page_x_of_y' | 'x_slash_y' | 'only_x' | 'bates';
  batesPrefix?: string;
  batesStartNumber?: number;
  pageNumberPosition: 'bottom-right' | 'bottom-center' | 'bottom-left' | 'top-right';
  // Header / Footer
  headerLeft?: string;
  headerCenter?: string;
  headerRight?: string;
  footerLeft?: string;
  // Watermark
  enableWatermark: boolean;
  watermarkText: string;
  watermarkColor: string;
  watermarkOpacity: number; // 0.05 .. 0.5
}
