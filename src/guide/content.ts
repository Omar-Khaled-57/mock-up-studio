export type DocBlock =
  | { type: 'heading'; text: string; level: 1 | 2 | 3 }
  | { type: 'paragraph'; text: string }
  | { type: 'code'; code: string; language?: string }
  | { type: 'shortcuts'; items: { keys: string[]; desc: string }[] }
  | { type: 'tip'; text: string }
  | { type: 'warning'; text: string }
  | { type: 'note'; text: string }
  | { type: 'bullets'; items: string[] }
  | { type: 'steps'; items: string[] }
  | { type: 'image'; src: string; alt: string; caption?: string }
  | { type: 'link'; text: string; page: string }

export interface DocPage {
  id: string
  title: string
  content: DocBlock[]
}

export interface DocSection {
  id: string
  title: string
  icon: string
  pages: DocPage[]
}

const DOCS: DocSection[] = [
  {
    id: 'introduction',
    title: 'Introduction',
    icon: '📖',
    pages: [
      {
        id: 'welcome',
        title: 'Welcome to Mockup Studio',
        content: [
          { type: 'heading', text: 'Welcome to Mockup Studio', level: 1 },
          { type: 'paragraph', text: 'Mockup Studio is a desktop application for creating device mockup scenes. It allows you to compose devices, text, images, and shapes on a canvas and export the result as high-quality images.' },
          { type: 'paragraph', text: 'Whether you are a designer presenting app screenshots, a marketer creating social media visuals, or a developer documenting UI flows, Mockup Studio provides a fast, offline-friendly workspace.' },
          { type: 'heading', text: 'Key Features', level: 2 },
          { type: 'bullets', items: [
            'Rich canvas with grid, guides, and snap-to-grid',
            'Device frames: phones, tablets, laptops, monitors, watches, browsers, terminals, TVs',
            'Text boxes with full typography controls',
            'Image overlays with crop, blur, shadow, glow',
            'SVG shapes with 16+ kinds and background images',
            'Gradient, solid, image, and animated preset backgrounds',
            'Layer management with drag-to-reorder and grouping',
            'Multi-scene projects with version snapshots',
            'Export to PNG, JPEG, WebP at up to 4x resolution',
            'Dark and light UI themes'
          ] },
          { type: 'heading', text: 'System Requirements', level: 2 },
          { type: 'bullets', items: [
            'Windows 10+, macOS 11+, or Linux (x86_64)',
            '4 GB RAM (8 GB recommended)',
            '100 MB free disk space'
          ] }
        ]
      }
    ]
  },
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: '🚀',
    pages: [
      {
        id: 'creating-project',
        title: 'Creating a Project',
        content: [
          { type: 'heading', text: 'Creating a New Project', level: 1 },
          { type: 'steps', items: [
            'Press Ctrl+N (Cmd+N on Mac) or go to File → New Project',
            'Choose a canvas size from the presets or add a custom one',
            'Start adding devices, text, and images to your canvas'
          ] },
          { type: 'tip', text: 'You can change the canvas size at any time from the Canvas panel in the sidebar.' }
        ]
      },
      {
        id: 'saving',
        title: 'Saving & Opening Projects',
        content: [
          { type: 'heading', text: 'Saving Projects', level: 1 },
          { type: 'paragraph', text: 'Projects are saved as .mockup files — a ZIP archive containing a manifest and all embedded assets.' },
          { type: 'shortcuts', items: [
            { keys: ['Ctrl', 'S'], desc: 'Save current project' },
            { keys: ['Ctrl', 'Shift', 'S'], desc: 'Save As (choose a new file)' },
            { keys: ['Ctrl', 'O'], desc: 'Open a project' },
            { keys: ['Ctrl', 'N'], desc: 'New project' }
          ] },
          { type: 'heading', text: 'Opening Projects', level: 2 },
          { type: 'steps', items: [
            'Press Ctrl+O or go to File → Open',
            'Select a .mockup file',
            'The project opens with all scenes, devices, and assets restored'
          ] },
          { type: 'note', text: 'Mockup files are self-contained. You can share them with other Mockup Studio users, and all embedded images will travel with the file.' }
        ]
      },
      {
        id: 'exporting',
        title: 'Exporting',
        content: [
          { type: 'heading', text: 'Exporting Scenes', level: 1 },
          { type: 'paragraph', text: 'Mockup Studio can export scenes as PNG, JPEG, or WebP images at up to 4x resolution.' },
          { type: 'heading', text: 'Export Options', level: 2 },
          { type: 'bullets', items: [
            'Format: PNG (lossless, supports transparency), JPEG (smaller files), WebP (modern format)',
            'Scale: 1×, 2×, 3×, or 4× the canvas size',
            'Background: Scene background, solid color, or transparent (PNG only)',
            'Quality: Adjustable for JPEG and WebP (10-100%)'
          ] },
          { type: 'heading', text: 'Export All Scenes', level: 2 },
          { type: 'paragraph', text: 'When your project has multiple scenes, you can export all of them at once. The scenes are saved as individual files or bundled into a ZIP archive.' },
          { type: 'heading', text: 'Watermark', level: 2 },
          { type: 'paragraph', text: 'You can add a configurable watermark to exports. Set the text, font size, opacity, and position (top-left, top-right, bottom-left, bottom-right, or center).' },
          { type: 'steps', items: [
            'Open the Export panel from the sidebar',
            'Choose format, scale, background, and quality',
            'Click Preview to see the result, then Save to export',
            'Or click Copy to copy to clipboard'
          ] }
        ]
      }
    ]
  },
  {
    id: 'workspace',
    title: 'Workspace Overview',
    icon: '🖼️',
    pages: [
      {
        id: 'canvas',
        title: 'Canvas',
        content: [
          { type: 'heading', text: 'Canvas', level: 1 },
          { type: 'paragraph', text: 'The canvas is your main workspace. It displays at the dimensions you set in the Canvas panel. You can pan, zoom, and interact with all elements placed on it.' },
          { type: 'heading', text: 'Pan & Zoom', level: 2 },
          { type: 'shortcuts', items: [
            { keys: ['Ctrl', '+'], desc: 'Zoom in' },
            { keys: ['Ctrl', '-'], desc: 'Zoom out' },
            { keys: ['Ctrl', '0'], desc: 'Reset zoom to 100%' },
            { keys: ['Alt', 'drag'], desc: 'Pan the canvas' },
            { keys: ['Middle mouse', 'drag'], desc: 'Pan the canvas' },
            { keys: ['Ctrl', 'scroll'], desc: 'Zoom in/out' },
            { keys: ['Scroll'], desc: 'Pan vertically/horizontally' }
          ] },
          { type: 'heading', text: 'Grid & Guides', level: 2 },
          { type: 'paragraph', text: 'The grid helps align elements visually. You can toggle it on/off, change the grid size, color, and style (dotted or lines). Snap-to-grid makes elements stick to grid intersections.' },
          { type: 'paragraph', text: 'Guides are pink alignment lines you can add from the Guides panel or by dragging from the rulers. They are interactive — drag to reposition, right-click to delete.' },
          { type: 'note', text: 'Rulers can be toggled on/off from the Grid panel. When enabled, they show at the top and left edges of the viewport.' }
        ]
      },
      {
        id: 'sidebar',
        title: 'Sidebar Panels',
        content: [
          { type: 'heading', text: 'Sidebar Panels', level: 1 },
          { type: 'paragraph', text: 'The sidebar on the left contains all the tools for building your scene. Each tab provides different functionality.' },
          { type: 'bullets', items: [
            'Devices — Add and manage device frames',
            'Text — Add and style text boxes',
            'Shapes — Add SVG shapes (16+ kinds)',
            'Images — Upload and manage image overlays',
            'Themes — Configure canvas background',
            'Theme Presets — Apply color theme presets',
            'Canvas — Set canvas size and aspect ratio',
            'Grid — Configure grid, guides, and rulers',
            'Layers — Reorder, group, and manage elements',
            'Export — Export scenes as images',
            'History — Version snapshots'
          ] }
        ]
      }
    ]
  },
  {
    id: 'tools',
    title: 'Tools & Elements',
    icon: '🔧',
    pages: [
      {
        id: 'devices',
        title: 'Devices',
        content: [
          { type: 'heading', text: 'Devices', level: 1 },
          { type: 'paragraph', text: 'Device frames create realistic mockups. Each device has a bezel frame, screen area, and configurable properties.' },
          { type: 'heading', text: 'Available Devices', level: 2 },
          { type: 'bullets', items: [
            'Cell Phone — Smartphone frame with screen',
            'Laptop — Notebook with keyboard base and screen',
            'Tablet — Large tablet frame',
            'Monitor — Desktop monitor with stand',
            'Watch — Smartwatch frame',
            'Browser — Browser window frame',
            'Terminal — Terminal/console frame',
            'TV — Television frame'
          ] },
          { type: 'heading', text: 'Screen Content', level: 2 },
          { type: 'paragraph', text: 'Double-click a devices screen area to upload an image. The image can be fitted using three modes: Contain (fits inside), Cover (fills the screen), or Stretch (fills the screen, may distort).' },
          { type: 'heading', text: 'Properties', level: 2 },
          { type: 'bullets', items: [
            'Position (X, Y) and size (Width, Height)',
            'Rotation angle',
            'Screen image and object-fit mode',
            'Border radius',
            'Visibility toggle and lock toggle'
          ] }
        ]
      },
      {
        id: 'text',
        title: 'Text',
        content: [
          { type: 'heading', text: 'Text Boxes', level: 1 },
          { type: 'paragraph', text: 'Text boxes let you add and style text on your canvas. Double-click a text box to edit its content inline.' },
          { type: 'heading', text: 'Typography Controls', level: 2 },
          { type: 'bullets', items: [
            'Font family selection',
            'Font size, weight, and style',
            'Text alignment (left, center, right)',
            'Line height and letter spacing',
            'Word spacing',
            'Text color and opacity',
            'Text transform (uppercase, lowercase, capitalize)',
            'Text stroke (outline) color and width',
            'Background color and padding'
          ] },
          { type: 'heading', text: 'Double-click to Edit', level: 2 },
          { type: 'paragraph', text: 'When in edit mode, the text box shows a cursor and you can type directly. Click outside or press Escape to exit edit mode.' },
          { type: 'tip', text: 'Use the Text panel in the sidebar to add new text boxes and manage existing ones (duplicate, delete, toggle visibility).' }
        ]
      },
      {
        id: 'shapes',
        title: 'Shapes',
        content: [
          { type: 'heading', text: 'Shapes', level: 1 },
          { type: 'paragraph', text: 'Shapes are SVG-based vector graphics that can be added to your scene. They render as crisp, scalable elements.' },
          { type: 'heading', text: 'Available Shapes', level: 2 },
          { type: 'bullets', items: [
            'Rectangle, Circle, Triangle, Star',
            'Hexagon, Diamond, Parallelogram, Trapezoid',
            'Cross, Plus, Heart, Shield',
            'Arrow Right, Line, Arrow Up/Down/Left/Right'
          ] },
          { type: 'heading', text: 'Properties', level: 2 },
          { type: 'bullets', items: [
            'Fill color and opacity',
            'Stroke (outline) color and width',
            'Position, size, and rotation',
            'Shadow and glow effects',
            'Background image inside the shape'
          ] }
        ]
      },
      {
        id: 'images',
        title: 'Images',
        content: [
          { type: 'heading', text: 'Image Overlays', level: 1 },
          { type: 'paragraph', text: 'Image overlays are images placed on the canvas. They can be styled with effects like blur, glow, and shadow.' },
          { type: 'heading', text: 'Features', level: 2 },
          { type: 'bullets', items: [
            'Upload from your computer',
            'Adjust opacity',
            'Border radius for rounded corners',
            'Flip horizontally or vertically',
            'Blend modes (normal, multiply, screen, overlay, etc.)',
            'Blur, glow, and shadow effects'
          ] },
          { type: 'tip', text: 'Use the Images panel in the sidebar to upload, duplicate, toggle visibility, lock, or delete image overlays.' }
        ]
      }
    ]
  },
  {
    id: 'layers',
    title: 'Layers & Selection',
    icon: '📑',
    pages: [
      {
        id: 'layer-management',
        title: 'Layer Management',
        content: [
          { type: 'heading', text: 'Layer Panel', level: 1 },
          { type: 'paragraph', text: 'The Layers panel shows all elements in the current scene. Elements are listed from top (front) to bottom (back).' },
          { type: 'heading', text: 'Operations', level: 2 },
          { type: 'bullets', items: [
            'Drag to reorder layers',
            'Click to select an element',
            'Toggle visibility (eye icon)',
            'Lock/unlock an element',
            'Right-click for context menu (bring to front/back, duplicate, delete, group/ungroup)'
          ] },
          { type: 'heading', text: 'Multi-Select & Grouping', level: 2 },
          { type: 'paragraph', text: 'Hold Shift and click to select multiple elements, or drag a selection rectangle on the canvas. With multiple elements selected, you can group them into a single layer for easier management.' }
        ]
      },
      {
        id: 'alignment',
        title: 'Alignment Tools',
        content: [
          { type: 'heading', text: 'Aligning Elements', level: 1 },
          { type: 'paragraph', text: 'When two or more elements are selected, alignment buttons appear in the Properties panel.' },
          { type: 'bullets', items: [
            'Align Left — Aligns all selected elements to the leftmost element',
            'Align Center X — Centers all selected elements horizontally',
            'Align Right — Aligns to the rightmost element',
            'Align Top — Aligns to the topmost element',
            'Align Center Y — Centers all selected elements vertically',
            'Align Bottom — Aligns to the bottommost element'
          ] }
        ]
      }
    ]
  },
  {
    id: 'backgrounds',
    title: 'Backgrounds & Themes',
    icon: '🎨',
    pages: [
      {
        id: 'background-types',
        title: 'Background Types',
        content: [
          { type: 'heading', text: 'Background Types', level: 1 },
          { type: 'paragraph', text: 'The canvas background can be configured from the Themes panel. Four types are available:' },
          { type: 'bullets', items: [
            'Solid — A single color',
            'Gradient — Linear, radial, or conic gradients with unlimited color stops',
            'Image — Upload an image as the background with blur, dim, and tint controls',
            'Preset — Animated or static preset backgrounds (Aurora, Neon Grid, etc.)'
          ] },
          { type: 'heading', text: 'Gradient Editor', level: 2 },
          { type: 'paragraph', text: 'The gradient editor supports adding, removing, and reordering color stops. Each stop has a color picker and position slider. You can choose between linear, radial, and conic gradient types, and control the angle.' },
          { type: 'heading', text: 'Theme Presets', level: 2 },
          { type: 'paragraph', text: 'The Theme Presets panel provides 17 pre-built color palettes. Click a preset to instantly apply it to the current scene.' }
        ]
      },
      {
        id: 'ui-theme',
        title: 'UI Theme',
        content: [
          { type: 'heading', text: 'Dark/Light UI Theme', level: 1 },
          { type: 'paragraph', text: 'Mockup Studio supports both dark and light UI themes. Toggle between them using the sun/moon button in the sidebar tab rail.' },
          { type: 'note', text: 'The UI theme only affects panels and controls — the canvas always renders on a dark background regardless of theme.' }
        ]
      }
    ]
  },
  {
    id: 'shortcuts',
    title: 'Keyboard Shortcuts',
    icon: '⌨️',
    pages: [
      {
        id: 'shortcuts-reference',
        title: 'Complete Shortcut Reference',
        content: [
          { type: 'heading', text: 'Keyboard Shortcuts', level: 1 },
          { type: 'heading', text: 'File Operations', level: 2 },
          { type: 'shortcuts', items: [
            { keys: ['Ctrl', 'N'], desc: 'New project' },
            { keys: ['Ctrl', 'O'], desc: 'Open project' },
            { keys: ['Ctrl', 'S'], desc: 'Save project' },
            { keys: ['Ctrl', 'Shift', 'S'], desc: 'Save As' }
          ] },
          { type: 'heading', text: 'Edit', level: 2 },
          { type: 'shortcuts', items: [
            { keys: ['Ctrl', 'Z'], desc: 'Undo' },
            { keys: ['Ctrl', 'Shift', 'Z'], desc: 'Redo' },
            { keys: ['Ctrl', 'X'], desc: 'Cut selected elements' },
            { keys: ['Ctrl', 'C'], desc: 'Copy selected elements' },
            { keys: ['Ctrl', 'V'], desc: 'Paste' },
            { keys: ['Ctrl', 'A'], desc: 'Select all elements' },
            { keys: ['Ctrl', 'D'], desc: 'Duplicate selected' },
            { keys: ['Delete'], desc: 'Delete selected' }
          ] },
          { type: 'heading', text: 'Canvas', level: 2 },
          { type: 'shortcuts', items: [
            { keys: ['Ctrl', '+'], desc: 'Zoom in' },
            { keys: ['Ctrl', '-'], desc: 'Zoom out' },
            { keys: ['Ctrl', '0'], desc: 'Reset zoom' },
            { keys: ['Ctrl', 'Shift', 'F'], desc: 'Fit canvas to window' },
            { keys: ['Ctrl', 'scroll'], desc: 'Zoom in/out' },
            { keys: ['scroll'], desc: 'Pan canvas' },
            { keys: ['Alt', 'drag'], desc: 'Pan canvas' }
          ] },
          { type: 'heading', text: 'Z-Order', level: 2 },
          { type: 'shortcuts', items: [
            { keys: [']'], desc: 'Bring forward' },
            { keys: ['['], desc: 'Send backward' },
            { keys: ['Ctrl', 'Shift', ']'], desc: 'Bring to front' },
            { keys: ['Ctrl', 'Shift', '['], desc: 'Send to back' }
          ] },
          { type: 'heading', text: 'Help', level: 2 },
          { type: 'shortcuts', items: [
            { keys: ['F1'], desc: 'Open User Guide' },
            { keys: ['Ctrl', '/'], desc: 'Show keyboard shortcuts' }
          ] }
        ]
      }
    ]
  },
  {
    id: 'advanced',
    title: 'Advanced Features',
    icon: '⚡',
    pages: [
      {
        id: 'multi-scene',
        title: 'Multi-Scene Projects',
        content: [
          { type: 'heading', text: 'Working with Multiple Scenes', level: 1 },
          { type: 'paragraph', text: 'Mockup Studio supports multiple scenes within a single project. Each scene has its own canvas size, background, devices, text, images, shapes, and guides.' },
          { type: 'heading', text: 'Scene Tabs', level: 2 },
          { type: 'paragraph', text: 'Scene tabs appear at the top of the canvas area. You can add, rename, reorder, and delete scenes. Each scene maintains its own undo history.' },
          { type: 'heading', text: 'Export All Scenes', level: 2 },
          { type: 'paragraph', text: 'When exporting, choose "All Scenes" to export every scene in the project. Scenes are saved individually or bundled into a ZIP file.' },
          { type: 'tip', text: 'Use scenes to create variants of a design (e.g., different screen sizes, color schemes, or languages) within the same project file.' }
        ]
      },
      {
        id: 'version-history',
        title: 'Version History',
        content: [
          { type: 'heading', text: 'Version Snapshots', level: 1 },
          { type: 'paragraph', text: 'The Version History panel lets you save snapshots of your project state at different points in time. You can restore any snapshot later.' },
          { type: 'heading', text: 'Features', level: 2 },
          { type: 'bullets', items: [
            'Manual snapshots — click the camera icon to save the current state',
            'Auto-snapshots — enabled by default, takes a snapshot every 5 minutes',
            'Restore — click Restore on any snapshot to revert to that state (undoable)',
            'Delete — remove unwanted snapshots',
            'Clear all — remove all snapshots at once'
          ] },
          { type: 'note', text: 'Restoring a snapshot also pushes the current state to the undo history, so you can undo a restore if needed.' }
        ]
      },
      {
        id: 'shadow-glow',
        title: 'Shadow & Glow Effects',
        content: [
          { type: 'heading', text: 'Shadow & Glow', level: 1 },
          { type: 'paragraph', text: 'Shapes and image overlays can have shadow and glow effects applied. These are configured in the Properties panel when an element is selected.' },
          { type: 'heading', text: 'Shadow Controls', level: 2 },
          { type: 'bullets', items: [
            'Color and opacity',
            'Blur radius',
            'Spread distance',
            'Offset (X and Y)',
            'Preset styles (soft, medium, hard, floating)',
            'Inset shadow support'
          ] },
          { type: 'heading', text: 'Glow Controls', level: 2 },
          { type: 'bullets', items: [
            'Color and opacity',
            'Blur radius',
            'Spread distance',
            'Preset styles (subtle, medium, intense, neon)'
          ] },
          { type: 'tip', text: 'You can add multiple shadow or glow layers to create complex effects.' }
        ]
      }
    ]
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    icon: '❓',
    pages: [
      {
        id: 'faq',
        title: 'Frequently Asked Questions',
        content: [
          { type: 'heading', text: 'Frequently Asked Questions', level: 1 },
          { type: 'heading', text: 'Can I open .mockup files from other users?', level: 2 },
          { type: 'paragraph', text: 'Yes. .mockup files are self-contained ZIP archives. Just open them with Mockup Studio and all assets will be loaded.' },
          { type: 'heading', text: 'My changes were lost — what happened?', level: 2 },
          { type: 'paragraph', text: 'Mockup Studio has a recovery system that saves periodic snapshots. Go to File → Open and check your projects directory for recovery files. Also check the Version History panel for saved snapshots.' },
          { type: 'heading', text: 'How do I update the app?', level: 2 },
          { type: 'paragraph', text: 'Go to Help → Check for Updates. If a new version is available, you can download and install it from there.' },
          { type: 'heading', text: 'Can I use my own fonts?', level: 2 },
          { type: 'paragraph', text: 'Currently, Mockup Studio uses system fonts available on your operating system.' },
          { type: 'heading', text: 'Why is my image export blurry?', level: 2 },
          { type: 'paragraph', text: 'Make sure your canvas size matches your target resolution. Use the Scale option in the Export panel to export at 2× or higher for retina displays.' }
        ]
      }
    ]
  }
]

export default DOCS