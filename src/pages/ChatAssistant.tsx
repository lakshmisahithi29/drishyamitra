import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChatMessage, TypingIndicator } from "@/components/ChatMessage";
import {
  sendChatMessage,
  type ChatMessage as ChatMsg,
  type ActionResult,
  batchDeletePhotos,
  resolveUrl,
} from "@/lib/api";
import { useNavigate } from "react-router-dom";
import {
  Send,
  Sparkles,
  Image as ImageIcon,
  Trash2,
  Loader2,
  Users,
  BarChart3,
  Copy,
  Camera,
  Heart,
  HardDrive,
  AlertTriangle,
  Eye,
  FolderOpen,
  Folder,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/* ---------- types ---------- */

interface UIMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  actionResults?: ActionResult[];
}

interface PendingDeletion {
  photoIds: number[];
  count: number;
  description: string;
}

/* ---------- suggestions ---------- */

const suggestions = [
  "Show my recent photos",
  "Who appears most in my photos?",
  "Do I have any duplicates?",
  "Show library stats",
  "Show my folders",
  "Create a folder named 'Exam Papers' with my exam photos",
];

/* ─────────────────────────────────────────────────
   Action-result renderers
   ───────────────────────────────────────────────── */

function PhotoGrid({ photos }: { photos: any[] }) {
  if (!photos?.length) return <p className="text-xs text-muted-foreground italic py-2">No photos found.</p>;
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 mt-2 max-w-lg">
      {photos.slice(0, 12).map((p: any) => (
        <div key={p.id} className="group relative rounded-lg overflow-hidden border border-border aspect-square bg-muted">
          <img
            src={resolveUrl(p.url)}
            className="w-full h-full object-cover transition-transform group-hover:scale-110"
            alt={p.original_filename}
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1.5">
            <span className="text-[9px] text-white truncate font-medium">{p.original_filename}</span>
          </div>
          {p._duplicate_group && (
            <Badge className="absolute top-1 right-1 text-[8px] bg-amber-500/90 text-white px-1 py-0">
              <Copy className="h-2.5 w-2.5 mr-0.5" />
              {p._duplicate_group}
            </Badge>
          )}
        </div>
      ))}
    </div>
  );
}

