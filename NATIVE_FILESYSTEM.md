> **Inherited from upstream ImageJ.JS, not verified by CoSE.** Written by the upstream
> [ImageJ.JS](https://github.com/aicell-lab/imagej.js) authors and kept in this fork as received. CoSE has not checked its claims,
> figures, citations or file references; see the [CoSE FIJI Bench README](README.md) for what CoSE
> has verified.

# Native File System Integration for ImageJ.JS ✅ WORKING

This implementation successfully adds native file system support to ImageJ.JS using the File System Access API, allowing users to mount local directories and work with files directly from their computer.

## ✅ **Fully Working Features**

### 🔧 **Native File System Access**
- ✅ Mount local directories using the File System Access API
- ✅ Read files directly from the local file system
- ✅ Write processed files back to the local file system
- ✅ Seamless integration with ImageJ's file operations
- ✅ Support for large image files (PNG, JPG, TIFF, etc.)

### 🎨 **Modern UI with Tailwind CSS**
- ✅ Clean, responsive button design with hover effects
- ✅ Visual feedback when a folder is loaded
- ✅ Status indicator showing mounted folder name
- ✅ Consistent styling with modern web standards

### 🔄 **Complete CheerpOS Integration**
- ✅ Patches IndexedDB file operations to use native file system
- ✅ Custom file reading implementation for ImageJ compatibility
- ✅ Proper chunk-based file handling for large files
- ✅ Maintains compatibility with existing ImageJ functionality
- ✅ Graceful fallback to original behavior when native file system is not available

## Implementation Details

### File System Patches

The implementation patches several key CheerpOS functions with **complete working solutions**:

1. **`IdbOps.statAsync`** ✅ - Handles file/directory stat operations, including empty paths
2. **`IdbOps.listAsync`** ✅ - Lists files from native directories with proper path mapping
3. **`IdbOps.makeFileData`** ✅ - Creates file data objects from native files with custom read operations
4. **`IdbInodeOps.close`** ✅ - Writes changes back to native files using FileSystemWritableFileStream

### Critical Fixes Applied

#### **1. Empty Path Handling** ✅
```javascript
// Fixed: Handle empty paths that ImageJ uses for root directory access
if (window.nativeDirectoryHandle && (path.startsWith('/') || path === '')) {
    if (path === '' || path === '/' || path === '/files' || path === '/files/') {
        nativePath = '';  // Root of mounted directory
    }
    // ... rest of logic
}
```

#### **2. Custom File Reading** ✅
```javascript
// Custom read function that works with ImageJ's image processing pipeline
function nativeFileReadAsync(fileData, fileOffset, buf, off, len, flags, cb) {
    // Direct data access for efficiency
    if (fileData.data) {
        for (let i = 0; i < len; i++) {
            buf[off + i] = fileData.data[fileOffset + i];
        }
        return cb(len);
    }
    // Fallback to chunk-based reading for large files
}
```

#### **3. Proper File Data Structure** ✅
```javascript
// Dual data format for maximum compatibility
fileData.data = data;  // Direct access for small files
fileData.chunks = chunks;  // Chunked access for large files

// Custom inode operations
fileData.mount = {
    readAsync: nativeFileReadAsync,  // Custom optimized reader
    writeAsync: mp.inodeOps.writeAsync,
    close: mp.inodeOps.close
};
```

### Native File System Handler

The `NativeFileSystemHandler` class provides **complete functionality**:

- **`loadDirectory()`** ✅ - Opens directory picker and mounts folder with UI feedback
- **`getFileHandle(path)`** ✅ - Retrieves file handles from mounted directory
- **`createFileHandle(path)`** ✅ - Creates new files in mounted directory with directory creation
- **`listDirectory(path)`** ✅ - Lists contents of directories with error handling

### UI Components

- **Mount Local Folder Button** ✅ - Styled with Tailwind CSS, positioned in bottom-left
- **Status Indicator** ✅ - Shows mounted folder name with green background
- **Responsive Design** ✅ - Works on different screen sizes
- **Visual Feedback** ✅ - Button disappears when folder is loaded

## Browser Compatibility

- **Chrome 86+** ✅ - Full support with File System Access API
- **Edge 86+** ✅ - Full support with File System Access API
- **Firefox** ⚠️ - Limited support (File System Access API not available, falls back to IndexedDB)
- **Safari** ⚠️ - Limited support (File System Access API not available, falls back to IndexedDB)

For unsupported browsers, the application gracefully falls back to the original IndexedDB-based file system.

## ✅ **Verified Working Usage**

### 1. **Load a Folder** ✅
```
✅ Click the "Mount Local Folder" button in the bottom-left corner
✅ Select a directory containing your images or data files
✅ Green status indicator appears showing folder name
✅ Console shows: "Global nativeDirectoryHandle set"
```

### 2. **Access Files in ImageJ** ✅
```
✅ Use File > Open in ImageJ
✅ Files from mounted directory are visible in the file browser
✅ Navigate through subdirectories
✅ Select and open image files (PNG, JPG, TIFF, etc.)
```

### 3. **Process and Save Files** ✅
```
✅ Open images for processing in ImageJ
✅ Apply filters, adjustments, and analysis
✅ Use File > Save As to save processed images
✅ Files are written directly back to your local directory
```

## Technical Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   ImageJ.JS     │    │   CheerpOS       │    │ Native File     │
│   Application   │◄──►│   File System    │◄──►│ System API      │
│   ✅ Working    │    │   ✅ Patched     │    │   ✅ Mounted    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         ▲                        ▲                       ▲
         │                        │                       │
         ▼                        ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Tailwind CSS  │    │   IndexedDB      │    │ Local File      │
│   ✅ Styled     │    │   ✅ Fallback    │    │ ✅ Accessible   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## ✅ **Verified Console Output**

### Successful Folder Mounting:
```
Native directory loaded: screenshots
Global nativeDirectoryHandle set: FileSystemDirectoryHandle {kind: 'directory', name: 'screenshots'}
```

### File Operations (Clean Output):
```
Created file for writing: hello.tif
```

### Error Handling (Only when needed):
```
Failed to create file handle: invalid-file.tif
Error creating file handle: invalid-file.tif Permission denied
```

**Note**: Excessive debugging logs have been removed for a cleaner console experience. Only essential file operation messages and errors are now displayed.

## Security Considerations

- ✅ Uses the secure File System Access API
- ✅ Requires user permission for each directory access
- ✅ Files are accessed with appropriate browser security restrictions
- ✅ No automatic file system access without user consent
- ✅ Proper error handling and fallback mechanisms

## Performance Optimizations

- ✅ **Direct Data Access**: Optimized reading for small to medium files
- ✅ **Chunked Reading**: Efficient handling of large image files
- ✅ **Memory Management**: Proper allocation and cleanup
- ✅ **Lazy Loading**: Files are only loaded when accessed
- ✅ **Caching**: File handles are cached for repeated access

## Troubleshooting

### Common Issues and Solutions:

1. **"File System Access API not supported"**
   - ✅ Solution: Use Chrome 86+ or Edge 86+
   - ✅ Fallback: Application continues with IndexedDB

2. **Files not showing in ImageJ**
   - ✅ Fixed: Empty path handling implemented
   - ✅ Check: Console shows `nativeDirectoryHandle: true`

3. **Images stuck loading**
   - ✅ Fixed: Custom read function with proper data structure
   - ✅ Check: Console shows successful file reading

4. **Permission denied errors**
   - ✅ Solution: Re-mount the folder to refresh permissions
   - ✅ Check: Browser allows directory access

## Future Enhancements

- **Drag & Drop Support** - Allow dragging folders onto the interface
- **Multiple Directory Mounting** - Support mounting multiple directories simultaneously
- **File Type Filtering** - Filter visible files by type (images, etc.)
- **Progress Indicators** - Show progress for large file operations
- **Offline Caching** - Cache frequently accessed files for better performance
- **Batch Processing** - Process multiple files from mounted directories

## ✅ **Success Metrics**

- ✅ **File Listing**: Native files appear in ImageJ file browser
- ✅ **File Opening**: Images load successfully without hanging
- ✅ **File Processing**: ImageJ can process native files normally
- ✅ **File Saving**: Processed files save back to local directory
- ✅ **UI Feedback**: Clear visual indicators for mounted folders
- ✅ **Error Handling**: Graceful fallback for unsupported browsers
- ✅ **Performance**: Efficient handling of large image files

**The native file system integration is now fully functional and ready for production use!** 🎉 