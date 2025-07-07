const fs = require('fs');
const MboxExtractor = require('../../lib/extractors/mbox');
const readline = require('readline');

// Mock readline module
jest.mock('readline', () => ({
  createInterface: jest.fn()
}));

describe('MboxExtractor', () => {
  let extractor;
  let mockOutputDir;
  
  beforeEach(() => {
    extractor = new MboxExtractor({
      verbose: false,
      format: 'eml'
    });
    
    mockOutputDir = '/tmp/test-output';
    
    // Mock fs methods
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'mkdirSync').mockReturnValue(undefined);
    jest.spyOn(fs, 'writeFileSync').mockReturnValue(undefined);
    jest.spyOn(fs, 'createReadStream').mockReturnValue({});
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  describe('constructor', () => {
    it('should initialize with default options', () => {
      const defaultExtractor = new MboxExtractor();
      expect(defaultExtractor.options.verbose).toBe(false);
      expect(defaultExtractor.options.format).toBe('eml');
    });
    
    it('should override default options', () => {
      const customExtractor = new MboxExtractor({
        verbose: true,
        format: 'txt'
      });
      expect(customExtractor.options.verbose).toBe(true);
      expect(customExtractor.options.format).toBe('txt');
    });
  });
  
  describe('resetStats', () => {
    it('should reset statistics', () => {
      extractor.stats.emailsExtracted = 10;
      extractor.resetStats();
      
      expect(extractor.stats.emailsExtracted).toBe(0);
      expect(extractor.stats.startTime).toBeDefined();
    });
  });
  
  describe('ensureDirectoryExistence', () => {
    it('should create directory if it does not exist', () => {
      fs.existsSync.mockReturnValue(false);
      extractor.ensureDirectoryExistence('/test/path');
      
      expect(fs.mkdirSync).toHaveBeenCalledWith('/test/path', { recursive: true });
    });
    
    it('should not create directory if it exists', () => {
      fs.existsSync.mockReturnValue(true);
      extractor.ensureDirectoryExistence('/test/path');
      
      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });
  });
  
  describe('sanitizeFilename', () => {
    it('should sanitize invalid characters', () => {
      const result = extractor.sanitizeFilename('file<>:"/\\|?*name with spaces');
      expect(result).toBe('file_________name_with_spaces');
    });
    
    it('should handle empty filename', () => {
      const result = extractor.sanitizeFilename('');
      expect(result).toBe('unknown');
    });
    
    it('should handle null filename', () => {
      const result = extractor.sanitizeFilename(null);
      expect(result).toBe('unknown');
    });
  });
  
  describe('extract', () => {
    it('should process MBOX file and extract emails', async () => {
      const mockFilePath = '/test/mailbox.mbox';
      
      // Mock readline interface
      const mockRl = {
        on: jest.fn((event, callback) => {
          if (event === 'line') {
            // Simulate MBOX lines
            callback('From sender@example.com Mon Jan 01 00:00:00 2023');
            callback('Subject: Test Email 1');
            callback('From: sender@example.com');
            callback('To: recipient@example.com');
            callback('');
            callback('This is the body of email 1');
            callback('From sender@example.com Mon Jan 01 00:01:00 2023');
            callback('Subject: Test Email 2');
            callback('From: sender@example.com');
            callback('To: recipient@example.com');
            callback('');
            callback('This is the body of email 2');
          } else if (event === 'close') {
            callback();
          }
        })
      };
      
      readline.createInterface.mockReturnValue(mockRl);
      
      const result = await extractor.extract(mockFilePath, mockOutputDir);
      
      expect(extractor.stats.emailsExtracted).toBe(2);
      expect(fs.writeFileSync).toHaveBeenCalledTimes(2);
      expect(result).toEqual(extractor.stats);
    });
    
    it('should handle readline errors', async () => {
      const mockFilePath = '/test/mailbox.mbox';
      
      // Mock readline interface with error
      const mockRl = {
        on: jest.fn((event, callback) => {
          if (event === 'error') {
            callback(new Error('Read error'));
          }
        })
      };
      
      readline.createInterface.mockReturnValue(mockRl);
      
      await expect(extractor.extract(mockFilePath, mockOutputDir)).rejects.toThrow('Read error');
    });
    
    it('should create output directory', async () => {
      const mockFilePath = '/test/mailbox.mbox';
      fs.existsSync.mockReturnValue(false);
      
      // Mock readline interface
      const mockRl = {
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            callback();
          }
        })
      };
      
      readline.createInterface.mockReturnValue(mockRl);
      
      await extractor.extract(mockFilePath, mockOutputDir);
      
      expect(fs.mkdirSync).toHaveBeenCalledWith(mockOutputDir, { recursive: true });
    });
    
    it('should handle text format output', async () => {
      extractor.options.format = 'txt';
      const mockFilePath = '/test/mailbox.mbox';
      
      // Mock readline interface
      const mockRl = {
        on: jest.fn((event, callback) => {
          if (event === 'line') {
            callback('From sender@example.com Mon Jan 01 00:00:00 2023');
            callback('Subject: Test Email');
            callback('From: sender@example.com');
            callback('To: recipient@example.com');
            callback('Date: Mon, 1 Jan 2023 00:00:00 +0000');
            callback('');
            callback('This is the body');
          } else if (event === 'close') {
            callback();
          }
        })
      };
      
      readline.createInterface.mockReturnValue(mockRl);
      
      await extractor.extract(mockFilePath, mockOutputDir);
      
      expect(fs.writeFileSync).toHaveBeenCalled();
      const writeCall = fs.writeFileSync.mock.calls[0];
      expect(writeCall[0]).toContain('.txt');
      expect(writeCall[1]).toContain('Subject: Test Email');
      expect(writeCall[1]).toContain('From: sender@example.com');
    });
  });
});
