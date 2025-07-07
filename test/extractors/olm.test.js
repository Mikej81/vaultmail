const fs = require('fs');
const OLMExtractor = require('../../lib/extractors/olm');

// Mock olm-reader module
jest.mock('olm-reader', () => ({
  OLMReader: jest.fn()
}));

describe('OLMExtractor', () => {
  let extractor;
  let mockOutputDir;
  
  beforeEach(() => {
    extractor = new OLMExtractor({
      verbose: false,
      format: 'eml'
    });
    
    mockOutputDir = '/tmp/test-output';
    
    // Mock fs methods
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'mkdirSync').mockReturnValue(undefined);
    jest.spyOn(fs, 'writeFileSync').mockReturnValue(undefined);
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  describe('constructor', () => {
    it('should initialize with default options', () => {
      const defaultExtractor = new OLMExtractor();
      expect(defaultExtractor.options.verbose).toBe(false);
      expect(defaultExtractor.options.format).toBe('eml');
    });
    
    it('should override default options', () => {
      const customExtractor = new OLMExtractor({
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
      extractor.stats.contactsExtracted = 5;
      extractor.resetStats();
      
      expect(extractor.stats.emailsExtracted).toBe(0);
      expect(extractor.stats.contactsExtracted).toBe(0);
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
    it('should set up callbacks and process OLM file', async () => {
      const mockFilePath = '/test/archive.olm';
      
      // Mock OLMReader
      const mockReader = {
        setEmailCallback: jest.fn(),
        setContactCallback: jest.fn(),
        setAppointmentCallback: jest.fn(),
        setTaskCallback: jest.fn(),
        setNoteCallback: jest.fn(),
        readOLMFile: jest.fn().mockResolvedValue()
      };
      
      const { OLMReader } = require('olm-reader');
      OLMReader.mockReturnValue(mockReader);
      
      const result = await extractor.extract(mockFilePath, mockOutputDir);
      
      expect(OLMReader).toHaveBeenCalledWith(mockOutputDir);
      expect(mockReader.setEmailCallback).toHaveBeenCalled();
      expect(mockReader.setContactCallback).toHaveBeenCalled();
      expect(mockReader.setAppointmentCallback).toHaveBeenCalled();
      expect(mockReader.setTaskCallback).toHaveBeenCalled();
      expect(mockReader.setNoteCallback).toHaveBeenCalled();
      expect(mockReader.readOLMFile).toHaveBeenCalledWith(mockFilePath);
      expect(result).toEqual(extractor.stats);
    });
    
    it('should handle email callback correctly', async () => {
      const mockFilePath = '/test/archive.olm';
      
      // Mock OLMReader
      const mockReader = {
        setEmailCallback: jest.fn(),
        setContactCallback: jest.fn(),
        setAppointmentCallback: jest.fn(),
        setTaskCallback: jest.fn(),
        setNoteCallback: jest.fn(),
        readOLMFile: jest.fn().mockImplementation(() => {
          // Simulate email callback
          const emailCallback = mockReader.setEmailCallback.mock.calls[0][0];
          emailCallback({
            subject: 'Test Email',
            fromName: 'John Doe',
            fromAddress: 'john@example.com',
            toRecipients: 'jane@example.com',
            body: 'Test body',
            sentTime: '2023-01-01T00:00:00Z',
            messageId: 'test-message-id'
          });
          return Promise.resolve();
        })
      };
      
      const { OLMReader } = require('olm-reader');
      OLMReader.mockReturnValue(mockReader);
      
      await extractor.extract(mockFilePath, mockOutputDir);
      
      expect(extractor.stats.emailsExtracted).toBe(1);
      expect(fs.writeFileSync).toHaveBeenCalled();
      
      const writeCall = fs.writeFileSync.mock.calls[0];
      expect(writeCall[0]).toContain('emails');
      expect(writeCall[0]).toContain('.eml');
      expect(writeCall[1]).toContain('From: John Doe');
      expect(writeCall[1]).toContain('Subject: Test Email');
      expect(writeCall[1]).toContain('Test body');
    });
    
    it('should handle contact callback correctly', async () => {
      const mockFilePath = '/test/archive.olm';
      
      // Mock OLMReader
      const mockReader = {
        setEmailCallback: jest.fn(),
        setContactCallback: jest.fn(),
        setAppointmentCallback: jest.fn(),
        setTaskCallback: jest.fn(),
        setNoteCallback: jest.fn(),
        readOLMFile: jest.fn().mockImplementation(() => {
          // Simulate contact callback
          const contactCallback = mockReader.setContactCallback.mock.calls[0][0];
          contactCallback({
            displayName: 'John Doe',
            firstName: 'John',
            lastName: 'Doe',
            emailAddress: 'john@example.com',
            businessPhone: '555-1234',
            homePhone: '555-5678',
            organization: 'Test Corp'
          });
          return Promise.resolve();
        })
      };
      
      const { OLMReader } = require('olm-reader');
      OLMReader.mockReturnValue(mockReader);
      
      await extractor.extract(mockFilePath, mockOutputDir);
      
      expect(extractor.stats.contactsExtracted).toBe(1);
      expect(fs.writeFileSync).toHaveBeenCalled();
      
      const writeCall = fs.writeFileSync.mock.calls[0];
      expect(writeCall[0]).toContain('contacts');
      expect(writeCall[0]).toContain('.vcf');
      expect(writeCall[1]).toContain('FN:John Doe');
      expect(writeCall[1]).toContain('N:Doe;John;;;');
      expect(writeCall[1]).toContain('EMAIL:john@example.com');
      expect(writeCall[1]).toContain('BEGIN:VCARD');
      expect(writeCall[1]).toContain('END:VCARD');
    });
    
    it('should handle appointment callback correctly', async () => {
      const mockFilePath = '/test/archive.olm';
      
      // Mock OLMReader
      const mockReader = {
        setEmailCallback: jest.fn(),
        setContactCallback: jest.fn(),
        setAppointmentCallback: jest.fn(),
        setTaskCallback: jest.fn(),
        setNoteCallback: jest.fn(),
        readOLMFile: jest.fn().mockImplementation(() => {
          // Simulate appointment callback
          const appointmentCallback = mockReader.setAppointmentCallback.mock.calls[0][0];
          appointmentCallback({
            subject: 'Test Meeting',
            startTime: '2023-01-01T10:00:00Z',
            endTime: '2023-01-01T11:00:00Z',
            body: 'Meeting description',
            id: 'meeting-123'
          });
          return Promise.resolve();
        })
      };
      
      const { OLMReader } = require('olm-reader');
      OLMReader.mockReturnValue(mockReader);
      
      await extractor.extract(mockFilePath, mockOutputDir);
      
      expect(extractor.stats.appointmentsExtracted).toBe(1);
      expect(fs.writeFileSync).toHaveBeenCalled();
      
      const writeCall = fs.writeFileSync.mock.calls[0];
      expect(writeCall[0]).toContain('appointments');
      expect(writeCall[0]).toContain('.ics');
      expect(writeCall[1]).toContain('SUMMARY:Test Meeting');
      expect(writeCall[1]).toContain('DTSTART:20230101T100000Z');
      expect(writeCall[1]).toContain('DTEND:20230101T110000Z');
      expect(writeCall[1]).toContain('BEGIN:VCALENDAR');
      expect(writeCall[1]).toContain('END:VCALENDAR');
    });
    
    it('should handle OLMReader errors', async () => {
      const mockFilePath = '/test/archive.olm';
      
      // Mock OLMReader with error
      const mockReader = {
        setEmailCallback: jest.fn(),
        setContactCallback: jest.fn(),
        setAppointmentCallback: jest.fn(),
        setTaskCallback: jest.fn(),
        setNoteCallback: jest.fn(),
        readOLMFile: jest.fn().mockRejectedValue(new Error('OLM read error'))
      };
      
      const { OLMReader } = require('olm-reader');
      OLMReader.mockReturnValue(mockReader);
      
      await expect(extractor.extract(mockFilePath, mockOutputDir)).rejects.toThrow('OLM read error');
    });
    
    it('should handle text format for emails', async () => {
      extractor.options.format = 'txt';
      const mockFilePath = '/test/archive.olm';
      
      // Mock OLMReader
      const mockReader = {
        setEmailCallback: jest.fn(),
        setContactCallback: jest.fn(),
        setAppointmentCallback: jest.fn(),
        setTaskCallback: jest.fn(),
        setNoteCallback: jest.fn(),
        readOLMFile: jest.fn().mockImplementation(() => {
          // Simulate email callback
          const emailCallback = mockReader.setEmailCallback.mock.calls[0][0];
          emailCallback({
            subject: 'Test Email',
            fromName: 'John Doe',
            body: 'Test body',
            sentTime: '2023-01-01T00:00:00Z'
          });
          return Promise.resolve();
        })
      };
      
      const { OLMReader } = require('olm-reader');
      OLMReader.mockReturnValue(mockReader);
      
      await extractor.extract(mockFilePath, mockOutputDir);
      
      const writeCall = fs.writeFileSync.mock.calls[0];
      expect(writeCall[0]).toContain('.txt');
      expect(writeCall[1]).toContain('Date: 2023-01-01T00:00:00Z');
      expect(writeCall[1]).toContain('From: John Doe');
      expect(writeCall[1]).toContain('Subject: Test Email');
    });
  });
});
