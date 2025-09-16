import { Button } from "@/components/ui/button";
import { useThreads } from "@/providers/Thread";
import { useEffect, useState } from "react";

import { useQueryState, parseAsBoolean } from "nuqs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { PanelRightOpen, PanelRightClose, Trash2 } from "lucide-react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { toast } from "sonner";

// ADK Thread interface
interface AdkThread {
  id: string;
  agent_id: string;
  title?: string;
  created_at: string;
  updated_at: string;
}

function ThreadList({
  threads,
  onThreadClick,
}: {
  threads: AdkThread[];
  onThreadClick?: (threadId: string) => void;
}) {
  const [threadId, setThreadId] = useQueryState("threadId");
  const { deleteThread } = useThreads();
  const [deletingThreads, setDeletingThreads] = useState<Set<string>>(
    new Set(),
  );

  const handleDeleteThread = async (
    threadIdToDelete: string,
    e: React.MouseEvent,
  ) => {
    console.log(
      "[ThreadHistory] Delete button clicked for thread:",
      threadIdToDelete,
    );
    e.stopPropagation(); // Prevent thread selection when clicking delete

    try {
      console.log("[ThreadHistory] Setting thread as deleting in UI state");
      setDeletingThreads((prev) => new Set(prev).add(threadIdToDelete));

      console.log("[ThreadHistory] Calling deleteThread from provider");
      await deleteThread(threadIdToDelete);
      console.log("[ThreadHistory] deleteThread completed successfully");

      // If we deleted the current thread, clear the selection
      if (threadId === threadIdToDelete) {
        console.log(
          "[ThreadHistory] Deleted thread was current thread, clearing selection",
        );
        setThreadId(null);
      } else {
        console.log(
          "[ThreadHistory] Deleted thread was not current thread, keeping selection",
        );
      }

      console.log("[ThreadHistory] Showing success toast");
      toast.success("Thread deleted successfully");
    } catch (error) {
      console.error("[ThreadHistory] Failed to delete thread:", error);
      toast.error("Failed to delete thread");
    } finally {
      console.log("[ThreadHistory] Removing thread from deleting state");
      setDeletingThreads((prev) => {
        const newSet = new Set(prev);
        newSet.delete(threadIdToDelete);
        return newSet;
      });
    }
  };

  return (
    <div className="flex h-full w-full flex-col items-start justify-start gap-2 overflow-y-scroll [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-track]:bg-transparent">
      {threads.map((t) => {
        const itemText = t.title || `Thread ${t.id.slice(-8)}`;
        const isActive = threadId === t.id;
        const isDeleting = deletingThreads.has(t.id);

        return (
          <div
            key={t.id}
            className="w-full px-1"
          >
            <div className="flex items-center gap-1">
              <Button
                variant={isActive ? "secondary" : "ghost"}
                className="flex-1 items-start justify-start text-left font-normal"
                onClick={(e) => {
                  e.preventDefault();
                  setThreadId(t.id);
                  onThreadClick?.(t.id);
                }}
                disabled={isDeleting}
              >
                <div className="flex w-full flex-col items-start text-sm">
                  <div className="line-clamp-2 text-left">{itemText}</div>
                  <div className="text-muted-foreground text-xs">
                    {new Date(t.updated_at).toLocaleDateString()}
                  </div>
                </div>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive h-8 w-8 p-0"
                onClick={(e) => handleDeleteThread(t.id, e)}
                disabled={isDeleting}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
function ThreadHistoryLoading() {
  return (
    <div className="flex h-full w-full flex-col items-start justify-start gap-2 overflow-y-scroll [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-track]:bg-transparent">
      {Array.from({ length: 30 }).map((_, i) => (
        <Skeleton
          key={`skeleton-${i}`}
          className="h-10 w-[280px]"
        />
      ))}
    </div>
  );
}

export default function ThreadHistory() {
  const isLargeScreen = useMediaQuery("(min-width: 1024px)");
  const [chatHistoryOpen, setChatHistoryOpen] = useQueryState(
    "chatHistoryOpen",
    parseAsBoolean.withDefault(false),
  );
  const [threadId, setThreadId] = useQueryState("threadId");

  const { getThreads, threads, setThreads, threadsLoading, setThreadsLoading } =
    useThreads();

  useEffect(() => {
    if (typeof window === "undefined") return;
    setThreadsLoading(true);
    getThreads()
      .then(setThreads)
      .catch(console.error)
      .finally(() => setThreadsLoading(false));
  }, [getThreads, setThreads, setThreadsLoading]);

  // Note: Removed automatic thread selection to allow starting new conversations
  // Users can manually select a thread from the history or create a new one

  return (
    <>
      <div className="shadow-inner-right hidden h-screen w-[300px] shrink-0 flex-col items-start justify-start gap-6 border-r-[1px] border-slate-300 lg:flex">
        <div className="flex w-full items-center justify-between px-4 pt-1.5">
          <Button
            className="hover:bg-gray-100"
            variant="ghost"
            onClick={() => setChatHistoryOpen((p) => !p)}
          >
            {chatHistoryOpen ? (
              <PanelRightOpen className="size-5" />
            ) : (
              <PanelRightClose className="size-5" />
            )}
          </Button>
          <h1 className="text-xl font-semibold tracking-tight">
            Thread History
          </h1>
        </div>
        {threadsLoading ? (
          <ThreadHistoryLoading />
        ) : (
          <ThreadList threads={threads} />
        )}
      </div>
      <div className="lg:hidden">
        <Sheet
          open={!!chatHistoryOpen && !isLargeScreen}
          onOpenChange={(open) => {
            if (isLargeScreen) return;
            setChatHistoryOpen(open);
          }}
        >
          <SheetContent
            side="left"
            className="flex h-full w-[300px] flex-col p-0"
          >
            <SheetHeader className="p-4">
              <SheetTitle>Thread History</SheetTitle>
            </SheetHeader>
            {threadsLoading ? (
              <ThreadHistoryLoading />
            ) : (
              <ThreadList
                threads={threads}
                onThreadClick={() => setChatHistoryOpen(false)}
              />
            )}
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
