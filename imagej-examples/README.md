> **Inherited from upstream ImageJ.JS, not verified by CoSE.** Written by the upstream
> [ImageJ.JS](https://github.com/aicell-lab/imagej.js) authors and kept in this fork as received. CoSE has not checked its claims,
> figures, citations or file references; see the [CoSE FIJI Bench README](../README.md) for what CoSE
> has verified.

# ImageJ.js Code Examples

A growing collection of working code examples for ImageJ running in the browser via CheerpJ.

## 🎯 Quick Start

Use the MCP tools to browse examples:
- `listExamples()` - See all available examples
- `readExample(path)` - Read a specific example
- `searchExamples(query)` - Search examples by keyword
- `searchCommands(query)` - Find ImageJ commands

## 🔌 Hosting Your Own Plugin Repository

You can host custom ImageJ plugins and macros on GitHub and load them directly into ImageJ.js!

### Step 1: Create a GitHub Repository

Create a repository with your plugins organized like this:

```
your-repo/
├── plugins/
│   ├── YourPlugin.jar
│   ├── AnotherPlugin.class
│   └── index.list          # Required!
├── macros/
│   ├── MyMacro.ijm
│   └── index.list          # Required!
└── index.list              # Required at root!
```

**Important:** Each directory must have an `index.list` file for ImageJ.js to discover its contents.

### Step 2: Generate index.list Files

Create `index.list` files with type information:

```bash
# In your repository root
cd plugins
ls -1 | grep -v "^index.list$" | while read f; do
  if [ -d "$f" ]; then
    echo "dir:$f"
  else
    echo "$f"
  fi
done > index.list

# Repeat for each directory (macros, samples, etc.)
```

**Format:**
- Directories: `dir:foldername`
- Files: `filename.jar` (no prefix)

### Step 3: Load Your Repository in ImageJ.js

Use this URL format:

```
http://localhost:8000/?mount=github:owner/repo@branch&plugins.dir=/github/owner/repo@branch/plugins
```

**Example with demo repository:**

```
http://localhost:8000/?mount=github:oeway/imagej-js-env-demo@main&plugins.dir=/github/oeway/imagej-js-env-demo@main/plugins
```

### URL Parameters Explained

- `mount=github:owner/repo@branch` - Mounts the GitHub repository
  - **owner**: GitHub username (e.g., `oeway`)
  - **repo**: Repository name (e.g., `imagej-js-env-demo`)
  - **branch**: Branch name (e.g., `main`, `master`, `dev`)

- `plugins.dir=/github/owner/repo@branch/plugins` - Sets ImageJ plugins directory
  - Must match the mounted path
  - Points to your `plugins` folder

### Demo Repository

Check out the example repository: [oeway/imagej-js-env-demo](https://github.com/oeway/imagej-js-env-demo)

This demo includes:
- ✅ Properly formatted `index.list` files
- ✅ Sample plugins
- ✅ Example directory structure
- ✅ Working configuration

### Testing Your Repository

1. Push your repository to GitHub with `index.list` files
2. Construct your URL:
   ```
   http://localhost:8000/?mount=github:yourname/yourrepo@main&plugins.dir=/github/yourname/yourrepo@main/plugins
   ```
3. Open ImageJ.js and navigate to `Plugins` menu
4. Your plugins should appear!

### Troubleshooting

**Plugins not showing up?**
- ✅ Check that `index.list` exists in your `plugins` directory
- ✅ Verify the format: `dir:` prefix for folders, no prefix for files
- ✅ Ensure branch name is correct (`main` vs `master`)
- ✅ Check browser console for errors

**Getting 404 errors?**
- ✅ Make sure repository is public
- ✅ Verify file paths are correct
- ✅ Check that files are committed and pushed

**Files listed but won't load?**
- ✅ Ensure `.jar` and `.class` files are in Git LFS or under 100MB
- ✅ Check file permissions in repository

### Advanced: Multiple Plugin Directories

You can mount multiple repositories:

```
?mount=github:owner/repo1@main&mount=github:owner/repo2@main&plugins.dir=/github/owner/repo1@main/plugins
```

Or specify multiple plugin directories (comma-separated):

```
?plugins.dir=/github/owner/repo@main/plugins,/github/owner/repo@main/custom-plugins
```

### Benefits

- 🚀 **No server needed** - GitHub hosts everything
- 🔄 **Easy updates** - Just push to GitHub
- 🌐 **Shareable** - Anyone can use your plugins via URL
- 🆓 **Free hosting** - GitHub provides free public repositories
- ⚡ **Fast loading** - Efficient index.list-based discovery

## 📚 Categories

### Segmentation
- [Blob Segmentation with Magic Wand](segmentation/blob-segmentation-wand.md) ⭐ CheerpJ-safe

### ROI Management  
- [ROI Manager Basics](roi/roi-manager-basics.md)

### Measurement
- Coming soon...

### Preprocessing
- Coming soon...

## 🏷️ Common Tags
- `cheerpj-safe` - Confirmed to work reliably in browser environment
- `macro` - Uses ImageJ macro language
- `javascript` - Uses direct JavaScript/Java API calls
- `workaround` - Alternative when standard method fails

## ⚠️ CheerpJ Compatibility Notes

Some ImageJ functions behave differently in the browser:
- ❌ `Analyze Particles` via macro - Often returns 0 results in CheerpJ
- ✅ `doWand()` - Works reliably
- ✅ Direct Java API calls via JavaScript - Most reliable
- ✅ ROI Manager - Works well

## 🤝 Contributing

When you discover a working solution, save it using `saveExample()` with proper markdown formatting.

