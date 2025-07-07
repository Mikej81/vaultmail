const fs = require('fs');
const path = require('path');
const readline = require('readline');

class MboxExtractor {
  constructor(options = {}) {
    this.options = {
      verbose: false,
      format: 'eml',
      ...options
    };
    
    this.stats = {
      emailsExtracted: 0,
      startTime: null
    };
  }

  resetStats() {
    this.stats = {
      emailsExtracted: 0,
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

  async extract(filePath, outputDir) {
    this.resetStats();
    this.ensureDirectoryExistence(outputDir);
    
    const sourceFileName = path.basename(filePath, path.extname(filePath));
    const filePrefix = sourceFileName.toLowerCase().replace(/\s+/g, '');
    
    return new Promise((resolve, reject) => {
      let emailCount = 0;
      let currentEmailLines = [];
      let inEmail = false;
      
      const processEmail = (emailLines) => {
        if (emailLines.length === 0) {return;}
        
        emailCount++;
        
        try {
          const filename = this.sanitizeFilename(`${filePrefix}-${emailCount.toString().padStart(4, '0')}-email`);
          const emailFilePath = path.join(outputDir, `${filename}.${this.options.format}`);
          const emailContent = emailLines.join('\n');
          
          if (this.options.format === 'eml') {
            fs.writeFileSync(emailFilePath, emailContent);
          } else {
            let subject = 'No Subject';
            let from = 'Unknown';
            let to = 'Unknown';
            let date = new Date().toISOString();
            
            for (let i = 0; i < Math.min(emailLines.length, 50); i++) {
              const line = emailLines[i].toLowerCase();
              if (line.startsWith('subject:')) {
                subject = emailLines[i].substring(8).trim();
              } else if (line.startsWith('from:')) {
                from = emailLines[i].substring(5).trim();
              } else if (line.startsWith('to:')) {
                to = emailLines[i].substring(3).trim();
              } else if (line.startsWith('date:')) {
                date = emailLines[i].substring(5).trim();
              }
            }
            
            let content = `Date: ${date}\r\n`;
            content += `From: ${from}\r\n`;
            content += `To: ${to}\r\n`;
            content += `Subject: ${subject}\r\n\r\n`;
            content += emailContent;
            
            fs.writeFileSync(emailFilePath, content);
          }
          
          this.stats.emailsExtracted++;
          
        } catch (error) {
          if (this.options.verbose) {
            console.warn(`Error processing email ${emailCount}: ${error.message}`);
          }
        }
      };
      
      const fileStream = fs.createReadStream(filePath);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });
      
      rl.on('line', (line) => {
        if (line.startsWith('From ') && inEmail) {
          processEmail(currentEmailLines);
          currentEmailLines = [line];
        } else if (line.startsWith('From ') && !inEmail) {
          inEmail = true;
          currentEmailLines = [line];
        } else if (inEmail) {
          currentEmailLines.push(line);
        }
      });
      
      rl.on('close', () => {
        try {
          if (currentEmailLines.length > 0) {
            processEmail(currentEmailLines);
          }
          resolve(this.stats);
        } catch (error) {
          reject(error);
        }
      });
      
      rl.on('error', (error) => {
        reject(error);
      });
    });
  }
}

module.exports = MboxExtractor;
