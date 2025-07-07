# Changelog

All notable changes to VaultMail will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2025-07-07

### Added
- **Multi-format Support**: Complete rewrite supporting PST, OST, MBOX, and OLM email archives
- **OLM Integration**: Added support for Outlook for Mac archives with comprehensive data extraction
- **Professional Library Structure**: Modular architecture with separate extractors for each format
- **CLI Tool**: Comprehensive command-line interface with extensive options
- **Large File Handling**: Automatic detection and optimal processing for files over 2GB
- **Comprehensive Testing**: Full test suite with 63+ tests covering all functionality
- **JSDoc Documentation**: Complete API documentation for all public methods
- **Progress Monitoring**: Real-time progress updates and heartbeat monitoring
- **Error Handling**: Robust error handling with graceful degradation
- **NPM Package**: Professional packaging for easy installation and integration

### Technical Improvements
- **ESLint Integration**: Professional code linting and style enforcement
- **Jest Testing**: Comprehensive testing framework with coverage reporting
- **Modular Design**: Separate extractor classes for maintainability
- **Type Documentation**: Complete parameter and return type documentation
- **Cross-platform Support**: Works on Windows, macOS, and Linux

### Formats Supported
- **PST**: Microsoft Outlook Personal Storage Table files
- **OST**: Microsoft Outlook Offline Storage Table files 
- **MBOX**: Unix mailbox format with streaming support
- **OLM**: Microsoft Outlook for Mac archives

### Breaking Changes
- Complete API redesign for better usability and maintainability
- New command-line interface with different option names
- Restructured output formats and directory organization

## [1.0.0] - Previous Version

### Initial Implementation
- Basic PST and MBOX extraction functionality
- Command-line interface
- Simple email extraction
