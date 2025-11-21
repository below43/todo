# Kanban Board PWA

A modern, responsive Kanban board Progressive Web App (PWA) built with vanilla JavaScript and IndexedDB for persistent storage.

## 🌐 Live Demo

**Try it now:** [https://below43.github.io/todo/](https://below43.github.io/todo/)

The app is automatically deployed to GitHub Pages from this branch.

## Features

### Core Functionality
- 📋 **Column Management**: Create, rename (double-click), and delete columns
- 🎴 **Card Management**: Create cards with title and optional link
- ✏️ **Quick Edit**: Double-click cards to edit content
- 🗑️ **Deletion**: Remove individual cards or entire columns
- 💾 **Persistence**: All data automatically saved to IndexedDB
- 🎯 **Drag & Drop**: Move cards between columns visually

### PWA Features
- 📱 **Installable**: Add to home screen on any device
- 🔌 **Offline Support**: Works without internet connection
- ⚡ **Fast Loading**: Service worker caching for instant load times
- 🎨 **Responsive**: Adapts to any screen size

## Getting Started

### Running Locally

1. Clone the repository:
```bash
git clone https://github.com/below43/todo.git
cd todo
```

2. Start a local web server:
```bash
python3 -m http.server 8000
```

3. Open your browser and navigate to:
```
http://localhost:8000
```

### Installing as PWA

1. Open the application in a modern browser (Chrome, Edge, Safari)
2. Look for the install prompt or "Install App" button in the address bar
3. Click to install the app to your device
4. The app will work offline after installation

## Usage

### Creating Columns
- Click the "+ Add Column" button in the header
- Enter a name for your column
- Click "Save"

### Creating Cards
- Click "+ Add Card" in any column
- Enter a card title (required)
- Optionally add a link (e.g., to documentation or tickets)
- Click "Save"

### Editing
- **Double-click** on any card to edit its content
- **Double-click** on a column title to rename it

### Deleting
- Click the 🗑️ icon on any card or column to delete it
- Deleting a column removes all its cards

### Moving Cards
- **Drag and drop** cards between columns to reorganize your workflow

## Technical Details

### Technologies Used
- **HTML5**: Semantic markup and drag-and-drop API
- **CSS3**: Modern styling with Flexbox and Grid
- **Vanilla JavaScript**: No frameworks or dependencies
- **IndexedDB**: Client-side database for data persistence
- **Service Worker**: Offline functionality and caching
- **PWA Manifest**: Installation and standalone mode

### Browser Support
- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support (iOS 11.3+)

### Data Storage
All data is stored locally in your browser using IndexedDB. Your data:
- Never leaves your device
- Persists across sessions
- Is private and secure
- Can be cleared by clearing browser data

## Development

### File Structure
```
todo/
├── index.html          # Main HTML file
├── styles.css          # Application styles
├── app.js              # Main application logic
├── db.js               # IndexedDB wrapper
├── service-worker.js   # PWA service worker with auto-versioning
├── manifest.json       # PWA manifest
├── update-version.js   # Build script to update SW cache version
├── logo.png            # App logo (512x512)
└── favicon.ico         # Favicon (32x32)
```

### Automatic Updates
The PWA automatically checks for updates and uses cache versioning to ensure users get the latest version:

- **Service Worker Versioning**: Cache version is automatically updated with each deployment using a timestamp
- **Update Detection**: Checks for updates every 60 seconds when the app is open
- **Auto-Reload**: Prompts users to reload when a new version is available
- **Cache Management**: Old caches are automatically cleaned up when new versions activate

To manually update the service worker version before deploying:
```bash
node update-version.js
```

This is automatically done during GitHub Pages deployment.

### Security
- ✅ XSS protection via HTML escaping
- ✅ No external dependencies
- ✅ Client-side only - no server required
- ✅ Passed security scans with no vulnerabilities

## License

MIT License - see LICENSE file for details

## Contributing

Contributions are welcome! Feel free to submit issues or pull requests.

