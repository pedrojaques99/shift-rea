import { useEffect, useRef, useState, type DragEvent } from "react";
import { LauncherLockup } from "@/app/branding";
import { shiftProductName } from "@/app/release";
import { HelpMenu } from "@/components/launcher/HelpMenu";
import { LauncherActions } from "@/components/launcher/LauncherActions";
import { RecentFiles } from "@/components/launcher/RecentFiles";
import { UpdateStrip } from "@/components/chrome/UpdateStrip";
import { useRecentDocuments } from "@/components/launcher/useRecentDocuments";
import { WindowControls } from "@/components/chrome/WindowControls";
import { WindowMenuBar } from "@/components/chrome/WindowMenuBar";
import { DropOverlay } from "@/components/visant/ui/drop-overlay";
import { getShiftHost } from "@/host/shiftHost";

export const Landing = () => {
  const recentDocuments = useRecentDocuments();
  const recentsLoaded = recentDocuments !== null;

  useEffect(() => {
    if (!recentsLoaded) return undefined;

    // Wait for the frame with the recent files to paint before main shows the window.
    const frame = requestAnimationFrame(() => {
      void signalReady();
    });
    return () => cancelAnimationFrame(frame);
  }, [recentsLoaded]);

  const isMac = getShiftHost().platform === "darwin";
  const drop = useFontDrop();

  return (
    <main
      className="relative flex h-screen flex-col bg-background text-primary"
      onDragEnter={drop.onDragEnter}
      onDragOver={drop.onDragOver}
      onDragLeave={drop.onDragLeave}
      onDrop={drop.onDrop}
    >
      <div className="visant-kit pointer-events-none absolute inset-2 z-50">
        <DropOverlay state={drop.state} message="Drop a font to open it" doneMessage="Opening…" />
      </div>
      {isMac ? (
        // macOS draws the traffic lights (systemTrafficLights in main); this strip
        // only drags the window. Overlaid so the launcher centres against the
        // whole window, not the space below the bar.
        <div className="titlebar-drag absolute inset-x-0 top-0 z-10 h-10" />
      ) : (
        <div className="title-bar-area shrink-0 bg-chrome">
          <div className="titlebar-drag flex h-10 items-center">
            <WindowControls side="start" />
            <WindowMenuBar />
            <div className="flex-1" />
            <WindowControls side="end" />
          </div>
        </div>
      )}
      <div className="scrollbar-hidden flex min-h-0 flex-1 flex-col overflow-y-auto px-4">
        <div className="mx-auto flex w-full max-w-200 flex-col pb-20">
          <header className="flex items-center gap-2 pt-25 pb-14">
            <div className="min-w-0 flex-1">
              <LauncherLockup aria-hidden="true" className="h-9 w-auto text-primary" />
              <h1 className="sr-only">{shiftProductName}</h1>
            </div>
            <LauncherActions />
          </header>
          {recentDocuments && <RecentFiles documents={recentDocuments} />}
        </div>
      </div>
      {/* Left of the Help button, centred on it. */}
      <UpdateStrip className="right-12 bottom-2" />
      <HelpMenu className="absolute right-3.5 bottom-3.5" />
    </main>
  );
};

async function signalReady(): Promise<void> {
  try {
    await getShiftHost().window.ready();
  } catch (error) {
    console.error("signalling launcher readiness failed", error);
  }
}

/**
 * A font file dragged from the system onto the launcher opens like a recent
 * file does (main shows its own message when it can't be opened).
 */
function useFontDrop() {
  const [state, setState] = useState<"idle" | "over" | "drop">("idle");
  // dragenter and dragleave fire for every child crossed; count them to know
  // when the drag really leaves the window.
  const depth = useRef(0);

  const carriesFiles = (event: DragEvent) => event.dataTransfer.types.includes("Files");

  return {
    state,
    onDragEnter: (event: DragEvent) => {
      if (!carriesFiles(event)) return;

      depth.current += 1;
      setState("over");
    },
    onDragOver: (event: DragEvent) => {
      if (!carriesFiles(event)) return;

      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    },
    onDragLeave: (event: DragEvent) => {
      if (!carriesFiles(event)) return;

      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setState("idle");
    },
    onDrop: async (event: DragEvent) => {
      if (!carriesFiles(event)) return;

      event.preventDefault();
      depth.current = 0;
      const [file] = event.dataTransfer.files;
      const path = file ? getShiftHost().droppedFiles.pathFor(file) : "";
      if (!path) {
        setState("idle");
        return;
      }

      setState("drop");
      try {
        await getShiftHost().recents.open(path);
      } finally {
        setState("idle");
      }
    },
  };
}
