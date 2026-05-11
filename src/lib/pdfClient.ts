// NOTE: Do NOT use a top-level import of pdfjs-dist.
// It requires browser APIs (DOMMatrix, canvas, etc.) that crash Node.js during SSR.
// Instead, we dynamically import it only when called from the browser.

export interface ClientExtractionResult {
  text?: string;
  image?: string; // base64
  isScanned: boolean;
  fileName: string;
}

/**
 * Extracts text or an image from a PDF file in the browser.
 * This offloads the heavy parsing from the server to the client.
 * Uses dynamic import to avoid loading pdfjs-dist during SSR.
 */
export async function extractFromPdfClient(file: File): Promise<ClientExtractionResult> {
  // Dynamic import — only runs in the browser, never on the server
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  let extractedText = '';
  const numPages = Math.min(pdf.numPages, 5); // Extract from first 5 pages

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(' ');
    extractedText += `[Page ${i}] ${pageText}\n`;
  }

  const cleanText = extractedText
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/ﬀ/g, 'ff').replace(/ﬁ/g, 'fi').replace(/ﬂ/g, 'fl')
    .replace(/[-*_]{3,}/g, ' ')
    .replace(/This is a computer generated document and does not require signature.*/gi, '')
    .replace(/For any grievance, please contact the insurance ombudsman.*/gi, '')
    .replace(/\s+/g, ' ')
    .slice(0, 8000)
    .trim();

  const isScanned = cleanText.length < 50;

  const result: ClientExtractionResult = {
    isScanned,
    fileName: file.name
  };

  if (isScanned) {
    // If it's scanned, render the first page to a canvas and get a base64 image
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2.0 });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    if (context) {
      await page.render({
        canvasContext: context,
        viewport: viewport,
        canvas: canvas
      }).promise;

      result.image = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
    }
  } else {
    result.text = cleanText;
  }

  await pdf.destroy();
  return result;
}
