import { extractTextFromPDF } from '../services/pdf.service.js';

export const uploadCV = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    let extractedText;

    if (req.file.mimetype === 'application/pdf') {
      extractedText = await extractTextFromPDF(req.file.buffer);
    } else {
      // Plain text
      extractedText = req.file.buffer.toString('utf-8');
    }

    if (!extractedText || extractedText.trim().length < 50) {
      return res.status(400).json({ message: 'CV appears to be empty or too short. Please upload a valid CV.' });
    }

    res.json({
      message: 'CV uploaded and parsed successfully',
      cvText: extractedText,
      charCount: extractedText.length,
    });
  } catch (error) {
    next(error);
  }
};
