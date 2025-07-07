# VaultMail

A Node.js library and CLI tool for extracting emails and attachments from multiple email archive formats including PST, OST, MBOX, and OLM files. Supports large files (40GB+) and exports emails in standardized EML format.

## Features

- **Multi-format Support**: PST, OST, MBOX, and OLM email archives
- **Library & CLI**: Use as a Node.js library or command-line tool
- **Large File Handling**: Processes files over 40GB with hybrid approach
- **EML Export**: Standardized email format output with original formatting preserved
- **Attachment Extraction**: Saves all attachments with organized naming (PST/OST)
- **Comprehensive Data Types**: Emails, contacts, appointments, tasks, and notes (OLM)
- **Recursive Processing**: Maintains original folder structure from archives
- **Robust Error Handling**: Continues processing even with corrupted emails
- **NPM Package**: Easy installation and integration into your projects
- **Extensive Testing**: Comprehensive test suite for reliability

## Installation

### NPM Installation (Recommended)

```bash
# Global installation for CLI usage
npm install -g vaultmail

# Local installation for library usage
npm install vaultmail
```

### Development Installation

```bash
git clone https://github.com/Mikej81/vaultmail.git
cd vaultmail
npm install
```

### Optional: Install External Tools for Large Files (>2GB)

**The tool works without external tools**, but for PST/OST files larger than 2GB, installing pst-utils provides enhanced processing and better performance:

**Linux (Ubuntu/Debian):**

```bash
sudo apt-get update
sudo apt-get install pst-utils
```

**macOS:**

```bash
brew install libpst
```

