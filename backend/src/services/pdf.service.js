import pdfParse from 'pdf-parse/lib/pdf-parse.js';

/**
 * Extract plain text from a PDF buffer
 * @param {Buffer} buffer - PDF file buffer
 * @returns {string} - Extracted plain text
 */
export const extractTextFromPDF = async (buffer) => {
  try {
    const data = await pdfParse(buffer);
    return data.text
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  } catch (error) {
    throw new Error(`Failed to parse PDF: ${error.message}`);
  }
};
