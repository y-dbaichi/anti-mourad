// Unified Extraction Service
// Switches between cloud (Groq) and local (Ollama) extraction

const groqService = require('./groqService');
const ollamaService = require('./ollamaService');

// Default mode from environment, can be overridden per-request
const DEFAULT_MODE = process.env.EXTRACTION_MODE || 'cloud';

/**
 * Extract invoice data using the specified mode
 * @param {string} pdfText - The text extracted from the PDF
 * @param {string} mode - 'cloud' for Groq, 'local' for Ollama
 * @returns {Promise<Object>} - Extracted invoice data
 */
const extractInvoiceData = async (pdfText, mode = DEFAULT_MODE) => {
  console.log(`[Extraction] Using ${mode} mode`);

  if (mode === 'local') {
    // Check if Ollama is available
    const health = await ollamaService.checkOllamaHealth();
    if (!health.healthy) {
      throw new Error(`Ollama not available: ${health.error}. Make sure Ollama is running.`);
    }
    if (!health.hasRequiredModel) {
      throw new Error(`Required model not found. Run: ollama pull ${health.requiredModel}`);
    }

    return await ollamaService.extractInvoiceData(pdfText);
  } else {
    // Default to cloud (Groq)
    return await groqService.extractInvoiceData(pdfText);
  }
};

/**
 * Check health of extraction services
 * @returns {Promise<Object>} - Health status of both services
 */
const checkHealth = async () => {
  const health = {
    cloud: { available: false, error: null },
    local: { available: false, error: null, models: [] }
  };

  // Check Groq (cloud)
  if (process.env.GROQ_API_KEY) {
    health.cloud.available = true;
  } else {
    health.cloud.error = 'GROQ_API_KEY not configured';
  }

  // Check Ollama (local)
  try {
    const ollamaHealth = await ollamaService.checkOllamaHealth();
    health.local = {
      available: ollamaHealth.healthy && ollamaHealth.hasRequiredModel,
      error: ollamaHealth.healthy ? null : ollamaHealth.error,
      models: ollamaHealth.models || [],
      requiredModel: ollamaHealth.requiredModel
    };
  } catch (error) {
    health.local.error = error.message;
  }

  return health;
};

/**
 * Get available extraction modes
 * @returns {Promise<Array>} - List of available modes
 */
const getAvailableModes = async () => {
  const health = await checkHealth();
  const modes = [];

  if (health.cloud.available) {
    modes.push({
      id: 'cloud',
      name: 'Cloud (Groq)',
      description: 'Fast (~3s), requires internet',
      available: true
    });
  }

  if (health.local.available) {
    modes.push({
      id: 'local',
      name: 'Local (Ollama)',
      description: 'Slower (~90s), 100% private, no internet',
      available: true
    });
  } else {
    modes.push({
      id: 'local',
      name: 'Local (Ollama)',
      description: health.local.error || 'Not configured',
      available: false
    });
  }

  return modes;
};

module.exports = {
  extractInvoiceData,
  checkHealth,
  getAvailableModes,
  DEFAULT_MODE
};
