#!/usr/bin/env node

// Legacy entry point - redirect to new CLI
console.warn('Warning: Using index.js directly is deprecated. Please use "vaultmail" command or require("vaultmail") for library usage.');
require('./bin/cli.js');

const ANSI_RED = 31;
const ANSI_YELLOW = 93;
const ANSI_GREEN = 32;
const ANSI_BLUE = 34;

const highlight = (str, code = ANSI_RED) => `\u001b[${code}m${str}\u001b[0m`;

// Global progress tracking
let globalStats = {
  foldersProcessed: 0,
  emailsExtracted: 0,
  attachmentsExtracted: 0,
  startTime: null,
  lastUpdateTime: null,
  heartbeatTimer: null
};

function resetGlobalStats() {
  if (globalStats.heartbeatTimer) {
    clearInterval(globalStats.heartbeatTimer);
  }
  
  globalStats = {
    foldersProcessed: 0,
    emailsExtracted: 0,
    attachmentsExtracted: 0,
    startTime: Date.now(),
    lastUpdateTime: Date.now(),
    heartbeatTimer: null
  };
  
  // Start heartbeat timer to show activity every 15 seconds if no other updates
  globalStats.heartbeatTimer = setInterval(() => {
    const now = Date.now();
    const timeSinceLastUpdate = now - globalStats.lastUpdateTime;
    
    if (timeSinceLastUpdate > 10000 && !argv.quiet) { // No updates for 10+ seconds
      const elapsed = Math.floor((now - globalStats.startTime) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      console.log(highlight(`Still working... ${minutes}m ${seconds}s elapsed`, ANSI_BLUE));
    }
  }, 15000);
}

function showProgress(force = false) {
  if (argv.quiet && !force) return;
  
  const now = Date.now();
  const timeSinceLastUpdate = now - globalStats.lastUpdateTime;
  
  // Show progress every 5 seconds or when forced
  if (force || timeSinceLastUpdate > 5000) {
    const elapsed = Math.floor((now - globalStats.startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    
    console.log(highlight(
      `Progress: ${globalStats.foldersProcessed} folders, ${globalStats.emailsExtracted} emails, ${globalStats.attachmentsExtracted} attachments | ${minutes}m ${seconds}s elapsed`,
      ANSI_GREEN
    ));
    
    globalStats.lastUpdateTime = now;
  }
}

const argv = yargs(hideBin(process.argv))
  .option('input', {
    alias: 'i',
    type: 'string',
    description: 'Input email archive file or glob pattern (e.g. *.mbox, /path/to/*.pst)',
    demandOption: false
  })
  .option('output', {
    alias: 'o',
    type: 'string',
    description: 'Output directory for extracted emails',
    default: './output'
  })
  .option('attachments', {
    alias: 'a',
    type: 'string',
    description: 'Directory for extracted attachments',
    default: './attachments'
  })
  .option('recursive', {
    alias: 'r',
    type: 'boolean',
    description: 'Process folders recursively',
    default: true
  })
  .option('format', {
    alias: 'f',
    type: 'string',
    description: 'Output format for emails',
    choices: ['eml', 'txt'],
    default: 'eml'
  })
  .option('verbose', {
    alias: 'v',
    type: 'boolean',
    description: 'Enable verbose logging',
    default: false
  })
  .option('max-depth', {
    alias: 'd',
    type: 'number',
    description: 'Maximum folder depth to process (-1 for unlimited)',
    default: -1
  })
  .option('skip-empty', {
    alias: 's',
    type: 'boolean',
    description: 'Skip creating folders that contain no emails',
    default: true
  })
  .option('quiet', {
    alias: 'q',
    type: 'boolean',
    description: 'Suppress progress updates (less output)',
    default: false
  })
  .option('test-readpst', {
    type: 'boolean',
    description: 'Test if readpst command is available and exit',
    default: false
  })
  .help()
  .alias('help', 'h')
  .example('$0 -i archive.pst -o ./emails -a ./attachments', 'Extract PST file to separate directories')
  .example('$0 -i mailbox.mbox -f eml --verbose', 'Extract MBOX file with verbose logging')
  .example('$0 -i "*.mbox" -o ./emails', 'Extract all MBOX files in current directory')
  .example('$0 -i "/path/to/archives/*.pst" -o ./emails', 'Extract all PST files from specific path')
  .example('$0 -i archive.ost --skip-empty false', 'Extract OST file including empty folders')
  .epilog(`
For large PST files (>2GB), install external tools:
  Linux: sudo apt-get install pst-utils
  macOS: brew install libpst
  Windows: Download libpst from https://www.five-ten-sg.com/libpst/
  `)
  .argv;

function detectFileType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  
  // Check file size first to avoid loading large files into memory
  const fileStats = fs.statSync(filePath);
  const isLargeFile = fileStats.size > 2 * 1024 * 1024 * 1024;
  
  if (ext === '.pst') {
    return 'pst';
  } else if (ext === '.ost') {
    return 'ost';
  } else if (ext === '.mbox') {
    return 'mbox';
  }
  
  // For unknown extensions, try to detect by content (only for small files)
  if (!isLargeFile) {
    const buffer = fs.readFileSync(filePath, { start: 0, end: 8 });
    
    if (buffer.toString('hex').startsWith('2142444e')) {
      return 'pst';
    } else if (buffer.toString('ascii').startsWith('From ')) {
      return 'mbox';
    }
  }
  
  throw new Error(`Unsupported file type: ${ext}`);
}

function resolveInputFiles(inputPattern) {
  // Check if the input contains glob patterns
  if (inputPattern.includes('*') || inputPattern.includes('?') || inputPattern.includes('[')) {
    // Use glob to find matching files with proper options for spaces
    const matchedFiles = glob.sync(inputPattern, { 
      windowsPathsNoEscape: true,
      nonull: false 
    });
    
    if (matchedFiles.length === 0) {
      throw new Error(`No files found matching pattern: ${inputPattern}`);
    }
    
    // Filter to only supported file types
    const supportedFiles = matchedFiles.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.pst', '.ost', '.mbox'].includes(ext);
    });
    
    if (supportedFiles.length === 0) {
      throw new Error(`No supported email archive files found matching pattern: ${inputPattern}`);
    }
    
    return supportedFiles;
  } else {
    // Single file
    if (!fs.existsSync(inputPattern)) {
      throw new Error(`Input file not found: ${inputPattern}`);
    }
    return [inputPattern];
  }
}

