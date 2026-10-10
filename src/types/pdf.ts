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

export interface FreehandDrawingAnnotation {
  id: string;
  type: 'drawing';
  pageNumber: number;
  points: { x: number; y: number }[]; // normalized 0..1
  color: string;
  strokeWidth: number;
}

export type Annotation = TextAnnotation | SignatureAnnotation | FreehandDrawingAnnotation | ImageAnnotation;

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
