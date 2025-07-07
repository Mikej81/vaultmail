const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { PSTFile, PSTMessage } = require('pst-extractor');

/**
 * PST/OST Email Archive Extractor
 * 
 * Handles extraction from Microsoft Outlook Personal Storage Table (PST) and
 * Offline Storage Table (OST) files. Supports both small files via JavaScript
 * parsing and large files via external readpst tool for optimal performance.
 */
class PSTExtractor {
  /**
   * Create a new PST extractor instance
   * 
   * @param {Object} options - Configuration options
   * @param {boolean} options.verbose - Enable detailed logging
   * @param {number} options.maxDepth - Maximum folder depth to process
   * @param {boolean} options.skipEmpty - Skip folders with no content
   * @param {string} options.format - Output format ('eml' or 'txt')
   */
  constructor(options = {}) {
    this.options = {
      verbose: false,
      maxDepth: -1,
      skipEmpty: true,
      format: 'eml',
      ...options
    };
    
    this.stats = {
      foldersProcessed: 0,
      emailsExtracted: 0,
      attachmentsExtracted: 0,
      startTime: null
    };
  }

  resetStats() {
    this.stats = {
      foldersProcessed: 0,
      emailsExtracted: 0,
      attachmentsExtracted: 0,
      startTime: Date.now()
    };
  }