**Windows:**
Download libpst from [https://www.five-ten-sg.com/libpst/](https://www.five-ten-sg.com/libpst/)

## Usage

### CLI Usage

```bash
# If installed globally
vaultmail -i <input-file> -o <output-directory> -a <attachments-directory>

# If installed locally
npx vaultmail -i <input-file> -o <output-directory> -a <attachments-directory>
```

### Library Usage

```javascript
const { EmailExtractor } = require('vaultmail');

const extractor = new EmailExtractor({
  verbose: true,
  format: 'eml'
});

// Extract PST/OST files
await extractor.extract('./archive.pst', './output', './attachments');

// Extract MBOX files
await extractor.extract('./mailbox.mbox', './output');

// Extract OLM files (Outlook for Mac)
await extractor.extract('./archive.olm', './output');
```

### Examples

**Extract PST file:**

```bash
vaultmail -i archive.pst -o ./emails -a ./attachments
```

**Extract large OST file with verbose output:**

```bash
vaultmail -i large_archive.ost -o ./emails -a ./attachments --verbose
```

**Extract MBOX file in text format:**

```bash
vaultmail -i mailbox.mbox -f txt --verbose
```

**Extract OLM file (Outlook for Mac):**

```bash
vaultmail -i archive.olm -o ./emails
```

**Process with depth limit:**

```bash
vaultmail -i archive.pst -o ./emails -a ./attachments --max-depth 3
```

**Include empty folders (disabled by default):**

```bash
vaultmail -i archive.ost -o ./emails -a ./attachments --skip-empty false
```

**Quiet mode for minimal output:**

```bash
vaultmail -i archive.ost -o ./emails -a ./attachments --quiet
```

### Command Line Options

| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| `--input` | `-i` | Input email archive file (PST, OST, MBOX, OLM) | **Required** |
| `--output` | `-o` | Output directory for extracted emails | `./output` |
| `--attachments` | `-a` | Directory for extracted attachments | `./attachments` |
| `--recursive` | `-r` | Process folders recursively | `true` |
| `--format` | `-f` | Output format: `eml` or `txt` | `eml` |
| `--verbose` | `-v` | Enable verbose logging | `false` |
| `--max-depth` | `-d` | Maximum folder depth (-1 for unlimited) | `-1` |
| `--skip-empty` | `-s` | Skip creating folders that contain no emails | `true` |
| `--quiet` | `-q` | Suppress progress updates (less output) | `false` |
| `--help` | `-h` | Show help information | |

## File Format Support

### PST Files

- Microsoft Outlook Personal Storage Table files
- Maintains folder hierarchy and metadata
- Extracts embedded attachments
- Supports files up to 40GB+ with external tools

### OST Files  

- Microsoft Outlook Offline Storage Table files
- Same capabilities as PST files
- Handles Exchange server synchronized data

### MBOX Files

- Unix mailbox format
- Processes files of any size efficiently with line-by-line streaming
- Extracts individual emails while preserving original MIME structure
- Attachments and images remain embedded in EML files for perfect mail client compatibility
- Supports Gmail exports and other MBOX sources
- Handles problematic headers gracefully

### OLM Files

- Microsoft Outlook for Mac archive format
- Comprehensive extraction of emails, contacts, appointments, tasks, and notes
- Automatic folder organization of extracted data
- Support for multi-disk OLM archives
- Conversion to standard formats (EML, VCF, ICS, TXT)

## Output Structure

The tool creates organized output with preserved folder structures and specialized formats for different content types:

### PST/OST Output Structure

```
emails/
├── archive_name/
│   ├── Inbox/
│   │   ├── 1-email-subject.eml
│   │   ├── 2-another-email.eml
│   │   ├── contacts/
│   │   │   ├── contact1.vcf
│   │   │   └── contact2.vcf
│   │   └── calendar/
│   │       ├── meeting1.ics
│   │       └── appointment1.ics
│   ├── Sent Items/
│   └── Deleted Items/
└── ...

attachments/
├── 1-document.pdf
├── 2-image.jpg
└── ...
```

### MBOX Output Structure

```
emails/
├── 0001-email.eml
├── 0002-email.eml  
├── 0003-email.eml
└── ...
```

*Note: MBOX emails preserve all attachments and images embedded within each EML file*

### OLM Output Structure

```
emails/
├── emails/
│   ├── email-1.eml
│   ├── email-2.eml
│   └── ...
├── contacts/
│   ├── contact-1.vcf
│   ├── contact-2.vcf
│   └── ...
├── appointments/
│   ├── meeting-1.ics
│   ├── appointment-1.ics
│   └── ...
├── tasks/
│   ├── task-1.txt
│   └── ...
└── notes/
    ├── note-1.txt
    └── ...
```

**File Formats:**

- **Emails**: `.eml` format (RFC822 standard)
- **Contacts**: `.vcf` format (VCard 3.0 standard) - *PST/OST/OLM*
- **Calendar/Tasks**: `.ics` format (iCalendar standard) - *PST/OST/OLM*
- **Tasks**: `.txt` format - *OLM*
- **Notes**: `.txt` format - *OLM*
- **Attachments**:
  - PST/OST: Extracted as separate files in attachments directory
  - MBOX: Preserved embedded within each EML file
  - OLM: Integrated within email content

## Large File Handling

The tool automatically detects file sizes and uses appropriate processing methods:

- **Files ≤ 2GB**: Uses built-in JavaScript PST extractor for fast processing
- **Files > 2GB**: Automatically switches to external `readpst` tool if available
- **Fallback**: Uses built-in extractor if external tools are missing (works but may be slower for very large files)

**Enhanced readpst Integration:**
When using the external `readpst` tool for large files, the tool is configured with optimized settings:

- **EML format**: `-e` flag ensures proper email format with extensions
- **VCard contacts**: `-cv` flag exports contacts in VCard format
- **All content types**: `-t eajc` extracts emails, attachments, journals, and contacts
- **UTF-8 encoding**: `-8` flag ensures proper character encoding
- **Includes deleted items**: `-D` flag for comprehensive extraction

## Progress Monitoring

The tool provides real-time feedback during extraction:

- **Live progress updates**: Shows folder count, emails extracted, and elapsed time every 5 seconds
- **Folder-by-folder status**: Displays current folder being processed  
- **Heartbeat monitoring**: Shows "Still working..." message if no updates for 15+ seconds
- **Final summary**: Complete statistics when extraction finishes
- **Quiet mode**: Use `--quiet` to suppress progress updates for minimal output

Example progress output:

```
Processing: Inbox
Progress: 25 folders, 150 emails, 45 attachments | 2m 30s elapsed
Processing: Sent Items
Still working... 5m 15s elapsed
```

## Error Handling

The tool is designed to be robust:

- Continues processing if individual emails are corrupted
- Saves problematic emails in raw format when parsing fails
- Handles Node.js memory limits for very large messages
- Provides detailed error messages and recovery suggestions

## Troubleshooting

### Large File Errors

If you get errors with files over 2GB:

1. **Install pst-utils** if not available (see installation instructions above)  
2. For very large files, ensure sufficient disk space for temporary files

### Memory Issues

For extremely large archives:

- Use the `--max-depth` option to limit processing depth
- Process in smaller chunks if needed
- Monitor system memory usage during processing

### MBOX Processing

- **Individual email extraction**: Each email is saved as a separate numbered EML file (0001-email.eml, 0002-email.eml, etc.)
- **MIME structure preservation**: Original email structure is maintained for perfect mail client compatibility
- **Embedded attachments**: All attachments and images remain within each EML file (no separate extraction)
- **Large file support**: Uses line-by-line streaming to handle MBOX files of any size
- **Memory efficient**: No file size limits due to streaming approach
- **Malformed header handling**: Automatically handles problematic headers gracefully
- Check verbose output for detailed processing information

### OLM Processing

- **Comprehensive extraction**: Extracts emails, contacts, appointments, tasks, and notes
- **Automatic organization**: Content is automatically organized into appropriate subdirectories
- **Standard formats**: Outputs in widely supported formats (EML, VCF, ICS, TXT)
- **Multi-disk support**: Handles OLM archives that span multiple disks
- **Error handling**: Continues processing even if individual items are corrupted

## API Reference

### EmailExtractor Class

```javascript
const { EmailExtractor } = require('vaultmail');

const extractor = new EmailExtractor(options);
```

#### Options

- `verbose` (boolean): Enable verbose logging (default: false)
- `format` (string): Output format - 'eml' or 'txt' (default: 'eml')
- `maxDepth` (number): Maximum folder depth to process (default: -1, unlimited)
- `skipEmpty` (boolean): Skip empty folders (default: true)

#### Methods

##### `extract(filePath, outputDir, attachmentDir, options)`

Extract emails from any supported format.

- `filePath` (string): Path to the email archive file
- `outputDir` (string): Directory for extracted emails
- `attachmentDir` (string): Directory for attachments (required for PST/OST)
- `options` (object): Override default options for this extraction

Returns: Promise resolving to extraction statistics

##### `detectFileType(filePath)`

Detect the file type of an email archive.

- `filePath` (string): Path to the file

Returns: String ('pst', 'ost', 'mbox', or 'olm')

### Individual Extractors

```javascript
const { PSTExtractor, MboxExtractor, OLMExtractor } = require('vaultmail');

// Use specific extractors directly
const pstExtractor = new PSTExtractor(options);
const mboxExtractor = new MboxExtractor(options);
const olmExtractor = new OLMExtractor(options);
```

## Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Contributing

I welcome contributions to VaultMail! Whether you're fixing bugs, adding features, or improving documentation, your help makes the project better for everyone.

### Development Setup

1. **Fork and Clone**

   ```bash
   git clone https://github.com/your-username/vaultmail.git
   cd vaultmail
   npm install
   ```

2. **Run Tests**

   ```bash
   npm test              # Run all tests
   npm run test:watch    # Run tests in watch mode
   npm run test:coverage # Generate coverage report
   ```

3. **Code Quality**

   ```bash
   npm run lint          # Check code style
   npm run lint:fix      # Auto-fix style issues
   npm run validate      # Run both linting and tests
   ```

### Contribution Guidelines

- **Code Style**: Follow the existing ESLint configuration
- **Testing**: Add tests for new features and bug fixes
- **Documentation**: Update README and JSDoc comments for public APIs
- **Commits**: Use clear, descriptive commit messages
- **Pull Requests**: Include a description of changes and link any related issues

### Areas for Contribution

- **Performance**: Optimize extraction for very large files
- **Formats**: Add support for additional email archive formats
- **Features**: Enhance filtering, search, and export capabilities
- **Documentation**: Improve examples and troubleshooting guides
- **Testing**: Increase test coverage and add integration tests

### Reporting Issues

When reporting bugs, please include:

- Operating system and Node.js version
- VaultMail version
- Input file format and approximate size
- Complete error message and stack trace
- Steps to reproduce the issue

## License

Apache-2.0 License - see LICENSE file for details

## Support

For issues and feature requests, please use the [GitHub Issues](https://github.com/Mikej81/email-extractor/issues) page.
