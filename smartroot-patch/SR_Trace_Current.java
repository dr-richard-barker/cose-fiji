/*
 * SR_Trace_Current — open SmartRoot's tracing canvas on the image already loaded
 * in this ImageJ session.
 *
 * Why this exists
 * ---------------
 * SmartRoot's stock entry point, SR_Explorer, is a *file browser*: it builds a
 * Swing JTreeTable over the local filesystem and only wires up the tracing
 * canvas when you double-click a file in that tree. In a browser there is no
 * local filesystem to browse — the image arrives over HTTP via the bench's
 * ?open= parameter — and SR_Explorer's UI construction additionally fails under
 * CheerpJ (Class.newInstance rethrows through sun.misc.Unsafe.throwException,
 * which CheerpJ does not implement, so the real cause is masked by an
 * UnsatisfiedLinkError).
 *
 * This plugin performs exactly the four steps SR_Explorer's double-click
 * handler performs, against WindowManager.getCurrentImage(), and skips the file
 * tree entirely.
 *
 * GPL-3.0, as required by SmartRoot, whose classes this builds on.
 * Derived from SR_Explorer.java (c) 2009-2017 Universite catholique de Louvain,
 * Xavier Draye and Guillaume Lobet.
 */

import ij.IJ;
import ij.ImagePlus;
import ij.WindowManager;
import ij.plugin.PlugIn;
import ij.process.ImageConverter;

public class SR_Trace_Current implements PlugIn {

   public void run(String arg) {
      ImagePlus imp = WindowManager.getCurrentImage();
      if (imp == null) {
         IJ.error("SmartRoot", "Open an image first, then run this command.");
         return;
      }

      // SmartRoot's Trace and Mark tools only work on 8-bit grayscale. Convert
      // in place rather than prompting to save, which is what stock SmartRoot
      // does and which cannot work here (no writable local filesystem).
      if (imp.getType() != ImagePlus.GRAY8) {
         IJ.log("[SmartRoot] converting " + imp.getTitle() + " to 8-bit grayscale for tracing");
         new ImageConverter(imp).convertToGray8();
      }

      // SR holds SmartRoot's global state (preferences, toolbar tools, the SQL
      // stub). Initialise once per session; SR_Explorer.sr is the same static
      // field the stock plugin uses, so both entry points stay consistent.
      try {
         if (SR_Explorer.sr == null) {
            (SR_Explorer.sr = new SR()).initialize();
         }
      } catch (Throwable t) {
         IJ.error("SmartRoot", "Could not initialise SmartRoot: " + t);
         return;
      }

      // SRWin is the measurement/chart window. It pulls in JFreeChart and is not
      // required for tracing, so a failure here must not stop the user tracing.
      try {
         if (SR_Explorer.srWin == null) SR_Explorer.srWin = new SRWin();
      } catch (Throwable t) {
         IJ.log("[SmartRoot] measurement window unavailable (" + t + "); tracing still works");
      }

      // The four steps from SR_Explorer's double-click handler.
      try {
         RootImageCanvas ric = new RootImageCanvas(imp);
         SRImageWindow imw = new SRImageWindow(imp, ric);
         ric.setImageWindow(imw);
         WindowManager.setWindow(imw);
         // Second argument is the directory SmartRoot reads/writes RSML in.
         // /local is the bench's virtual folder holding the fetched image.
         new RootModel(imw, "/local");
         WindowManager.setWindow(imw);
         IJ.log("[SmartRoot] tracing canvas ready for " + imp.getTitle()
              + " — pick Trace Root in the toolbar and click along a root.");
      } catch (Throwable t) {
         IJ.error("SmartRoot", "Could not open the tracing canvas: " + t);
      }
   }
}
