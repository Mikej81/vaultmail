const fs = require('fs');
const { EmailExtractor, PSTExtractor, MboxExtractor, OLMExtractor } = require('../lib/index');

// Mock the extractor modules
jest.mock('../lib/extractors/pst');
jest.mock('../lib/extractors/mbox');
jest.mock('../lib/extractors/olm');

describe('EmailExtractor', () => {
  let extractor;
  
  beforeEach(() => {
    extractor = new EmailExtractor({
      verbose: false,
      format: 'eml'
    });
    
    // Mock fs methods
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'statSync').mockReturnValue({ size: 1024 * 1024 }); // 1MB
    jest.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from('test'));
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  describe('constructor', () => {
    it('should initialize with default options', () => {
      const defaultExtractor = new EmailExtractor();
      expect(defaultExtractor.options.verbose).toBe(false);
      expect(defaultExtractor.options.format).toBe('eml');
      expect(defaultExtractor.options.maxDepth).toBe(-1);
      expect(defaultExtractor.options.skipEmpty).toBe(true);
    });
    
    it('should override default options', () => {
      const customExtractor = new EmailExtractor({
        verbose: true,
        format: 'txt',
        maxDepth: 5
      });
      expect(customExtractor.options.verbose).toBe(true);
      expect(customExtractor.options.format).toBe('txt');
      expect(customExtractor.options.maxDepth).toBe(5);
    });
  });
  
  describe('detectFileType', () => {
    it('should detect PST files by extension', () => {
      const result = extractor.detectFileType('/path/to/file.pst');
      expect(result).toBe('pst');
    });
    
    it('should detect OST files by extension', () => {
      const result = extractor.detectFileType('/path/to/file.ost');
      expect(result).toBe('ost');
    });
    
    it('should detect MBOX files by extension', () => {
      const result = extractor.detectFileType('/path/to/file.mbox');
      expect(result).toBe('mbox');
    });
    
    it('should detect OLM files by extension', () => {
      const result = extractor.detectFileType('/path/to/file.olm');
      expect(result).toBe('olm');
    });
    
    it('should detect PST files by content header for small files', () => {
      fs.readFileSync.mockReturnValue(Buffer.from('2142444e', 'hex'));
      const result = extractor.detectFileType('/path/to/unknown-file');
      expect(result).toBe('pst');
    });
    
    it('should detect MBOX files by content header for small files', () => {
      fs.readFileSync.mockReturnValue(Buffer.from('From '));
      const result = extractor.detectFileType('/path/to/unknown-file');
      expect(result).toBe('mbox');
    });
    
    it('should skip content detection for large files', () => {
      fs.statSync.mockReturnValue({ size: 3 * 1024 * 1024 * 1024 }); // 3GB
      
      expect(() => {
        extractor.detectFileType('/path/to/large-unknown-file');
      }).toThrow('Unsupported file type');
    });
    
    it('should throw error for unsupported file types', () => {
      expect(() => {
        extractor.detectFileType('/path/to/file.xyz');
      }).toThrow('Unsupported file type: .xyz');
    });
  });
  
  describe('extractPST', () => {
    it('should create PST extractor and call extract', async () => {
      const mockExtract = jest.fn().mockResolvedValue({ emailsExtracted: 5 });
      PSTExtractor.mockImplementation(() => ({ extract: mockExtract }));
      
      const result = await extractor.extractPST('/path/to/file.pst', '/output', '/attachments');
      
      expect(PSTExtractor).toHaveBeenCalledWith({
        verbose: false,
        format: 'eml',
        maxDepth: -1,
        skipEmpty: true
      });
      expect(mockExtract).toHaveBeenCalledWith('/path/to/file.pst', '/output', '/attachments');
      expect(result).toEqual({ emailsExtracted: 5 });
    });
    
    it('should merge custom options', async () => {
      const mockExtract = jest.fn().mockResolvedValue({});
      PSTExtractor.mockImplementation(() => ({ extract: mockExtract }));
      
      await extractor.extractPST('/path/to/file.pst', '/output', '/attachments', { verbose: true });
      
      expect(PSTExtractor).toHaveBeenCalledWith({
        verbose: true,
        format: 'eml',
        maxDepth: -1,
        skipEmpty: true
      });
    });
  });
  
  describe('extractOST', () => {
    it('should create PST extractor for OST files', async () => {
      const mockExtract = jest.fn().mockResolvedValue({ emailsExtracted: 3 });
      PSTExtractor.mockImplementation(() => ({ extract: mockExtract }));
      
      const result = await extractor.extractOST('/path/to/file.ost', '/output', '/attachments');
      
      expect(PSTExtractor).toHaveBeenCalled();
      expect(mockExtract).toHaveBeenCalledWith('/path/to/file.ost', '/output', '/attachments');
      expect(result).toEqual({ emailsExtracted: 3 });
    });
  });
  
  describe('extractMbox', () => {
    it('should create Mbox extractor and call extract', async () => {
      const mockExtract = jest.fn().mockResolvedValue({ emailsExtracted: 10 });
      MboxExtractor.mockImplementation(() => ({ extract: mockExtract }));
      
      const result = await extractor.extractMbox('/path/to/file.mbox', '/output');
      
      expect(MboxExtractor).toHaveBeenCalledWith({
        verbose: false,
        format: 'eml',
        maxDepth: -1,
        skipEmpty: true
      });
      expect(mockExtract).toHaveBeenCalledWith('/path/to/file.mbox', '/output');
      expect(result).toEqual({ emailsExtracted: 10 });
    });
  });
  
  describe('extractOLM', () => {
    it('should create OLM extractor and call extract', async () => {
      const mockExtract = jest.fn().mockResolvedValue({ emailsExtracted: 7 });
      OLMExtractor.mockImplementation(() => ({ extract: mockExtract }));
      
      const result = await extractor.extractOLM('/path/to/file.olm', '/output');
      
      expect(OLMExtractor).toHaveBeenCalledWith({
        verbose: false,
        format: 'eml',
        maxDepth: -1,
        skipEmpty: true
      });
      expect(mockExtract).toHaveBeenCalledWith('/path/to/file.olm', '/output');
      expect(result).toEqual({ emailsExtracted: 7 });
    });
  });
  
  describe('extract', () => {
    it('should extract PST files with attachment directory', async () => {
      const mockExtract = jest.fn().mockResolvedValue({ emailsExtracted: 5 });
      PSTExtractor.mockImplementation(() => ({ extract: mockExtract }));
      
      const result = await extractor.extract('/path/to/file.pst', '/output', '/attachments');
      
      expect(result).toEqual({ emailsExtracted: 5 });
    });
    
    it('should extract OST files with attachment directory', async () => {
      const mockExtract = jest.fn().mockResolvedValue({ emailsExtracted: 3 });
      PSTExtractor.mockImplementation(() => ({ extract: mockExtract }));
      
      const result = await extractor.extract('/path/to/file.ost', '/output', '/attachments');
      
      expect(result).toEqual({ emailsExtracted: 3 });
    });
    
    it('should extract MBOX files without attachment directory', async () => {
      const mockExtract = jest.fn().mockResolvedValue({ emailsExtracted: 10 });
      MboxExtractor.mockImplementation(() => ({ extract: mockExtract }));
      
      const result = await extractor.extract('/path/to/file.mbox', '/output');
      
      expect(result).toEqual({ emailsExtracted: 10 });
    });
    
    it('should extract OLM files without attachment directory', async () => {
      const mockExtract = jest.fn().mockResolvedValue({ emailsExtracted: 7 });
      OLMExtractor.mockImplementation(() => ({ extract: mockExtract }));
      
      const result = await extractor.extract('/path/to/file.olm', '/output');
      
      expect(result).toEqual({ emailsExtracted: 7 });
    });
    
    it('should throw error for PST/OST files without attachment directory', async () => {
      await expect(extractor.extract('/path/to/file.pst', '/output')).rejects.toThrow(
        'Attachment directory is required for PST/OST files'
      );
    });
    
    it('should throw error for unsupported file types', async () => {
      await expect(extractor.extract('/path/to/file.xyz', '/output')).rejects.toThrow(
        'Unsupported file type: .xyz'
      );
    });
    
    it('should pass custom options to extractors', async () => {
      const mockExtract = jest.fn().mockResolvedValue({});
      MboxExtractor.mockImplementation(() => ({ extract: mockExtract }));
      
      await extractor.extract('/path/to/file.mbox', '/output', null, { verbose: true });
      
      expect(MboxExtractor).toHaveBeenCalledWith({
        verbose: true,
        format: 'eml',
        maxDepth: -1,
        skipEmpty: true
      });
    });
  });
});

describe('Module exports', () => {
  it('should export all classes', () => {
    expect(EmailExtractor).toBeDefined();
    expect(PSTExtractor).toBeDefined();
    expect(MboxExtractor).toBeDefined();
    expect(OLMExtractor).toBeDefined();
  });
});