  ensureDirectoryExistence(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  sanitizeFilename(filename) {
    if (!filename) {return 'unknown';}
    return filename.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_');
  }

  generateEmlContent(email, sender, recipients) {
    const eml = [];
    
    eml.push(`From: ${sender}`);
    eml.push(`To: ${recipients}`);
    eml.push(`Subject: ${email.subject || 'No Subject'}`);
    eml.push(`Date: ${email.clientSubmitTime || new Date().toISOString()}`);
    eml.push(`Message-ID: <${email.descriptorNodeId || Date.now()}@extracted>`);
    eml.push('');
    eml.push(email.body || '');
    
    return eml.join('\r\n');
  }

  saveEmail(email, emailDir, sender, recipients, filePrefix = '') {
    const emailId = email.descriptorNodeId || Date.now();
    const filename = filePrefix ? 
      this.sanitizeFilename(`${filePrefix}-${emailId}`) : 
      this.sanitizeFilename(`${emailId}`);
    const filePath = path.join(emailDir, `${filename}.${this.options.format}`);
    
    let content;
    if (this.options.format === 'eml') {
      content = this.generateEmlContent(email, sender, recipients);
    } else {
      content = `${email.clientSubmitTime}\r\n`;
      content += `Type: ${email.messageClass}\r\n`;
      content += `From: ${sender}\r\n`;
      content += `To: ${recipients}\r\n`;
      content += `Subject: ${email.subject}\r\n`;
      content += email.body || '';
    }
    
    fs.writeFileSync(filePath, content);
    this.stats.emailsExtracted++;
    
    return filePath;
  }

  saveAttachment(attachment, attachmentDir, emailId) {
    const filename = this.sanitizeFilename(attachment.longFilename || attachment.filename || 'attachment');
    const filePath = path.join(attachmentDir, `${emailId}-${filename}`);
    
    if (attachment.fileInputStream) {
      const fd = fs.openSync(filePath, 'w');
      const buffer = Buffer.alloc(8176);
      let bytesRead;
      
      do {
        bytesRead = attachment.fileInputStream.read(buffer);
        if (bytesRead > 0) {
          fs.writeSync(fd, buffer, 0, bytesRead);
        }
      } while (bytesRead === 8176);
      
      fs.closeSync(fd);
      this.stats.attachmentsExtracted++;
      
      return filePath;
    }
    return null;
  }

  async checkForReadpst() {
    return new Promise((resolve) => {
      const readpst = spawn('readpst', ['-V']);
      
      readpst.on('close', (code) => {
        resolve(code === 0);
      });
      
      readpst.on('error', () => {
        resolve(false);
      });
      
      setTimeout(() => {
        readpst.kill();
        resolve(false);
      }, 5000);
    });
  }

  async extract(filePath, outputDir, attachmentDir) {
    this.resetStats();
    this.ensureDirectoryExistence(outputDir);
    this.ensureDirectoryExistence(attachmentDir);
    
    const fileStats = fs.statSync(filePath);
    const sourceFileName = path.basename(filePath, path.extname(filePath));
    const filePrefix = sourceFileName.toLowerCase().replace(/\s+/g, '');
    
    if (fileStats.size > 2 * 1024 * 1024 * 1024) {
      const hasReadpst = await this.checkForReadpst();
      
      if (hasReadpst) {
        try {
          await this.processLargePSTWithReadpst(filePath, outputDir, attachmentDir);
          return this.stats;
        } catch (error) {
          console.warn('External tool failed, falling back to built-in extractor');
        }
      }
    }
    
    let pstFile;
    
    if (fileStats.size <= 2 * 1024 * 1024 * 1024) {
      pstFile = new PSTFile(fs.readFileSync(filePath));
    } else {
      pstFile = new PSTFile(filePath);
    }
    
    const rootFolder = pstFile.getRootFolder();
    this.processPSTFolder(rootFolder, outputDir, attachmentDir, 0, filePrefix);
    
    return this.stats;
  }

  processPSTFolder(folder, outputDir, attachmentDir, depth = 0, filePrefix = '') {
    if (this.options.maxDepth !== -1 && depth > this.options.maxDepth) {return false;}
    
    const folderName = this.sanitizeFilename(folder.displayName);
    const folderPath = path.join(outputDir, folderName);
    
    this.stats.foldersProcessed++;
    
    let hasEmails = false;
    
    if (folder.contentCount > 0) {
      let item = folder.getNextChild();
      const emails = [];
      
      while (item) {
        if (item instanceof PSTMessage) {
          const messageClass = item.messageClass ? item.messageClass.toLowerCase() : '';
          
          if (!messageClass.includes('ipm.contact') && !messageClass.includes('ipm.appointment') && !messageClass.includes('ipm.task')) {
            emails.push(item);
            hasEmails = true;
          }
        }
        item = folder.getNextChild();
      }
      
      if (emails.length > 0 || !this.options.skipEmpty) {
        this.ensureDirectoryExistence(folderPath);
        
        emails.forEach(email => {
          const sender = email.senderName || email.senderEmailAddress || 'Unknown';
          const recipients = email.displayTo || 'Unknown';
          
          this.saveEmail(email, folderPath, sender, recipients, filePrefix);
          
          for (let i = 0; i < email.numberOfAttachments; i++) {
            const attachment = email.getAttachment(i);
            if (attachment && attachment.filename) {
              this.saveAttachment(attachment, attachmentDir, email.descriptorNodeId);
            }
          }
        });
      }
    }
    
    if (folder.hasSubfolders) {
      const subFolders = folder.getSubFolders();
      let hasSubfolderContent = false;
      
      subFolders.forEach(subFolder => {
        const subFolderHasContent = this.processPSTFolder(subFolder, folderPath, attachmentDir, depth + 1, filePrefix);
        if (subFolderHasContent) {hasSubfolderContent = true;}
      });
      
      if (hasSubfolderContent && !hasEmails && this.options.skipEmpty) {
        this.ensureDirectoryExistence(folderPath);
      }
      
      return hasEmails || hasSubfolderContent;
    }
    
    return hasEmails;
  }

  async processLargePSTWithReadpst(filePath, outputDir, attachmentDir) {
    return new Promise((resolve, reject) => {
      const tempDir = path.join(outputDir, 'readpst_temp');
      this.ensureDirectoryExistence(tempDir);
      
      const readpstArgs = [
        '-o', tempDir,
        '-e',
        '-cv',
        '-t', 'eajc',
        '-8',
        '-D',
        filePath
      ];
      
      const readpst = spawn('readpst', readpstArgs);
      
      readpst.on('close', async (code) => {
        if (code === 0) {
          await this.convertReadpstOutput(tempDir, outputDir, attachmentDir);
          resolve();
        } else {
          reject(new Error(`readpst failed with code ${code}`));
        }
      });
      
      readpst.on('error', (error) => {
        reject(new Error(`Failed to spawn readpst: ${error.message}`));
      });
    });
  }

  async convertReadpstOutput(tempDir, outputDir, attachmentDir) {
    const files = fs.readdirSync(tempDir, { withFileTypes: true });
    
    for (const file of files) {
      if (file.isFile()) {
        const sourcePath = path.join(tempDir, file.name);
        const ext = path.extname(file.name).toLowerCase();
        
        if (ext === '.eml') {
          const destPath = path.join(outputDir, file.name);
          fs.copyFileSync(sourcePath, destPath);
          this.stats.emailsExtracted++;
        } else if (ext === '.vcf') {
          const contactsDir = path.join(outputDir, 'contacts');
          this.ensureDirectoryExistence(contactsDir);
          const destPath = path.join(contactsDir, file.name);
          fs.copyFileSync(sourcePath, destPath);
        } else if (ext === '.ics') {
          const calendarDir = path.join(outputDir, 'calendar');
          this.ensureDirectoryExistence(calendarDir);
          const destPath = path.join(calendarDir, file.name);
          fs.copyFileSync(sourcePath, destPath);
        } else {
          const destPath = path.join(attachmentDir, file.name);
          fs.copyFileSync(sourcePath, destPath);
          this.stats.attachmentsExtracted++;
        }
      } else if (file.isDirectory()) {
        const subDir = path.join(tempDir, file.name);
        const subOutputDir = path.join(outputDir, file.name);
        this.ensureDirectoryExistence(subOutputDir);
        await this.convertReadpstOutput(subDir, subOutputDir, attachmentDir);
      }
    }
  }
}

module.exports = PSTExtractor;