function StatsCard({ data }: { data: any }) {
  return (
    <div className="mt-2 space-y-3 max-w-lg">
      {/* Top row stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: "Photos", value: data.total_photos, icon: Camera, color: "text-blue-500" },
          { label: "Favorites", value: data.favorites, icon: Heart, color: "text-pink-500" },
          { label: "People", value: data.people_detected, icon: Users, color: "text-violet-500" },
          { label: "Storage", value: data.storage_str, icon: HardDrive, color: "text-emerald-500" },
        ].map((s) => (
          <Card key={s.label} className="bg-muted/50 border-border/50">
            <CardContent className="p-3 text-center">
              <s.icon className={`h-4 w-4 mx-auto mb-1 ${s.color}`} />
              <p className="text-lg font-black">{s.value}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* People */}
      {data.people?.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-1.5">People</p>
          <div className="flex flex-wrap gap-1.5">
            {data.people.map((p: any) => (
              <Badge key={p.name} variant="secondary" className="text-xs">
                {p.name} ({p.count})
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Categories */}
      {data.categories?.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-1.5">Categories</p>
          <div className="flex flex-wrap gap-1.5">
            {data.categories.map((c: any) => (
              <Badge key={c.name} variant="outline" className="text-xs">
                {c.name} ({c.count})
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      {data.top_tags?.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-1.5">Top Tags</p>
          <div className="flex flex-wrap gap-1.5">
            {data.top_tags.map((t: any) => (
              <Badge key={t.name} variant="secondary" className="text-xs bg-primary/10 text-primary">
                #{t.name} ({t.count})
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Warnings */}
      {(data.duplicate_photos > 0 || data.unknown_faces > 0) && (
        <div className="flex gap-2 flex-wrap">
          {data.duplicate_photos > 0 && (
            <Badge variant="destructive" className="text-xs gap-1">
              <Copy className="h-3 w-3" /> {data.duplicate_photos} duplicates ({data.duplicate_groups} groups)
            </Badge>
          )}
          {data.unknown_faces > 0 && (
            <Badge variant="outline" className="text-xs gap-1 border-amber-500/50 text-amber-600">
              <AlertTriangle className="h-3 w-3" /> {data.unknown_faces} unknown faces
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

function PersonsList({ data }: { data: any }) {
  const persons = data.persons || [];
  if (!persons.length) return <p className="text-xs text-muted-foreground italic py-2">No people detected yet.</p>;
  return (
    <div className="mt-2 space-y-1.5 max-w-lg">
      {persons.map((p: any, i: number) => (
        <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/50 border border-border/50">
          <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-primary-foreground text-xs font-black">
            {i + 1}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{p.name}</p>
          </div>
          <Badge variant="secondary" className="text-xs shrink-0">{p.photo_count} photos</Badge>
        </div>
      ))}
    </div>
  );
}

function CountChip({ data }: { data: any }) {
  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="bg-primary/10 text-primary rounded-xl px-4 py-2 font-black text-2xl">{data.count}</div>
      <span className="text-sm text-muted-foreground">{data.context}</span>
    </div>
  );
}

function FolderCreatedCard({ data }: { data: any }) {
  const navigate = useNavigate();
  return (
    <div className="animate-fade-in mt-2 p-4 rounded-2xl border border-primary/20 bg-primary/5 max-w-lg">
      <div className="flex items-center gap-3 mb-3">
        <div className="gradient-primary rounded-xl p-2">
          <Folder className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <p className="font-semibold text-sm">Folder created!</p>
          </div>
          <p className="text-xs text-muted-foreground">
            <strong>{data.folder_name}</strong>{" "}&mdash;{" "}
            {data.photo_count} {data.photo_count === 1 ? "photo" : "photos"}
          </p>
        </div>
      </div>
      {data.photos?.length > 0 && <PhotoGrid photos={data.photos} />}
      <button
        className="mt-3 text-xs text-primary font-medium flex items-center gap-1.5 hover:underline"
        onClick={() => navigate("/app/gallery")}
      >
        <FolderOpen className="h-3.5 w-3.5" />
        View in Folders
      </button>
    </div>
  );
}

function FoldersList({ data }: { data: any }) {
  const navigate = useNavigate();
  const folders = data.folders || [];
  if (!folders.length)
    return (
      <p className="text-xs text-muted-foreground italic py-2">
        No folders yet. Ask me to create one!
      </p>
    );
  return (
    <div className="mt-2 space-y-1.5 max-w-lg">
      {folders.map((f: any) => (
        <button
          key={f.id}
          className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-muted/50 border border-border/50 hover:border-primary/30 hover:bg-primary/5 transition-colors text-left"
          onClick={() => navigate("/app/gallery")}
        >
          <div className="gradient-primary rounded-lg p-1.5 shrink-0">
            <Folder className="h-4 w-4 text-primary-foreground" />
          </div>
          <p className="text-sm font-semibold truncate flex-1">{f.name}</p>
          <span className="text-[11px] text-muted-foreground shrink-0">
            {f.photo_count} photos
          </span>
        </button>
      ))}
    </div>
  );
}

function InfoChip({ data }: { data: any }) {
  return (
    <div className="mt-2 bg-muted/50 rounded-xl px-4 py-3 text-sm border border-border/50 max-w-lg">
      {data.message}
    </div>
  );
}

function RenderActionResult({
  result,
  onDeleteRequest,
}: {
  result: ActionResult;
  onDeleteRequest: (ids: number[], count: number, desc: string) => void;
}) {
  const { type, data } = result;

  switch (type) {
    case "photos":
    case "duplicates":
      return (
        <div className="animate-fade-in">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-muted-foreground mt-1">
            <ImageIcon className="h-3 w-3" />
            {data.person_name ? `Photos of ${data.person_name}` : data.context || "Results"}
            {(data.total > 0 || data.total_duplicates > 0) && (
              <span className="text-primary font-black">
                {data.showing ?? data.photos?.length} of {data.total ?? data.total_duplicates}
              </span>
            )}
          </div>
          <PhotoGrid photos={data.photos} />
          {type === "duplicates" && (
            <p className="text-[10px] text-amber-600 mt-1">
              <Copy className="h-3 w-3 inline mr-1" />
              {data.groups} duplicate groups found — ask me to "delete duplicates" to clean up.
            </p>
          )}
        </div>
      );

    case "delete_confirmation":
      return (
        <div className="animate-fade-in mt-2 p-3 rounded-xl border border-destructive/20 bg-destructive/5 max-w-lg">
          <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
            <Trash2 className="h-4 w-4" />
            Ready to delete {data.count} photos
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Filter: <strong>{data.description}</strong>
          </p>
          {data.preview?.length > 0 && <PhotoGrid photos={data.preview} />}
          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              variant="destructive"
              className="rounded-full text-xs"
              onClick={() => onDeleteRequest(data.photo_ids, data.count, data.description)}
            >
              <Trash2 className="h-3 w-3 mr-1" /> Confirm Delete
            </Button>
          </div>
        </div>
      );

    case "stats":
      return <StatsCard data={data} />;

    case "persons":
      return <PersonsList data={data} />;

    case "count":
      return <CountChip data={data} />;

    case "folder_created":
      return <FolderCreatedCard data={data} />;

    case "folders":
      return <FoldersList data={data} />;

    case "info":
    case "error":
      return <InfoChip data={data} />;

    default:
      return null;
  }
}

/* ─────────────────────────────────────────────────
   Main Component
   ───────────────────────────────────────────────── */

export default function ChatAssistant() {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [pendingDeletion, setPendingDeletion] = useState<PendingDeletion | null>(null);
  const [deleting, setDeleting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  /* ── delete confirmation flow ── */

  const handleDeleteRequest = (ids: number[], count: number, desc: string) => {
    setPendingDeletion({ photoIds: ids, count, description: desc });
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeletion) return;
    setDeleting(true);
    try {
      await batchDeletePhotos(pendingDeletion.photoIds);
      toast.success(`Deleted ${pendingDeletion.count} photos`);
      setMessages((prev) => [
        ...prev,
        {
          id: `m${Date.now()}`,
          role: "assistant",
          content: `✅ Successfully deleted **${pendingDeletion.count}** photos (${pendingDeletion.description}).`,
        },
      ]);
      setPendingDeletion(null);
    } catch {
      toast.error("Failed to delete photos");
    } finally {
      setDeleting(false);
    }
  };

  /* ── send message ── */

  const send = async (text: string) => {
    if (!text.trim() || typing) return;
    const userMsg: UIMessage = { id: `m${Date.now()}`, role: "user", content: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setTyping(true);

    try {
      const history: ChatMsg[] = messages.map((m) => ({ role: m.role, content: m.content }));
      const response = await sendChatMessage(text.trim(), history);

      const assistantMsg: UIMessage = {
        id: `m${Date.now() + 1}`,
        role: "assistant",
        content: response.content,
        actionResults: response.action_results?.length ? response.action_results : undefined,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `m${Date.now() + 1}`,
          role: "assistant",
          content: "Sorry, I couldn't process that. Please try again.",
        },
      ]);
    } finally {
      setTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] animate-fade-in relative">
      <div className="mb-4">
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Sparkles className="h-7 w-7 text-primary" />
          AI Assistant
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Search, analyze, manage, and clean up your photo library with natural language.
        </p>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 pr-2">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
            <div className="gradient-primary rounded-full p-5">
              <Sparkles className="h-10 w-10 text-primary-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">How can I help?</h3>
              <p className="text-sm text-muted-foreground mt-1">I can search, count, delete, and analyze your photos.</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {suggestions.map((s) => (
                <Button
                  key={s}
                  variant="outline"
                  size="sm"
                  className="rounded-full text-xs hover:bg-primary/10 transition-colors"
                  onClick={() => send(s)}
                >
                  {s}
                </Button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id}>
            <ChatMessage role={m.role} content={m.content} />
            {m.actionResults?.map((result, i) => (
              <div key={`${m.id}-action-${i}`} className="ml-11 mt-1">
                <RenderActionResult result={result} onDeleteRequest={handleDeleteRequest} />
              </div>
            ))}
          </div>
        ))}

        {typing && <TypingIndicator />}
      </div>

      {/* Deletion Confirmation Modal */}
      {pendingDeletion && (
        <div className="absolute inset-0 z-50 bg-background/60 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-sm shadow-2xl animate-scale-in border-destructive/20">
            <CardHeader className="text-center">
              <div className="mx-auto bg-destructive/10 rounded-full p-3 w-fit mb-2">
                <Trash2 className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle className="text-lg">Confirm Deletion</CardTitle>
            </CardHeader>
            <CardContent className="text-center py-0">
              <p className="text-sm text-muted-foreground">
                Delete <strong>{pendingDeletion.count}</strong>{" "}
                {pendingDeletion.count === 1 ? "photo" : "photos"} ({pendingDeletion.description})? This cannot be
                undone.
              </p>
            </CardContent>
            <CardFooter className="flex gap-2 mt-4 pt-4 border-t">
              <Button
                variant="destructive"
                className="flex-1 rounded-full"
                onClick={handleConfirmDelete}
                disabled={deleting}
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Yes, Delete
              </Button>
              <Button
                variant="outline"
                className="flex-1 rounded-full"
                onClick={() => setPendingDeletion(null)}
                disabled={deleting}
              >
                Cancel
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Suggestions (when there are messages) */}
      {messages.length > 0 && !pendingDeletion && (
        <div className="flex gap-2 overflow-x-auto py-2 no-scrollbar">
          {suggestions.map((s) => (
            <Button
              key={s}
              variant="outline"
              size="sm"
              className="rounded-full text-xs whitespace-nowrap shrink-0 hover:bg-primary/10"
              onClick={() => send(s)}
            >
              {s}
            </Button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2 pt-2 border-t border-border mt-2">
        <Input
          placeholder="Search photos, ask about people, find duplicates..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send(input)}
          className="bg-muted/50 border-0"
          disabled={!!pendingDeletion}
        />
        <Button
          className="gradient-primary text-primary-foreground rounded-full shrink-0"
          size="icon"
          onClick={() => send(input)}
          disabled={!input.trim() || typing || !!pendingDeletion}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
