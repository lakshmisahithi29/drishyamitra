import { Heart, Trash2, Expand } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { toggleFavorite, deletePhoto, resolveUrl } from "@/lib/api";
import { toast } from "sonner";

interface PhotoCardProps {
  id: number;
  url: string;
  title: string;
  isFavorite?: boolean;
  hideDelete?: boolean;
  onClick?: () => void;
  onChanged?: () => void;
}

export function PhotoCard({ id, url, title, isFavorite = false, hideDelete = false, onClick, onChanged }: PhotoCardProps) {
  const [fav, setFav] = useState(isFavorite);
  const [deleting, setDeleting] = useState(false);

  const handleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const updated = await toggleFavorite(id);
      setFav(updated.is_favorite);
      onChanged?.();
    } catch {
      toast.error("Failed to update favorite");
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (deleting) return;
    setDeleting(true);
    try {
      await deletePhoto(id);
      toast.success("Photo deleted");
      onChanged?.();
    } catch {
      toast.error("Failed to delete photo");
      setDeleting(false);
    }
  };

  return (
    <div
      className={cn(
        "group relative rounded-xl overflow-hidden bg-muted aspect-[4/3] cursor-pointer transition-transform duration-200 hover:scale-[1.02] hover:shadow-lg",
        deleting && "opacity-50 pointer-events-none"
      )}
      onClick={onClick}
    >
      <img src={resolveUrl(url)} alt={title} className="w-full h-full object-cover" loading="lazy" />
      <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
      <div className="absolute bottom-0 left-0 right-0 p-3 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <span className="text-primary-foreground text-sm font-medium truncate">{title}</span>
        <div className="flex gap-1">
          <button
            onClick={handleFavorite}
            className="p-1.5 rounded-full bg-background/20 backdrop-blur-sm hover:bg-background/40 transition-colors"
          >
            <Heart className={cn("h-4 w-4", fav ? "fill-red-500 text-red-500" : "text-primary-foreground")} />
          </button>
          {!hideDelete && (
            <button
              onClick={handleDelete}
              className="p-1.5 rounded-full bg-background/20 backdrop-blur-sm hover:bg-background/40 transition-colors"
            >
              <Trash2 className="h-4 w-4 text-primary-foreground" />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onClick?.(); }}
            className="p-1.5 rounded-full bg-background/20 backdrop-blur-sm hover:bg-background/40 transition-colors"
          >
            <Expand className="h-4 w-4 text-primary-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}
