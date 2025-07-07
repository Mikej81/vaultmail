const fs = require('fs');
const PSTExtractor = require('../../lib/extractors/pst');

// Mock pst-extractor module
jest.mock('pst-extractor', () => ({
  PSTFile: jest.fn(),
  PSTMessage: jest.fn(),
  PSTFolder: jest.fn(),
  PSTAttachment: jest.fn()
}));

describe('PSTExtractor', () => {
  let extractor;
  let mockOutputDir;
  
  beforeEach(() => {
    extractor = new PSTExtractor({
      verbose: false,
      format: 'eml'
    });
    
    mockOutputDir = '/tmp/test-output';
    
    // Mock fs methods
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'mkdirSync').mockReturnValue(undefined);
    jest.spyOn(fs, 'writeFileSync').mockReturnValue(undefined);
    jest.spyOn(fs, 'statSync').mockReturnValue({ size: 1024 * 1024 }); // 1MB
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  describe('constructor', () => {
    it('should initialize with default options', () => {
      const defaultExtractor = new PSTExtractor();
      expect(defaultExtractor.options.verbose).toBe(false);
      expect(defaultExtractor.options.format).toBe('eml');
      expect(defaultExtractor.options.maxDepth).toBe(-1);
      expect(defaultExtractor.options.skipEmpty).toBe(true);
    });
    
    it('should override default options', () => {
      const customExtractor = new PSTExtractor({
        verbose: true,
        format: 'txt',
        maxDepth: 5
      });
      expect(customExtractor.options.verbose).toBe(true);
      expect(customExtractor.options.format).toBe('txt');
      expect(customExtractor.options.maxDepth).toBe(5);
    });
  });
  
  describe('resetStats', () => {
    it('should reset statistics', () => {
      extractor.stats.emailsExtracted = 10;
      extractor.stats.attachmentsExtracted = 5;
      extractor.resetStats();
      
      expect(extractor.stats.emailsExtracted).toBe(0);
      expect(extractor.stats.attachmentsExtracted).toBe(0);
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
  
  describe('generateEmlContent', () => {
    it('should generate valid EML content', () => {
      const mockEmail = {
        subject: 'Test Subject',
        body: 'Test Body',
        clientSubmitTime: '2023-01-01T00:00:00Z',
        descriptorNodeId: 12345
      };
      
      const result = extractor.generateEmlContent(mockEmail, 'sender@test.com', 'recipient@test.com');
      
      expect(result).toContain('From: sender@test.com');
      expect(result).toContain('To: recipient@test.com');
      expect(result).toContain('Subject: Test Subject');
      expect(result).toContain('Date: 2023-01-01T00:00:00Z');
      expect(result).toContain('Message-ID: <12345@extracted>');
      expect(result).toContain('Test Body');
    });
    
    it('should handle missing email fields', () => {
      const mockEmail = {};
      
      const result = extractor.generateEmlContent(mockEmail, 'sender@test.com', 'recipient@test.com');
      
      expect(result).toContain('Subject: No Subject');
      expect(result).toContain('From: sender@test.com');
    });
  });
  
  describe('saveEmail', () => {
    it('should save email in EML format', () => {
      const mockEmail = {
        subject: 'Test Subject',
        body: 'Test Body',
        descriptorNodeId: 12345
      };
      
      const result = extractor.saveEmail(mockEmail, mockOutputDir, 'sender@test.com', 'recipient@test.com');
      
      expect(fs.writeFileSync).toHaveBeenCalled();
      expect(result).toContain('12345.eml');
      expect(extractor.stats.emailsExtracted).toBe(1);
    });
    
    it('should save email in TXT format', () => {
      extractor.options.format = 'txt';
      const mockEmail = {
        subject: 'Test Subject',
        body: 'Test Body',
        messageClass: 'IPM.Note',
        clientSubmitTime: '2023-01-01T00:00:00Z',
        descriptorNodeId: 12345
      };
      
      const result = extractor.saveEmail(mockEmail, mockOutputDir, 'sender@test.com', 'recipient@test.com');
      
      expect(fs.writeFileSync).toHaveBeenCalled();
      expect(result).toContain('12345.txt');
      expect(extractor.stats.emailsExtracted).toBe(1);
    });
    
    it('should use file prefix when provided', () => {
      const mockEmail = {
        descriptorNodeId: 12345
      };
      
      const result = extractor.saveEmail(mockEmail, mockOutputDir, 'sender@test.com', 'recipient@test.com', 'prefix');
      
      expect(result).toContain('prefix-12345.eml');
    });
  });
  
  describe('checkForReadpst', () => {
    it('should return a boolean result', async () => {
      // Just test that the method returns a boolean without mocking complex spawn behavior
      const result = await extractor.checkForReadpst();
      expect(typeof result).toBe('boolean');
    });
  });
});
