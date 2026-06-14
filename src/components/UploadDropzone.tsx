import { Upload, Image } from "lucide-react";
import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";

interface UploadDropzoneProps {
  onFileSelected?: (file: File, preview: string) => void;
}

export function UploadDropzone({ onFileSelected }: UploadDropzoneProps) {
  const [previews, setPreviews] = useState<{ file: File; src: string }[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = useCallback((fileList: FileList) => {
    const newFiles = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    newFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviews((prev) => [...prev, { file, src: e.target?.result as string }]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  return (
    <div className="space-y-6">
      <div
        className={cn(
          "border-2 border-dashed rounded-2xl p-12 text-center transition-colors cursor-pointer",
          dragOver ? "border-primary bg-accent" : "border-border hover:border-primary/50 hover:bg-accent/50"
        )}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
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

      {previews.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{previews.length} file(s) selected — click a photo to add metadata and upload</p>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {previews.map((item, i) => (
              <div
                key={i}
                className="aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer ring-2 ring-transparent hover:ring-primary/50 transition-all"
                onClick={(e) => {
                  e.stopPropagation();
                  onFileSelected?.(item.file, item.src);
                }}
              >
                <img src={item.src} alt={`Preview ${i + 1}`} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}

      {previews.length === 0 && (
        <div className="flex items-center justify-center gap-2 text-muted-foreground py-8">
          <Image className="h-5 w-5" />
          <span className="text-sm">No photos selected yet</span>
        </div>
      )}
    </div>
  );
}
