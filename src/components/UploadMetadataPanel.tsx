import { useState, useCallback, useRef, useEffect } from "react";
import ReactCrop, { Crop as ReactCropType, PixelCrop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import getCroppedImg from "@/lib/cropImage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Users,
  Tag,
  FolderOpen,
  Info,
  Plus,
  X,
  UserPlus,
  Save,
  Loader2,
  Check,
  AlertTriangle,
  Sparkles,
  Crop,
  Maximize,
  Edit2,
} from "lucide-react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { analyzePhoto } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
// Slider removed as react-image-crop doesn't use it the same way

const CATEGORIES = [
  "People",
  "Nature",
  "Animals",
  "Objects",
  "Travel",
  "Food",
  "Documents",
  "Other",
];

interface DetectedFace {
  id: string;
  name: string;
}

interface UploadMetadataPanelProps {
  file: File;
  preview: string;
  onSave: (
    file: File,
    categories: string[],
    tags: string[],
    faceNames: { name: string }[]
  ) => void;
  onCancel: () => void;
  uploading?: boolean;
}

export function UploadMetadataPanel({
  file,
  preview,
  onSave,
  onCancel,
  uploading = false,
}: UploadMetadataPanelProps) {
  // Local state for the file (in case of cropping)
  const [currentFile, setCurrentFile] = useState<File>(file);
  const [currentPreview, setCurrentPreview] = useState<string>(preview);

  const [faces, setFaces] = useState<DetectedFace[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [newPersonName, setNewPersonName] = useState("");
  const [showNewPerson, setShowNewPerson] = useState(false);

  // Renaming state
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempFileName, setTempFileName] = useState(currentFile.name.replace(/\.[^/.]+$/, ""));

  // Cropping state
  const [showCropper, setShowCropper] = useState(false);
  const [crop, setCrop] = useState<ReactCropType>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [scale, setScale] = useState(1);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Auto-analysis on file change (initial selection or after crop)
  useEffect(() => {
    let isMounted = true;

    const runAnalysis = async () => {
      setIsAnalyzing(true);
      try {
        const result = await analyzePhoto(currentFile);
        if (isMounted) {
          // Map backend person info to our faces state
          const detectedFaces = result.faces.map((f: any, idx: number) => ({
            id: `auto-${idx}-${Date.now()}`,
            name: f.person?.name || ""
          }));

          setFaces(detectedFaces);
          setIsDuplicate(result.is_duplicate);
        }
      } catch (err) {
        console.error("Auto-analysis failed:", err);
      } finally {
        if (isMounted) setIsAnalyzing(false);
      }
    };

    runAnalysis();

    return () => {
      isMounted = false;
    };
  }, [currentFile]);

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const initialCrop = centerCrop(
      makeAspectCrop(
        {
          unit: "%",
          width: 90,
        },
        undefined, // Free aspect
        width,
        height
      ),
      width,
      height
    );
    setCrop(initialCrop);
  };

  const handleApplyCrop = async () => {
    try {
      if (completedCrop && currentPreview) {
        const croppedBlobResult = await getCroppedImg(currentPreview, completedCrop);
        if (croppedBlobResult) {
          const croppedFile = new File([croppedBlobResult], currentFile.name, {
            type: "image/jpeg",
          });
          const newPreview = URL.createObjectURL(croppedBlobResult);
          setCurrentFile(croppedFile);
          setCurrentPreview(newPreview);
          setShowCropper(false);
          setCompletedCrop(undefined);
        }
      }
    } catch (e) {
      console.error("Cropping error:", e);
    }
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const addTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags((prev) => [...prev, trimmed]);
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  };

  const updateFaceName = (id: string, name: string) => {
    setFaces((prev) => prev.map((f) => (f.id === id ? { ...f, name } : f)));
  };

  const addNewPerson = () => {
    const trimmed = newPersonName.trim();
    if (trimmed) {
      setFaces((prev) => [...prev, { id: `f-${Date.now()}`, name: trimmed }]);
      setNewPersonName("");
      setShowNewPerson(false);
    }
  };

  const handleRename = () => {
    if (tempFileName.trim()) {
      const ext = currentFile.name.slice((currentFile.name.lastIndexOf(".") - 1 >>> 0) + 2);
      const newName = tempFileName.trim() + (ext ? `.${ext}` : "");
      const renamedFile = new File([currentFile], newName, { type: currentFile.type });
      setCurrentFile(renamedFile);
      setIsEditingName(false);
    }
  };

  const handleSave = () => {
    const faceNames = faces
      .filter((f) => f.name.trim())
      .map((f) => ({ name: f.name.trim() }));
    onSave(currentFile, selectedCategories, tags, faceNames);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in items-start -mt-4">
      {/* Left: Image Preview (Sticky-ish) */}
      <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-6 lg:sticky lg:top-4">
        <div className="w-full rounded-[2rem] overflow-hidden border-4 border-white/20 bg-black/5 shadow-2xl flex items-center justify-center min-h-[450px] relative glass-morphism backdrop-blur-sm">
          <img
            src={currentPreview}
            alt={currentFile.name}
            className="max-w-full max-h-[75vh] object-contain shadow-2xl rounded-2xl transition-all duration-500 hover:scale-[1.01]"
          />
          <Button
            variant="secondary"
            size="sm"
            className="absolute bottom-6 right-6 gap-2 shadow-xl backdrop-blur-xl bg-background/60 hover:bg-primary hover:text-primary-foreground transition-all duration-300 rounded-full px-5 py-6 border border-white/20"
            onClick={() => setShowCropper(true)}
          >
            <Crop className="h-5 w-5" />
            <span className="font-semibold text-sm">Crop & Resize</span>
          </Button>
        </div>

        <div className="flex items-center justify-between px-4 py-3 bg-white/5 rounded-2xl border border-white/10 glass-morphism">
          <div className="flex-1 mr-4">
            {isEditingName ? (
              <div className="flex items-center gap-2 animate-scale-in">
                <Input
                  value={tempFileName}
                  onChange={(e) => setTempFileName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleRename()}
                  className="h-9 bg-background/50 border-primary/30"
                  autoFocus
                />
                <Button size="sm" onClick={handleRename} className="h-9 w-9 p-0 gradient-primary">
                  <Check className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setIsEditingName(false)} className="h-9 w-9 p-0">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setIsEditingName(true)}>
                <p className="text-lg font-bold tracking-tight text-foreground/90">{currentFile.name}</p>
                <Edit2 className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}
            <p className="text-xs font-medium text-muted-foreground mt-0.5">
              {(currentFile.size / 1024 / 1024).toFixed(2)} MB •{" "}
              <span className="uppercase">{currentFile.type.split('/')[1] || "Image"}</span>
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={uploading}
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors rounded-full px-4"
          >
            <X className="h-4 w-4 mr-2" />
            Discard
          </Button>
        </div>
      </div>

      {/* Right: Metadata Panel */}
      <div className="lg:col-span-5 xl:col-span-4 space-y-6 pt-2">
        {isDuplicate && (
          <Alert variant="destructive" className="rounded-2xl bg-destructive/10 border-destructive/20 animate-bounce-subtle">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="text-sm font-bold">Possible Duplicate</AlertTitle>
            <AlertDescription className="text-xs">
              This photo looks exactly like one already in your library.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-1.5 pb-2">
          <h2 className="text-2xl font-black flex items-center gap-3 tracking-tight italic">
            <Sparkles className="h-6 w-6 text-primary animate-pulse" />
            ENHANCE PHOTO
          </h2>
          <p className="text-sm font-medium text-muted-foreground">
            Enrich your memories with AI-powered metadata.
          </p>
        </div>

        {/* Faces Section */}
        <Card className="border-border/40 shadow-xl overflow-hidden rounded-3xl glass-morphism border-t-white/10">
          <CardHeader className="py-4 px-5 bg-primary/5 border-b border-white/5">
            <CardTitle className="text-sm font-black flex items-center gap-2 tracking-widest uppercase">
              <Users className="h-4 w-4 text-primary" />
              People Detected
              {isAnalyzing && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            {isAnalyzing && faces.length === 0 && (
              <div className="flex flex-col items-center justify-center py-4 gap-2 text-muted-foreground animate-pulse">
                <Sparkles className="h-5 w-5 animate-spin" />
                <p className="text-[10px] font-bold uppercase tracking-widest">AI Analyzing...</p>
              </div>
            )}
            {!isAnalyzing && faces.length === 0 && !showNewPerson && (
              <p className="text-xs text-muted-foreground italic">
                Who is in this photo?
              </p>
            )}
            <div className="space-y-2">
              {faces.map((face) => (
                <div
                  key={face.id}
                  className="flex items-center gap-2 animate-slide-in"
                >
                  <div className="h-8 w-8 rounded-full gradient-primary flex items-center justify-center text-primary-foreground text-[10px] font-bold shrink-0">
                    {face.name ? face.name[0].toUpperCase() : "?"}
                  </div>
                  <Input
                    placeholder="Enter person name..."
                    value={face.name}
                    onChange={(e) => updateFaceName(face.id, e.target.value)}
                    className="h-8 text-xs bg-muted/20 border-border/50 focus:border-primary/30"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() =>
                      setFaces((prev) => prev.filter((f) => f.id !== face.id))
                    }
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            {showNewPerson ? (
              <div className="flex items-center gap-2 animate-scale-in">
                <Input
                  placeholder="New person name..."
                  value={newPersonName}
                  onChange={(e) => setNewPersonName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addNewPerson()}
                  className="h-8 text-xs"
                  autoFocus
                />
                <Button
                  size="sm"
                  onClick={addNewPerson}
                  className="h-8 px-2 shrink-0 gradient-primary text-primary-foreground"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowNewPerson(false)}
                  className="h-8 w-8 p-0 shrink-0"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowNewPerson(true)}
                className="w-full h-8 gap-1.5 text-xs text-muted-foreground hover:text-primary hover:border-primary/30 dashed-border"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Add Person
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Categories Section */}
        <Card className="border-border/40 shadow-xl overflow-hidden rounded-3xl glass-morphism border-t-white/10">
          <CardHeader className="py-4 px-5 bg-primary/5 border-b border-white/5">
            <CardTitle className="text-sm font-black flex items-center gap-2 tracking-widest uppercase">
              <FolderOpen className="h-4 w-4 text-primary" />
              Categories
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <div className="flex flex-wrap gap-2.5">
              {CATEGORIES.map((cat) => {
                const checked = selectedCategories.includes(cat);
                return (
                  <label
                    key={cat}
                    className={`inline-flex items-center gap-2 cursor-pointer rounded-full border px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all duration-300 transform hover:scale-105 active:scale-95 ${checked
                      ? "border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                      : "border-white/10 bg-white/5 text-muted-foreground hover:border-primary/40 hover:bg-white/10 hover:text-foreground"
                      }`}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleCategory(cat)}
                      className="hidden"
                    />
                    {cat}
                  </label>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Tags Section */}
        <Card className="border-border/40 shadow-xl overflow-hidden rounded-3xl glass-morphism border-t-white/10">
          <CardHeader className="py-4 px-5 bg-primary/5 border-b border-white/5">
            <CardTitle className="text-sm font-black flex items-center gap-2 tracking-widest uppercase">
              <Tag className="h-4 w-4 text-primary" />
              Custom Tags
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-5">
            <div className="flex gap-2.5">
              <Input
                placeholder="Type tag and press Enter..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTag()}
                className="h-10 text-sm bg-white/5 border-white/10 rounded-xl focus:ring-primary/20"
              />
              <Button
                size="sm"
                onClick={addTag}
                className="h-10 w-10 p-0 shrink-0 gradient-primary rounded-xl shadow-lg shadow-primary/20"
              >
                <Plus className="h-5 w-5" />
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 underline-offset-4">
                {tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="gap-2 pl-3 pr-2 py-1.5 cursor-pointer bg-white/5 hover:bg-destructive/10 hover:text-destructive transition-all duration-200 border border-white/5 rounded-lg group text-xs font-semibold"
                    onClick={() => removeTag(tag)}
                  >
                    {tag}
                    <X className="h-3.5 w-3.5 opacity-50 group-hover:opacity-100 transition-opacity" />
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-col gap-4 pt-6">
          <Button
            onClick={handleSave}
            disabled={uploading}
            className="w-full py-8 text-lg font-black gradient-primary text-primary-foreground gap-4 rounded-[1.5rem] shadow-2xl hover:shadow-primary/40 transition-all duration-300 hover:scale-[1.02] active:scale-95 border-t border-white/20 uppercase tracking-tighter italic"
          >
            {uploading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <Save className="h-6 w-6" />
            )}
            {uploading ? "Analyzing Photo..." : "Finalize Upload"}
          </Button>
          <Button
            variant="ghost"
            onClick={onCancel}
            disabled={uploading}
            className="w-full py-6 text-muted-foreground hover:bg-white/5 rounded-xl transition-all font-medium"
          >
            Discard Session
          </Button>
        </div>
      </div>

      {/* Cropper Dialog */}
      <Dialog open={showCropper} onOpenChange={setShowCropper}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-background">
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Maximize className="h-5 w-5 text-primary" />
              Adjust Crop Area
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 bg-muted/30 p-8 flex items-center justify-center min-h-[50vh] max-h-[65vh] relative overflow-auto custom-scrollbar">
            {currentPreview && (
              <div
                className="relative transition-all duration-200 ease-out flex items-center justify-center min-w-full"
                style={{ width: `${scale * 100}%` }}
              >
                <ReactCrop
                  crop={crop}
                  onChange={(c) => setCrop(c)}
                  onComplete={(c) => setCompletedCrop(c)}
                  className="max-w-full max-h-full"
                >
                  <img
                    ref={imgRef}
                    alt="Crop preview"
                    src={currentPreview}
                    onLoad={onImageLoad}
                    className="max-w-full shadow-2xl rounded-sm"
                    style={{ maxHeight: scale > 1 ? 'none' : '60vh' }}
                  />
                </ReactCrop>
              </div>
            )}
          </div>
          <div className="p-4 bg-muted/10 border-t flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 w-full sm:w-64">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground w-12 text-center">Zoom</span>
              <Slider
                value={[scale]}
                min={0.5}
                max={2}
                step={0.05}
                onValueChange={([v]) => setScale(v)}
                className="flex-1"
              />
              <span className="text-[10px] font-mono text-muted-foreground w-10">{Math.round(scale * 100)}%</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <p className="hidden md:block italic">Drag handles to resize • Drag center to move</p>
              {completedCrop && (
                <div className="px-3 py-1 bg-primary/10 rounded-full border border-primary/20 text-primary font-bold font-mono">
                  {Math.round(completedCrop.width)} × {Math.round(completedCrop.height)} px
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="p-4 border-t gap-3 bg-muted/5">
            <Button variant="ghost" onClick={() => setShowCropper(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button
              onClick={handleApplyCrop}
              className="gradient-primary text-primary-foreground min-w-[140px] rounded-xl shadow-lg shadow-primary/20 font-bold uppercase tracking-wider text-xs"
              disabled={!completedCrop || completedCrop.width === 0}
            >
              Apply Selection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