function ensureDirectoryExistence(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function sanitizeFilename(filename) {
  if (!filename) return 'unknown';
  return filename.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_');
}

function generateEmlContent(email, sender, recipients) {
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

function saveEmail(email, emailDir, sender, recipients, format = 'eml', filePrefix = '') {
  const emailId = email.descriptorNodeId || Date.now();
  const filename = filePrefix ? 
    sanitizeFilename(`${filePrefix}-${emailId}`) : 
    sanitizeFilename(`${emailId}`);
  const filePath = path.join(emailDir, `${filename}.${format}`);
  
  let content;
  if (format === 'eml') {
    content = generateEmlContent(email, sender, recipients);
  } else {
    content = `${email.clientSubmitTime}\r\n`;
    content += `Type: ${email.messageClass}\r\n`;
    content += `From: ${sender}\r\n`;
    content += `To: ${recipients}\r\n`;
    content += `Subject: ${email.subject}\r\n`;
    content += email.body || '';
  }
  
  fs.writeFileSync(filePath, content);
  globalStats.emailsExtracted++;
  
  if (argv.verbose) {
    console.log(highlight(`Saved email: ${filePath}`, ANSI_BLUE));
  }
  
  showProgress();
}

function saveContact(contact, contactsDir) {
  const filename = sanitizeFilename(`${contact.descriptorNodeId || Date.now()}-contact`);
  const filePath = path.join(contactsDir, `${filename}.vcf`);
  
  // Generate VCard format
  let vcard = 'BEGIN:VCARD\r\n';
  vcard += 'VERSION:3.0\r\n';
  
  if (contact.displayName) {
    vcard += `FN:${contact.displayName}\r\n`;
  }
  if (contact.surname || contact.givenName) {
    vcard += `N:${contact.surname || ''};${contact.givenName || ''};;;\r\n`;
  }
  if (contact.primaryEmailAddress) {
    vcard += `EMAIL:${contact.primaryEmailAddress}\r\n`;
  }
  if (contact.businessTelephoneNumber) {
    vcard += `TEL;TYPE=WORK:${contact.businessTelephoneNumber}\r\n`;
  }
  if (contact.homeTelephoneNumber) {
    vcard += `TEL;TYPE=HOME:${contact.homeTelephoneNumber}\r\n`;
  }
  if (contact.companyName) {
    vcard += `ORG:${contact.companyName}\r\n`;
  }
  
  vcard += 'END:VCARD\r\n';
  
  fs.writeFileSync(filePath, vcard);
  
  if (argv.verbose) {
    console.log(highlight(`Saved contact: ${filePath}`, ANSI_BLUE));
  }
}

function saveCalendarItem(item, calendarDir) {
  const filename = sanitizeFilename(`${item.descriptorNodeId || Date.now()}-calendar`);
  const filePath = path.join(calendarDir, `${filename}.ics`);
  
  // Generate ICS format
  let ics = 'BEGIN:VCALENDAR\r\n';
  ics += 'VERSION:2.0\r\n';
  ics += 'PRODID:-//Email Extractor//Calendar Export//EN\r\n';
  ics += 'BEGIN:VEVENT\r\n';
  
  if (item.subject) {
    ics += `SUMMARY:${item.subject}\r\n`;
  }
  if (item.startTime) {
    const startTime = new Date(item.startTime).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    ics += `DTSTART:${startTime}\r\n`;
  }
  if (item.endTime) {
    const endTime = new Date(item.endTime).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    ics += `DTEND:${endTime}\r\n`;
  }
  if (item.body) {
    ics += `DESCRIPTION:${item.body.replace(/\r\n/g, '\\n')}\r\n`;
  }
  
  ics += `UID:${item.descriptorNodeId || Date.now()}@extracted\r\n`;
  ics += 'END:VEVENT\r\n';
  ics += 'END:VCALENDAR\r\n';
  
  fs.writeFileSync(filePath, ics);
  
  if (argv.verbose) {
    console.log(highlight(`Saved calendar item: ${filePath}`, ANSI_BLUE));
  }
}



function saveAttachment(attachment, attachmentDir, emailId) {
  const filename = sanitizeFilename(attachment.longFilename || attachment.filename || 'attachment');
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
    globalStats.attachmentsExtracted++;
    
    if (argv.verbose) {
      console.log(highlight(`Saved attachment: ${filePath}`, ANSI_BLUE));
    }
  }
}

function processPSTFolder(folder, outputDir, attachmentDir, depth = 0, filePrefix = '') {
  if (argv.maxDepth !== -1 && depth > argv.maxDepth) return;
  
  const folderName = sanitizeFilename(folder.displayName);
  const folderPath = path.join(outputDir, folderName);
  
  globalStats.foldersProcessed++;
  
  if (argv.verbose && depth > 0) {
    console.log(`${'  '.repeat(depth)}Processing folder: ${folder.displayName}`);
  } else if (!argv.verbose && !argv.quiet) {
    // Show folder progress for non-verbose mode
    console.log(highlight(`Processing: ${folder.displayName}`, ANSI_YELLOW));
  }
  
  showProgress();
  
  let hasEmails = false;
  
  // First check if this folder has any content
  if (folder.contentCount > 0) {
    let item = folder.getNextChild();
    const emails = [];
    const contacts = [];
    const calendarItems = [];
    
    while (item) {
      if (item instanceof PSTMessage) {
        // Determine item type based on message class
        const messageClass = item.messageClass ? item.messageClass.toLowerCase() : '';
        
        if (messageClass.includes('ipm.contact')) {
          contacts.push(item);
        } else if (messageClass.includes('ipm.appointment') || messageClass.includes('ipm.task')) {
          calendarItems.push(item);
        } else {
          // Default to email for other message types
          emails.push(item);
          hasEmails = true;
        }
      }
      item = folder.getNextChild();
    }
    
    // Only create folder if we have content or if skip-empty is disabled
    const hasContent = emails.length > 0 || contacts.length > 0 || calendarItems.length > 0;
    
    if (hasContent || !argv.skipEmpty) {
      ensureDirectoryExistence(folderPath);
      
      // Process emails
      emails.forEach(email => {
        const sender = email.senderName || email.senderEmailAddress || 'Unknown';
        const recipients = email.displayTo || 'Unknown';
        
        saveEmail(email, folderPath, sender, recipients, argv.format, filePrefix);
        
        for (let i = 0; i < email.numberOfAttachments; i++) {
          const attachment = email.getAttachment(i);
          if (attachment && attachment.filename) {
            saveAttachment(attachment, attachmentDir, email.descriptorNodeId);
          }
        }
      });
      
      // Process contacts
      if (contacts.length > 0) {
        const contactsDir = path.join(folderPath, 'contacts');
        ensureDirectoryExistence(contactsDir);
        contacts.forEach(contact => {
          saveContact(contact, contactsDir);
        });
      }
      
      // Process calendar items
      if (calendarItems.length > 0) {
        const calendarDir = path.join(folderPath, 'calendar');
        ensureDirectoryExistence(calendarDir);
        calendarItems.forEach(calendarItem => {
          saveCalendarItem(calendarItem, calendarDir);
        });
      }
    }
    
    hasEmails = hasContent;
  }
  
  // Process subfolders
  if (argv.recursive && folder.hasSubfolders) {
    const subFolders = folder.getSubFolders();
    let hasSubfolderContent = false;
    
    subFolders.forEach(subFolder => {
      const subFolderHasContent = processPSTFolder(subFolder, folderPath, attachmentDir, depth + 1, filePrefix);
      if (subFolderHasContent) hasSubfolderContent = true;
    });
    
    // If we have subfolder content but no direct emails, create folder for subfolders
    if (hasSubfolderContent && !hasEmails && argv.skipEmpty) {
      ensureDirectoryExistence(folderPath);
    }
    
    return hasEmails || hasSubfolderContent;
  }
  
  return hasEmails;
}

function checkForReadpst() {
  return new Promise((resolve) => {
    if (argv.verbose) {
      console.log(highlight(`Checking for readpst command...`, ANSI_BLUE));
    }
    
    // Try readpst -V (capital V for version)
    const readpst = spawn('readpst', ['-V']);
    
    readpst.on('close', (code) => {
      if (argv.verbose) {
        console.log(highlight(`readpst -V exited with code: ${code}`, ANSI_BLUE));
      }
      resolve(code === 0);
    });
    
    readpst.on('error', (error) => {
      if (argv.verbose) {
        console.log(highlight(`readpst command failed: ${error.message}`, ANSI_BLUE));
        console.log(highlight(`This usually means pst-utils is not installed`, ANSI_BLUE));
      }
      resolve(false);
    });
    
    // Add timeout to avoid hanging
    setTimeout(() => {
      if (argv.verbose) {
        console.log(highlight(`readpst detection timed out`, ANSI_BLUE));
      }
      readpst.kill();
      resolve(false);
    }, 5000);
  });
}

function processLargePSTWithReadpst(filePath, outputDir, attachmentDir) {
  return new Promise((resolve, reject) => {
    console.log(highlight(`Processing large PST file with external readpst tool...`, ANSI_YELLOW));
    
    const tempDir = path.join(outputDir, 'readpst_temp');
    ensureDirectoryExistence(tempDir);
    
    const readpstArgs = [
      '-o', tempDir,    // Output directory
      '-e',             // Email format with extensions (EML-like)
      '-cv',            // Contacts in VCard format
      '-t', 'eajc',     // Extract: emails, attachments, journals, contacts
      '-8',             // UTF-8 encoding
      '-D',             // Include deleted items
      filePath
    ];
    
    const readpst = spawn('readpst', readpstArgs);
    
    readpst.stdout.on('data', (data) => {
      if (argv.verbose) {
        console.log(data.toString());
      }
    });
    
    readpst.stderr.on('data', (data) => {
      if (argv.verbose) {
        console.error(data.toString());
      }
    });
    
    readpst.on('close', async (code) => {
      if (code === 0) {
        console.log(highlight(`readpst extraction complete. Moving files to output directory...`, ANSI_GREEN));
        await convertReadpstOutput(tempDir, outputDir, attachmentDir);
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

async function convertReadpstOutput(tempDir, outputDir, attachmentDir) {
  const files = fs.readdirSync(tempDir, { withFileTypes: true });
  
  for (const file of files) {
    if (file.isFile()) {
      const sourcePath = path.join(tempDir, file.name);
      const ext = path.extname(file.name).toLowerCase();
      
      // readpst already creates the correct formats, just move files to appropriate locations
      if (ext === '.eml') {
        // Email files - move to output directory
        const destPath = path.join(outputDir, file.name);
        fs.copyFileSync(sourcePath, destPath);
        globalStats.emailsExtracted++;
        
        if (argv.verbose) {
          console.log(highlight(`Moved email: ${destPath}`, ANSI_BLUE));
        }
        
      } else if (ext === '.vcf') {
        // Contact files - move to contacts subdirectory
        const contactsDir = path.join(outputDir, 'contacts');
        ensureDirectoryExistence(contactsDir);
        const destPath = path.join(contactsDir, file.name);
        fs.copyFileSync(sourcePath, destPath);
        
        if (argv.verbose) {
          console.log(highlight(`Moved contact: ${destPath}`, ANSI_BLUE));
        }
        
      } else if (ext === '.ics') {
        // Calendar files - move to calendar subdirectory  
        const calendarDir = path.join(outputDir, 'calendar');
        ensureDirectoryExistence(calendarDir);
        const destPath = path.join(calendarDir, file.name);
        fs.copyFileSync(sourcePath, destPath);
        
        if (argv.verbose) {
          console.log(highlight(`Moved calendar item: ${destPath}`, ANSI_BLUE));
        }
        
      } else {
        // Attachments and other files - move to attachments directory
        const destPath = path.join(attachmentDir, file.name);
        fs.copyFileSync(sourcePath, destPath);
        globalStats.attachmentsExtracted++;
        
        if (argv.verbose) {
          console.log(highlight(`Moved attachment: ${destPath}`, ANSI_BLUE));
        }
      }
      
    } else if (file.isDirectory()) {
      // Recursively process subdirectories - readpst maintains folder structure
      const subDir = path.join(tempDir, file.name);
      const subOutputDir = path.join(outputDir, file.name);
      ensureDirectoryExistence(subOutputDir);
      await convertReadpstOutput(subDir, subOutputDir, attachmentDir);
    }
  }
  
  showProgress();
}

async function processPSTFile(filePath, outputDir, attachmentDir) {
  console.log(highlight(`Processing PST file: ${filePath}`, ANSI_GREEN));
  
  const fileStats = fs.statSync(filePath);
  const fileSizeGB = fileStats.size / (1024 * 1024 * 1024);
  
  // Extract filename without extension and create prefix
  const sourceFileName = path.basename(filePath, path.extname(filePath));
  const filePrefix = sourceFileName.toLowerCase().replace(/\s+/g, '');
  
  if (argv.verbose) {
    console.log(highlight(`File size: ${fileSizeGB.toFixed(2)} GB`, ANSI_YELLOW));
  }
  
  if (fileStats.size > 2 * 1024 * 1024 * 1024) {
    console.log(highlight(`Large file detected (${fileSizeGB.toFixed(2)} GB). Checking for external tools...`, ANSI_YELLOW));
    
    const hasReadpst = await checkForReadpst();
    
    if (hasReadpst) {
      try {
        await processLargePSTWithReadpst(filePath, outputDir, attachmentDir);
        return;
      } catch (error) {
        console.log(highlight(`External tool failed: ${error.message}. Attempting built-in extractor...`, ANSI_YELLOW));
      }
    } else {
      console.log(highlight(`External readpst tool not found. Attempting built-in extractor...`, ANSI_YELLOW));
      console.log(highlight(`Note: For optimal large file support, install pst-utils:`, ANSI_BLUE));
      console.log(highlight(`  Ubuntu/Debian: sudo apt-get install pst-utils`, ANSI_BLUE));
      console.log(highlight(`  macOS: brew install libpst`, ANSI_BLUE));
      console.log(highlight(`  After installation, 'readpst' command should be available`, ANSI_BLUE));
    }
  }
  
  try {
    let pstFile;
    
    if (fileStats.size <= 2 * 1024 * 1024 * 1024) {
      pstFile = new PSTFile(fs.readFileSync(filePath));
    } else {
      pstFile = new PSTFile(filePath);
    }
    
    const rootFolder = pstFile.getRootFolder();
    processPSTFolder(rootFolder, outputDir, attachmentDir, 0, filePrefix);
    
  } catch (error) {
    if (error.message.includes('File size') && error.message.includes('greater than')) {
      throw new Error(`
Unable to process large PST file (${fileSizeGB.toFixed(2)} GB).

Solutions:
1. Install libpst-dev package: 'sudo apt-get install libpst-dev' (Linux) or 'brew install libpst' (Mac)
2. Split the PST file into smaller chunks using a PST splitter tool
3. Use Microsoft's native PST tools to export to smaller files

The built-in JavaScript PST library is limited to 2GB files.
      `);
    } else {
      throw error;
    }
  }
}

function processMBOXFile(filePath, outputDir) {
  console.log(highlight(`Processing MBOX file: ${filePath}`, ANSI_GREEN));
  
  return new Promise((resolve, reject) => {
    let emailCount = 0;
    let processedEmails = 0;
    let currentEmailLines = [];
    let inEmail = false;
    
    // Extract filename without extension and create prefix
    const sourceFileName = path.basename(filePath, path.extname(filePath));
    const filePrefix = sourceFileName.toLowerCase().replace(/\s+/g, '');
    
    const processEmail = (emailLines) => {
      if (emailLines.length === 0) return;
      
      emailCount++;
      globalStats.foldersProcessed++; // Count each message as a "folder" for progress
      
      if (!argv.verbose && !argv.quiet) {
        console.log(highlight(`Processing email ${emailCount}`, ANSI_YELLOW));
      }
      
      try {
        const filename = sanitizeFilename(`${filePrefix}-${emailCount.toString().padStart(4, '0')}-email`);
        const emailFilePath = path.join(outputDir, `${filename}.${argv.format}`);
        const emailContent = emailLines.join('\n');
        
        if (argv.format === 'eml') {
          // Save the message exactly as-is to preserve MIME structure
          fs.writeFileSync(emailFilePath, emailContent);
        } else {
          // Try to extract basic headers for text format
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
        
        globalStats.emailsExtracted++;
        processedEmails++;
        
        if (argv.verbose) {
          console.log(highlight(`Saved email: ${emailFilePath}`, ANSI_BLUE));
          
          // Check if this email has MIME content for informational purposes
          const hasMimeContent = emailContent.includes('Content-Type: multipart/') || 
                                 emailContent.includes('Content-Disposition: attachment') ||
                                 emailContent.includes('Content-Transfer-Encoding: base64');
          
          if (hasMimeContent) {
            console.log(highlight(`Email ${emailCount} contains MIME content`, ANSI_BLUE));
          }
        }
        
        // Show progress every 5 emails or for verbose mode
        if (emailCount % 5 === 0 || argv.verbose) {
          showProgress();
        }
        
      } catch (error) {
        if (argv.verbose) {
          console.log(highlight(`Error processing email ${emailCount}: ${error.message}`, ANSI_YELLOW));
        }
      }
    };
    
    // Use readline for line-by-line processing
    const readline = require('readline');
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });
    
    if (argv.verbose) {
      console.log(highlight(`Starting line-by-line MBOX processing...`, ANSI_BLUE));
    }
    
    rl.on('line', (line) => {
      // MBOX format: emails are separated by lines starting with "From "
      if (line.startsWith('From ') && inEmail) {
        // Process the current email
        processEmail(currentEmailLines);
        currentEmailLines = [line];
      } else if (line.startsWith('From ') && !inEmail) {
        // Start of first email
        inEmail = true;
        currentEmailLines = [line];
      } else if (inEmail) {
        // Add line to current email
        currentEmailLines.push(line);
      }
    });
    
    rl.on('close', async () => {
      try {
        // Process the last email
        if (currentEmailLines.length > 0) {
          processEmail(currentEmailLines);
        }
        
        if (argv.verbose) {
          console.log(highlight(`MBOX processing complete. Processed ${processedEmails} emails with all content preserved.`, ANSI_GREEN));
        }
        
        resolve();
        
      } catch (error) {
        console.error(highlight(`Error in post-processing: ${error.message}`, ANSI_RED));
        reject(error);
      }
    });
    
    rl.on('error', (error) => {
      console.error(highlight(`Error processing MBOX file: ${error.message}`, ANSI_RED));
      reject(error);
    });
  });
}

async function main() {
  // Handle test-readpst flag
  if (argv.testReadpst) {
    console.log(highlight(`Testing readpst availability...`, ANSI_YELLOW));
    const hasReadpst = await checkForReadpst();
    
    if (hasReadpst) {
      console.log(highlight(`readpst command is available and working`, ANSI_GREEN));
      console.log(highlight(`Large PST/OST files will use external readpst for optimal performance`, ANSI_GREEN));
    } else {
      console.log(highlight(`readpst command not found or not working`, ANSI_RED));
      console.log(highlight(`Large PST/OST files will use built-in extractor (slower)`, ANSI_YELLOW));
      console.log(highlight(`To install readpst:`, ANSI_BLUE));
      console.log(highlight(`  Ubuntu/Debian: sudo apt-get install pst-utils`, ANSI_BLUE));
      console.log(highlight(`  macOS: brew install libpst`, ANSI_BLUE));
    }
    process.exit(0);
  }

  if (!argv.input) {
    console.error(highlight(`Error: Input file or pattern is required. Use --help for usage information.`, ANSI_RED));
    process.exit(1);
  }
  
  ensureDirectoryExistence(argv.output);
  ensureDirectoryExistence(argv.attachments);
  
  try {
    // Resolve input files (handles both single files and glob patterns)
    const inputFiles = resolveInputFiles(argv.input);
    
    console.log(highlight(`Found ${inputFiles.length} file(s) to process:`, ANSI_YELLOW));
    inputFiles.forEach((file, index) => {
      console.log(highlight(`  ${index + 1}. ${file}`, ANSI_BLUE));
    });
    
    if (!argv.quiet) {
      console.log(highlight(`Starting extraction... Progress updates every 5 seconds`, ANSI_BLUE));
    }
    
    resetGlobalStats();
    
    // Process each file
    for (let i = 0; i < inputFiles.length; i++) {
      const filePath = inputFiles[i];
      const fileNumber = i + 1;
      
      console.log(highlight(`\n=== Processing file ${fileNumber}/${inputFiles.length}: ${path.basename(filePath)} ===`, ANSI_GREEN));
      
      const fileType = detectFileType(filePath);
      console.log(highlight(`Detected file type: ${fileType.toUpperCase()}`, ANSI_YELLOW));
      
      // Create subdirectory for each file to avoid conflicts
      const fileBaseName = path.basename(filePath, path.extname(filePath));
      const fileOutputDir = inputFiles.length > 1 ? path.join(argv.output, fileBaseName) : argv.output;
      const fileAttachmentDir = inputFiles.length > 1 ? path.join(argv.attachments, fileBaseName) : argv.attachments;
      
      ensureDirectoryExistence(fileOutputDir);
      ensureDirectoryExistence(fileAttachmentDir);
      
      switch (fileType) {
        case 'pst':
        case 'ost':
          await processPSTFile(filePath, fileOutputDir, fileAttachmentDir);
          break;
        case 'mbox':
          await processMBOXFile(filePath, fileOutputDir);
          break;
        default:
          throw new Error(`Unsupported file type: ${fileType}`);
      }
    }
    
    // Clear heartbeat timer and show final progress
    if (globalStats.heartbeatTimer) {
      clearInterval(globalStats.heartbeatTimer);
    }
    showProgress(true);
    
    const totalTime = Math.floor((Date.now() - globalStats.startTime) / 1000);
    const minutes = Math.floor(totalTime / 60);
    const seconds = totalTime % 60;
    
    console.log(highlight(`\n=== ALL EXTRACTIONS COMPLETE ===`, ANSI_GREEN));
    console.log(highlight(`Processed ${inputFiles.length} file(s)`, ANSI_GREEN));
    console.log(highlight(`Total time: ${minutes}m ${seconds}s`, ANSI_GREEN));
    console.log(highlight(`Final stats: ${globalStats.foldersProcessed} folders processed`, ANSI_GREEN));
    console.log(highlight(`${globalStats.emailsExtracted} emails extracted to: ${argv.output}`, ANSI_GREEN));
    console.log(highlight(`${globalStats.attachmentsExtracted} attachments saved to: ${argv.attachments}`, ANSI_GREEN));
    
  } catch (error) {
    console.error(highlight(`Error: ${error.message}`, ANSI_RED));
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  detectFileType,
  processPSTFile,
  processMBOXFile,
  main
};