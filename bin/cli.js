#!/usr/bin/env node

/**
 * VaultMail CLI - Command-line interface for email archive extraction
 * 
 * Supports PST, OST, MBOX, and OLM file formats with comprehensive
 * extraction capabilities including emails, attachments, and metadata.
 */

const fs = require('fs');
const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const glob = require('glob');
const { EmailExtractor } = require('../lib/index');

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
  if (argv.quiet && !force) {return;}
  
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
    description: 'Input email archive file or glob pattern (PST, OST, MBOX, OLM)',
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
  .help()
  .alias('help', 'h')
  .example('$0 -i archive.pst -o ./emails -a ./attachments', 'Extract PST file to separate directories')
  .example('$0 -i mailbox.mbox -f eml --verbose', 'Extract MBOX file with verbose logging')
  .example('$0 -i archive.olm -o ./emails', 'Extract OLM file from Outlook for Mac')
  .example('$0 -i "*.mbox" -o ./emails', 'Extract all MBOX files in current directory')
  .example('$0 -i "/path/to/archives/*.pst" -o ./emails', 'Extract all PST files from specific path')
  .epilog(`
Supported formats: PST, OST, MBOX, OLM
For large PST files (>2GB), install external tools:
  Linux: sudo apt-get install pst-utils
  macOS: brew install libpst
  Windows: Download libpst from https://www.five-ten-sg.com/libpst/
  `)
  .argv;

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
      return ['.pst', '.ost', '.mbox', '.olm'].includes(ext);
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

async function main() {
  if (!argv.input) {
    console.error(highlight('Error: Input file or pattern is required. Use --help for usage information.', ANSI_RED));
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
      console.log(highlight('Starting extraction... Progress updates every 5 seconds', ANSI_BLUE));
    }
    
    resetGlobalStats();
    
    const extractor = new EmailExtractor({
      verbose: argv.verbose,
      format: argv.format,
      maxDepth: argv.maxDepth,
      skipEmpty: argv.skipEmpty
    });
    
    // Process each file
    for (let i = 0; i < inputFiles.length; i++) {
      const filePath = inputFiles[i];
      const fileNumber = i + 1;
      
      console.log(highlight(`\n=== Processing file ${fileNumber}/${inputFiles.length}: ${path.basename(filePath)} ===`, ANSI_GREEN));
      
      const fileType = extractor.detectFileType(filePath);
      console.log(highlight(`Detected file type: ${fileType.toUpperCase()}`, ANSI_YELLOW));
      
      // Create subdirectory for each file to avoid conflicts
      const fileBaseName = path.basename(filePath, path.extname(filePath));
      const fileOutputDir = inputFiles.length > 1 ? path.join(argv.output, fileBaseName) : argv.output;
      const fileAttachmentDir = inputFiles.length > 1 ? path.join(argv.attachments, fileBaseName) : argv.attachments;
      
      ensureDirectoryExistence(fileOutputDir);
      ensureDirectoryExistence(fileAttachmentDir);
      
      let stats;
      if (fileType === 'pst' || fileType === 'ost') {
        stats = await extractor.extract(filePath, fileOutputDir, fileAttachmentDir);
      } else {
        stats = await extractor.extract(filePath, fileOutputDir);
      }
      
      // Update global stats
      globalStats.emailsExtracted += stats.emailsExtracted || 0;
      globalStats.attachmentsExtracted += stats.attachmentsExtracted || 0;
      globalStats.foldersProcessed += stats.foldersProcessed || 0;
    }
    
    // Clear heartbeat timer and show final progress
    if (globalStats.heartbeatTimer) {
      clearInterval(globalStats.heartbeatTimer);
    }
    showProgress(true);
    
    const totalTime = Math.floor((Date.now() - globalStats.startTime) / 1000);
    const minutes = Math.floor(totalTime / 60);
    const seconds = totalTime % 60;
    
    console.log(highlight('\n=== ALL EXTRACTIONS COMPLETE ===', ANSI_GREEN));
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

module.exports = { main };
