# Browser-Surff Mode

Web automation and browser control with Ryft.

## Overview

Browser-Surff Mode enables Ryft to control a web browser and automate web tasks.

**Capabilities:**
- Navigate to URLs
- Execute JavaScript
- Take screenshots
- Extract page data
- Fill forms and interact
- Manage browser sessions
- Access DevTools

## Skills

### navigate

Browse and explore websites.

```bash
ryft> Navigate to example.com
```

### extract

Extract data from web pages.

```bash
ryft> Get all links from this page
```

### interact

Click buttons, fill forms, etc.

```bash
ryft> Fill this form and submit
```

### screenshot

Capture page content.

```bash
ryft> Take a screenshot
```

## Usage

```bash
# Activate browser mode
/mode browser-surff

# Browser starts on first use
ryft> Navigate to example.com

# First action spawns Chrome
# Streams browser output
```

## Technical Details

- **Port:** 9222 (Chrome DevTools)
- **Session:** Persists between commands
- **Screenshot:** 1920x1080 default
- **Timeout:** 30 seconds per operation

## Troubleshooting

If Chrome won't start:

```bash
# Check Chrome is installed
open -a "Google Chrome" --version

# Set custom path if needed
export CHROME_BIN=/path/to/chrome
```

## See Also

- [Modes Documentation](./README.md)
- [Troubleshooting](../troubleshooting/README.md)
