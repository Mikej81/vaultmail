const fs = require('fs');
const path = require('path');
const { OLMReader } = require('olm-reader');

class OLMExtractor {
  constructor(options = {}) {
    this.options = {
      verbose: false,
      format: 'eml',
      ...options
    };
    
    this.stats = {
      emailsExtracted: 0,
      contactsExtracted: 0,
      appointmentsExtracted: 0,
      tasksExtracted: 0,
      notesExtracted: 0,
      startTime: null
    };
  }

  resetStats() {
    this.stats = {
      emailsExtracted: 0,
      contactsExtracted: 0,
      appointmentsExtracted: 0,
      tasksExtracted: 0,
      notesExtracted: 0,
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
    
    return new Promise((resolve, reject) => {
      const olmReader = new OLMReader(outputDir);
      
      // Set up callbacks for different data types
      olmReader.setEmailCallback((email) => {
        try {
          const emailDir = path.join(outputDir, 'emails');
          this.ensureDirectoryExistence(emailDir);
          
          const filename = this.sanitizeFilename(`${Date.now()}-${this.stats.emailsExtracted + 1}`);
          const emailPath = path.join(emailDir, `${filename}.${this.options.format}`);
          
          if (this.options.format === 'eml') {
            // Generate EML content
            const eml = [];
            eml.push(`From: ${email.fromName || email.fromAddress || 'Unknown'}`);
            eml.push(`To: ${email.toRecipients || 'Unknown'}`);
            eml.push(`Subject: ${email.subject || 'No Subject'}`);
            eml.push(`Date: ${email.sentTime || new Date().toISOString()}`);
            eml.push(`Message-ID: <${email.messageId || Date.now()}@extracted>`);
            eml.push('');
            eml.push(email.body || '');
            
            fs.writeFileSync(emailPath, eml.join('\r\n'));
          } else {
            // Text format
            let content = `Date: ${email.sentTime || new Date().toISOString()}\r\n`;
            content += `From: ${email.fromName || email.fromAddress || 'Unknown'}\r\n`;
            content += `To: ${email.toRecipients || 'Unknown'}\r\n`;
            content += `Subject: ${email.subject || 'No Subject'}\r\n\r\n`;
            content += email.body || '';
            
            fs.writeFileSync(emailPath, content);
          }
          
          this.stats.emailsExtracted++;
          
          if (this.options.verbose) {
            console.log(`Extracted email: ${emailPath}`);
          }
        } catch (error) {
          if (this.options.verbose) {
            console.warn(`Error processing email: ${error.message}`);
          }
        }
      });
      
      olmReader.setContactCallback((contact) => {
        try {
          const contactsDir = path.join(outputDir, 'contacts');
          this.ensureDirectoryExistence(contactsDir);
          
          const filename = this.sanitizeFilename(`${Date.now()}-${this.stats.contactsExtracted + 1}-contact`);
          const contactPath = path.join(contactsDir, `${filename}.vcf`);
          
          // Generate VCard format
          let vcard = 'BEGIN:VCARD\r\n';
          vcard += 'VERSION:3.0\r\n';
          
          if (contact.displayName) {
            vcard += `FN:${contact.displayName}\r\n`;
          }
          if (contact.lastName || contact.firstName) {
            vcard += `N:${contact.lastName || ''};${contact.firstName || ''};;;\r\n`;
          }
          if (contact.emailAddress) {
            vcard += `EMAIL:${contact.emailAddress}\r\n`;
          }
          if (contact.businessPhone) {
            vcard += `TEL;TYPE=WORK:${contact.businessPhone}\r\n`;
          }
          if (contact.homePhone) {
            vcard += `TEL;TYPE=HOME:${contact.homePhone}\r\n`;
          }
          if (contact.organization) {
            vcard += `ORG:${contact.organization}\r\n`;
          }
          
          vcard += 'END:VCARD\r\n';
          
          fs.writeFileSync(contactPath, vcard);
          this.stats.contactsExtracted++;
          
          if (this.options.verbose) {
            console.log(`Extracted contact: ${contactPath}`);
          }
        } catch (error) {
          if (this.options.verbose) {
            console.warn(`Error processing contact: ${error.message}`);
          }
        }
      });
      
      olmReader.setAppointmentCallback((appointment) => {
        try {
          const appointmentsDir = path.join(outputDir, 'appointments');
          this.ensureDirectoryExistence(appointmentsDir);
          
          const filename = this.sanitizeFilename(`${Date.now()}-${this.stats.appointmentsExtracted + 1}-appointment`);
          const appointmentPath = path.join(appointmentsDir, `${filename}.ics`);
          
          // Generate ICS format
          let ics = 'BEGIN:VCALENDAR\r\n';
          ics += 'VERSION:2.0\r\n';
          ics += 'PRODID:-//Email Extractor//OLM Calendar Export//EN\r\n';
          ics += 'BEGIN:VEVENT\r\n';
          
          if (appointment.subject) {
            ics += `SUMMARY:${appointment.subject}\r\n`;
          }
          if (appointment.startTime) {
            const startTime = new Date(appointment.startTime).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
            ics += `DTSTART:${startTime}\r\n`;
          }
          if (appointment.endTime) {
            const endTime = new Date(appointment.endTime).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
            ics += `DTEND:${endTime}\r\n`;
          }
          if (appointment.body) {
            ics += `DESCRIPTION:${appointment.body.replace(/\r\n/g, '\\n')}\r\n`;
          }
          
          ics += `UID:${appointment.id || Date.now()}@extracted\r\n`;
          ics += 'END:VEVENT\r\n';
          ics += 'END:VCALENDAR\r\n';
          
          fs.writeFileSync(appointmentPath, ics);
          this.stats.appointmentsExtracted++;
          
          if (this.options.verbose) {
            console.log(`Extracted appointment: ${appointmentPath}`);
          }
        } catch (error) {
          if (this.options.verbose) {
            console.warn(`Error processing appointment: ${error.message}`);
          }
        }
      });
      
      olmReader.setTaskCallback((task) => {
        try {
          const tasksDir = path.join(outputDir, 'tasks');
          this.ensureDirectoryExistence(tasksDir);
          
          const filename = this.sanitizeFilename(`${Date.now()}-${this.stats.tasksExtracted + 1}-task`);
          const taskPath = path.join(tasksDir, `${filename}.txt`);
          
          let content = `Subject: ${task.subject || 'No Subject'}\r\n`;
          content += `Due Date: ${task.dueDate || 'Not set'}\r\n`;
          content += `Priority: ${task.priority || 'Normal'}\r\n`;
          content += `Status: ${task.status || 'Not started'}\r\n`;
          content += `\r\n${task.body || ''}\r\n`;
          
          fs.writeFileSync(taskPath, content);
          this.stats.tasksExtracted++;
          
          if (this.options.verbose) {
            console.log(`Extracted task: ${taskPath}`);
          }
        } catch (error) {
          if (this.options.verbose) {
            console.warn(`Error processing task: ${error.message}`);
          }
        }
      });
      
      olmReader.setNoteCallback((note) => {
        try {
          const notesDir = path.join(outputDir, 'notes');
          this.ensureDirectoryExistence(notesDir);
          
          const filename = this.sanitizeFilename(`${Date.now()}-${this.stats.notesExtracted + 1}-note`);
          const notePath = path.join(notesDir, `${filename}.txt`);
          
          let content = `Subject: ${note.subject || 'No Subject'}\r\n`;
          content += `Created: ${note.createdTime || new Date().toISOString()}\r\n`;
          content += `\r\n${note.body || ''}\r\n`;
          
          fs.writeFileSync(notePath, content);
          this.stats.notesExtracted++;
          
          if (this.options.verbose) {
            console.log(`Extracted note: ${notePath}`);
          }
        } catch (error) {
          if (this.options.verbose) {
            console.warn(`Error processing note: ${error.message}`);
          }
        }
      });
      
      // Start the extraction process
      olmReader.readOLMFile(filePath)
        .then(() => {
          resolve(this.stats);
        })
        .catch((error) => {
          reject(error);
        });
    });
  }
}

module.exports = OLMExtractor;
