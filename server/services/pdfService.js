const pdfParse = require('pdf-parse');

// Extract text from PDF buffer
const extractTextFromPDF = async (pdfBuffer) => {
  try {
    const data = await pdfParse(pdfBuffer);
    return {
      text: data.text,
      numPages: data.numpages,
      info: data.info
    };
  } catch (error) {
    console.error('PDF parsing error:', error);
    throw new Error('Failed to parse PDF: ' + error.message);
  }
};

// Extract text from base64 PDF
const extractTextFromBase64 = async (base64String) => {
  try {
    const buffer = Buffer.from(base64String, 'base64');
    return await extractTextFromPDF(buffer);
  } catch (error) {
    console.error('Base64 PDF parsing error:', error);
    throw new Error('Failed to parse base64 PDF: ' + error.message);
  }
};

module.exports = {
  extractTextFromPDF,
  extractTextFromBase64
};
