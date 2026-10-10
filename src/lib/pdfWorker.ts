import * as pdfjsLib from 'pdfjs-dist';

// Point worker to local public path for 100% offline support
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

export { pdfjsLib };
