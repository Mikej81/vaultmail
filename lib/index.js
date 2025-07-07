const fs = require('fs');
const path = require('path');
const PSTExtractor = require('./extractors/pst');
const MboxExtractor = require('./extractors/mbox');
const OLMExtractor = require('./extractors/olm');

/**
 * VaultMail - Comprehensive email archive extraction tool
 * 
 * Supports multiple email archive formats including PST, OST, MBOX, and OLM files.
 * Extracts emails, attachments, contacts, and other data into standardized formats.
 */
class EmailExtractor {
  /**
   * Create a new EmailExtractor instance
   * 
   * @param {Object} options - Configuration options
   * @param {boolean} options.verbose - Enable detailed logging
   * @param {string} options.format - Output format ('eml' or 'txt')
   * @param {number} options.maxDepth - Maximum folder depth to process (-1 for unlimited)
   * @param {boolean} options.skipEmpty - Skip empty folders during extraction
   */
  constructor(options = {}) {
    this.options = {
      verbose: false,
      format: 'eml',
      maxDepth: -1,
      skipEmpty: true,
      ...options
    };
  }

  /**
   * Detect the email archive file type based on extension and content
   * 
   * @param {string} filePath - Path to the email archive file
   * @returns {string} The detected file type ('pst', 'ost', 'mbox', or 'olm')
   * @throws {Error} If file type is not supported or cannot be detected
   */
  detectFileType(filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const ext = path.extname(filePath).toLowerCase();
    
    // Check file size first to avoid loading large files into memory
    const fileStats = fs.statSync(filePath);
    const isLargeFile = fileStats.size > 2 * 1024 * 1024 * 1024; // 2GB threshold
    
    // Primary detection: file extension
    if (ext === '.pst') {
      return 'pst';
    } else if (ext === '.ost') {
      return 'ost';
    } else if (ext === '.mbox') {
      return 'mbox';
    } else if (ext === '.olm') {
      return 'olm';
    }
    
    // Secondary detection: file content (only for small files to avoid memory issues)
    if (!isLargeFile) {
      try {
        const buffer = fs.readFileSync(filePath, { start: 0, end: 8 });
        
        // PST files start with a specific signature
        if (buffer.toString('hex').startsWith('2142444e')) {
          return 'pst';
        }
        // MBOX files typically start with "From "
        else if (buffer.toString('ascii').startsWith('From ')) {
          return 'mbox';
        }
      } catch (error) {
        // If we can't read the file content, fall through to error
      }
    }
    
    throw new Error(`Unsupported file type: ${ext}. Supported formats: PST, OST, MBOX, OLM`);
  }

  /**
   * Extract emails from PST files
   * 
   * @param {string} filePath - Path to the PST file
   * @param {string} outputDir - Directory for extracted emails
   * @param {string} attachmentDir - Directory for extracted attachments
   * @param {Object} options - Additional extraction options
   * @returns {Promise<Object>} Extraction statistics
   */
  async extractPST(filePath, outputDir, attachmentDir, options = {}) {
    const extractor = new PSTExtractor({ ...this.options, ...options });
    return await extractor.extract(filePath, outputDir, attachmentDir);
  }

  /**
   * Extract emails from OST files (uses PST extractor)
   * 
   * @param {string} filePath - Path to the OST file
   * @param {string} outputDir - Directory for extracted emails
   * @param {string} attachmentDir - Directory for extracted attachments
   * @param {Object} options - Additional extraction options
   * @returns {Promise<Object>} Extraction statistics
   */
  async extractOST(filePath, outputDir, attachmentDir, options = {}) {
    const extractor = new PSTExtractor({ ...this.options, ...options });
    return await extractor.extract(filePath, outputDir, attachmentDir);
  }

  /**
   * Extract emails from MBOX files
   * 
   * @param {string} filePath - Path to the MBOX file
   * @param {string} outputDir - Directory for extracted emails
   * @param {Object} options - Additional extraction options
   * @returns {Promise<Object>} Extraction statistics
   */
  async extractMbox(filePath, outputDir, options = {}) {
    const extractor = new MboxExtractor({ ...this.options, ...options });
    return await extractor.extract(filePath, outputDir);
  }

  /**
   * Extract emails and data from OLM files (Outlook for Mac)
   * 
   * @param {string} filePath - Path to the OLM file
   * @param {string} outputDir - Directory for extracted data
   * @param {Object} options - Additional extraction options
   * @returns {Promise<Object>} Extraction statistics
   */
  async extractOLM(filePath, outputDir, options = {}) {
    const extractor = new OLMExtractor({ ...this.options, ...options });
    return await extractor.extract(filePath, outputDir);
  }

  /**
   * Extract emails from any supported archive format
   * 
   * Automatically detects the file type and uses the appropriate extractor.
   * 
   * @param {string} filePath - Path to the email archive file
   * @param {string} outputDir - Directory for extracted emails
   * @param {string|null} attachmentDir - Directory for attachments (required for PST/OST)
   * @param {Object} options - Additional extraction options
   * @returns {Promise<Object>} Extraction statistics including counts and processing time
   * @throws {Error} If file type is unsupported or required parameters are missing
   */
  async extract(filePath, outputDir, attachmentDir = null, options = {}) {
    const fileType = this.detectFileType(filePath);
    
    switch (fileType) {
    case 'pst':
    case 'ost':
      if (!attachmentDir) {
        throw new Error('Attachment directory is required for PST/OST files');
      }
      return await this.extractPST(filePath, outputDir, attachmentDir, options);
    case 'mbox':
      return await this.extractMbox(filePath, outputDir, options);
    case 'olm':
      return await this.extractOLM(filePath, outputDir, options);
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
    }
  }
}

module.exports = {
  EmailExtractor,
  PSTExtractor,
  MboxExtractor,
  OLMExtractor
};
