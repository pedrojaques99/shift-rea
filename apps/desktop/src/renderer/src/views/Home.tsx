import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@shift/ui";
import { GlyphGrid } from "@/components/home/GlyphGrid";
import { LeftSidebar } from "@/components/home/LeftSidebar";
import { AgentChatPanel } from "@/components/agent-chat/AgentChatPanel";
import { RightSidebar } from "@/components/editor/RightSidebar";
import { Toolbar } from "@/components/chrome/Toolbar";
import { useSidebarLayout } from "@/components/chrome/useSidebarLayout";
import { UpdateStrip } from "@/components/chrome/UpdateStrip";
import { useDismissGridSelection } from "@/components/home/useDismissGridSelection";

export const Home = () => {
  const {
    leftSidebarContentRef,
    rightSidebarContentRef,
    onLayoutChanged,
    sidebarPanelProps,
    toggleLeftSidebar,
    toggleRightSidebar,
    leftSidebarOpen,
    rightSidebarOpen,
    resetLeftSidebar,
    resetRightSidebar,
    groupRef,
    agentContentRef,
    agentOpen,
    toggleAgent,
    resetAgent,
  } = useSidebarLayout("home");
  const dismissGridSelection = useDismissGridSelection();

  return (
    <main className="grid h-screen w-full grid-rows-[auto_minmax(0,1fr)]">
      <Toolbar
        toggleLeftSidebar={toggleLeftSidebar}
        toggleRightSidebar={toggleRightSidebar}
        leftSidebarOpen={leftSidebarOpen}
        rightSidebarOpen={rightSidebarOpen}
        toggleAgent={toggleAgent}
        agentOpen={agentOpen}
      />
      <ResizablePanelGroup
        id="home-layout-panels"
        groupRef={groupRef}
        orientation="horizontal"
        onLayoutChanged={onLayoutChanged}
        className="min-h-0 overflow-hidden"
      >
        <ResizablePanel {...sidebarPanelProps("left")}>
          <div ref={leftSidebarContentRef} className="h-full" onPointerDown={dismissGridSelection}>
            <LeftSidebar />
          </div>
        </ResizablePanel>
        <ResizableHandle
          aria-label="Resize left sidebar"
          inset="start"
          disableDoubleClick
          onDoubleClick={resetLeftSidebar}
        />
        <ResizablePanel id="grid" minSize={300}>
          <div className="relative h-full">
            <GlyphGrid />
            <UpdateStrip className="right-3 bottom-3" />
          </div>
        </ResizablePanel>
        <ResizableHandle
          aria-label="Resize right sidebar"
          inset="end"
          disableDoubleClick
          onDoubleClick={resetRightSidebar}
        />
        <ResizablePanel {...sidebarPanelProps("right")}>
          <div ref={rightSidebarContentRef} className="h-full" onPointerDown={dismissGridSelection}>
            <RightSidebar />
          </div>
        </ResizablePanel>
        <ResizableHandle
          aria-label="Resize agent panel"
          inset="end"
          disableDoubleClick
          onDoubleClick={resetAgent}
        />
        {/* The agent works on the whole font here: it can create glyphs before any is open. */}
        <ResizablePanel {...sidebarPanelProps("agent")}>
          <div ref={agentContentRef} className="h-full border-l border-line-subtle">
            <AgentChatPanel />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </main>
  );
};
