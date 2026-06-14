import { useState, useCallback } from "react";
import { UploadMetadataPanel } from "@/components/UploadMetadataPanel";
import { uploadPhoto } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Upload,
  Image,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  Sparkles,
  Trash2,
  X,
  Tag,
  FolderOpen,
  Plus,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

interface QueueItem {
  file: File;
  preview: string;
  status: "pending" | "uploading" | "done" | "error";
}

const CATEGORIES = ["People", "Nature", "Animals", "Objects", "Travel", "Food", "Documents", "Other"];

export default function UploadPage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Batch metadata
  const [batchCategories, setBatchCategories] = useState<string[]>([]);
  const [batchTags, setBatchTags] = useState<string[]>([]);
  const [batchTagInput, setBatchTagInput] = useState("");
  const [showBatchMeta, setShowBatchMeta] = useState(false);

  /* ── file handling ── */

  const handleFiles = useCallback((fileList: FileList) => {
    const newFiles = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    newFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setQueue((prev) => [...prev, { file, preview: e.target?.result as string, status: "pending" }]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const removeFromQueue = (index: number) => {
    setQueue((prev) => prev.filter((_, i) => i !== index));
  };

  const clearDone = () => {
    setQueue((prev) => prev.filter((item) => item.status !== "done"));
  };

  /* ── single-file upload (from metadata panel) ── */

  const handleSaveSingle = async (file: File, categories: string[], tags: string[], faceNames: { name: string }[]) => {
    if (editingIndex === null) return;
    const idx = editingIndex;

    // Mark as uploading
    setQueue((prev) => prev.map((item, i) => (i === idx ? { ...item, status: "uploading" } : item)));

    try {
      const result = await uploadPhoto(file, categories, tags, faceNames);
      const facesMsg = result.faces_detected > 0 ? ` ${result.faces_detected} face(s) detected!` : "";
      toast.success(`Photo uploaded!${facesMsg}`);
      setQueue((prev) => prev.map((item, i) => (i === idx ? { ...item, status: "done" } : item)));
    } catch (err) {
      const error = err as Error;
      toast.error(error.message || "Upload failed");
      setQueue((prev) => prev.map((item, i) => (i === idx ? { ...item, status: "error" } : item)));
    }

    setEditingIndex(null);
  };

  /* ── bulk upload all pending ── */

  const handleUploadAll = async () => {
    setBulkUploading(true);
    const pendingIndices = queue
      .map((item, i) => (item.status === "pending" || item.status === "error" ? i : -1))
      .filter((i) => i >= 0);

    for (const idx of pendingIndices) {
      setQueue((prev) => prev.map((item, i) => (i === idx ? { ...item, status: "uploading" } : item)));
      try {
        await uploadPhoto(queue[idx].file, batchCategories, batchTags, []);
        setQueue((prev) => prev.map((item, i) => (i === idx ? { ...item, status: "done" } : item)));
      } catch {
        setQueue((prev) => prev.map((item, i) => (i === idx ? { ...item, status: "error" } : item)));
      }
    }

    const successCount = pendingIndices.length;
    if (successCount > 0) {
      toast.success(`Uploaded ${successCount} photo(s)!`);
    }
    setBulkUploading(false);
  };

  /* ── derived state ── */

  const pendingCount = queue.filter((q) => q.status === "pending" || q.status === "error").length;
  const doneCount = queue.filter((q) => q.status === "done").length;

  /* ── metadata panel (editing a single file) ── */

  if (editingIndex !== null && queue[editingIndex]) {
    const item = queue[editingIndex];
    return (
      <div className="max-w-5xl mx-auto space-y-4 animate-fade-in">
        <Button
          variant="ghost"
          size="sm"
          className="rounded-full gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={() => setEditingIndex(null)}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to queue ({queue.length} files)
        </Button>
        <UploadMetadataPanel
          file={item.file}
          preview={item.preview}
          onSave={handleSaveSingle}
          onCancel={() => setEditingIndex(null)}
          uploading={item.status === "uploading"}
        />
      </div>
    );
  }

  /* ── main queue view ── */

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Upload Photos</h1>
        <p className="text-muted-foreground mt-1">Add new photos to your library.</p>
      </div>

      {/* Dropzone */}
      <div
        className={cn(
          "border-2 border-dashed rounded-2xl p-12 text-center transition-colors cursor-pointer",
          dragOver ? "border-primary bg-accent" : "border-border hover:border-primary/50 hover:bg-accent/50"
        )}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => {
          const input = document.createElement("input");
          input.type = "file";
          input.multiple = true;
          input.accept = "image/*";
          input.onchange = (e) => handleFiles((e.target as HTMLInputElement).files!);
          input.click();
        }}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="gradient-primary rounded-full p-4">
            <Upload className="h-8 w-8 text-primary-foreground" />
          </div>
          <div>
            <p className="font-semibold text-lg">Drop photos here or click to browse</p>
            <p className="text-sm text-muted-foreground mt-1">Supports JPG, PNG, WebP up to 10MB</p>
          </div>
        </div>
      </div>

      {/* Queue */}
      {queue.length > 0 && (
        <div className="space-y-4">
          {/* Action bar */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm font-medium">
              {queue.length} file(s) — {pendingCount} pending{doneCount > 0 ? `, ${doneCount} uploaded` : ""}
            </p>
            <div className="flex gap-2">
              {doneCount > 0 && (
                <Button variant="outline" size="sm" className="rounded-full text-xs gap-1" onClick={clearDone}>
                  <X className="h-3 w-3" /> Clear done
                </Button>
              )}
              {pendingCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full text-xs gap-1"
                  onClick={() => setShowBatchMeta(!showBatchMeta)}
                >
                  <Tag className="h-3 w-3" />
                  Batch Metadata
                  {showBatchMeta ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </Button>
              )}
              {pendingCount > 0 && (
                <Button
                  size="sm"
                  className="rounded-full text-xs gap-1.5 gradient-primary text-primary-foreground"
                  onClick={handleUploadAll}
                  disabled={bulkUploading}
                >
                  {bulkUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  Upload All ({pendingCount})
                </Button>
              )}
            </div>
          </div>

          {/* Batch Metadata Panel */}
          {showBatchMeta && pendingCount > 0 && (
            <Card className="border-primary/20 bg-primary/5 animate-fade-in">
              <CardContent className="p-4 space-y-4">
                <p className="text-xs font-semibold text-primary uppercase tracking-wider">Apply to all photos on Upload All</p>

                {/* Categories */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold flex items-center gap-1.5">
                    <FolderOpen className="h-3.5 w-3.5" /> Categories
                  </Label>
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {CATEGORIES.map((cat) => (
                      <label key={cat} className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <Checkbox
                          checked={batchCategories.includes(cat)}
                          onCheckedChange={(checked) =>
                            setBatchCategories((prev) =>
                              checked ? [...prev, cat] : prev.filter((c) => c !== cat)
                            )
                          }
                        />
                        {cat}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Tags */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5" /> Tags
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add a tag and press Enter"
                      value={batchTagInput}
                      onChange={(e) => setBatchTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && batchTagInput.trim()) {
                          e.preventDefault();
                          if (!batchTags.includes(batchTagInput.trim())) {
                            setBatchTags((prev) => [...prev, batchTagInput.trim()]);
                          }
                          setBatchTagInput("");
                        }
                      }}
                      className="text-xs h-8"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-2"
                      onClick={() => {
                        if (batchTagInput.trim() && !batchTags.includes(batchTagInput.trim())) {
                          setBatchTags((prev) => [...prev, batchTagInput.trim()]);
                        }
                        setBatchTagInput("");
                      }}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  {batchTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {batchTags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs gap-1 cursor-pointer" onClick={() => setBatchTags((prev) => prev.filter((t) => t !== tag))}>
                          #{tag}
                          <X className="h-2.5 w-2.5" />
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {(batchCategories.length > 0 || batchTags.length > 0) && (
                  <p className="text-[10px] text-muted-foreground italic">
                    ✓ Will apply <strong>{batchCategories.length}</strong> categories and <strong>{batchTags.length}</strong> tags to all {pendingCount} photos
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Thumbnail grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {queue.map((item, i) => (
              <div
                key={i}
                className={cn(
                  "group relative aspect-square rounded-xl overflow-hidden bg-muted cursor-pointer ring-2 transition-all",
                  item.status === "done"
                    ? "ring-emerald-500/50 opacity-70"
                    : item.status === "uploading"
                      ? "ring-primary/50 animate-pulse"
                      : item.status === "error"
                        ? "ring-destructive/50"
                        : "ring-transparent hover:ring-primary/50"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  if (item.status === "pending" || item.status === "error") {
                    setEditingIndex(i);
                  }
                }}
              >
                <img src={item.preview} alt={`Preview ${i + 1}`} className="w-full h-full object-cover" />

                {/* Status overlay */}
                {item.status === "done" && (
                  <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                  </div>
                )}
                {item.status === "uploading" && (
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 text-white animate-spin" />
                  </div>
                )}
                {item.status === "error" && (
                  <div className="absolute inset-0 bg-destructive/20 flex items-center justify-center">
                    <span className="text-[10px] text-destructive font-bold bg-white/80 rounded px-1">FAILED</span>
                  </div>
                )}

                {/* Hover: edit / remove */}
                {(item.status === "pending" || item.status === "error") && (
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-white" />
                    <span className="text-[10px] text-white font-bold uppercase tracking-wider">Edit & Upload</span>
                    <button
                      className="absolute top-1 right-1 bg-white/90 text-destructive rounded-full p-0.5 hover:bg-white"
                      onClick={(e) => { e.stopPropagation(); removeFromQueue(i); }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Tip */}
          <p className="text-xs text-muted-foreground text-center italic">
            💡 Click a photo to add metadata before uploading, or use <strong>Upload All</strong> for quick batch upload.
          </p>
        </div>
      )}

      {queue.length === 0 && (
        <div className="flex items-center justify-center gap-2 text-muted-foreground py-8">
          <Image className="h-5 w-5" />
          <span className="text-sm">No photos selected yet</span>
        </div>
      )}
    </div>
  );
}
