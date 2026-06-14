import { Folder, Trash2, Images } from "lucide-react";
import { type Folder as FolderType, resolveUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FolderCardProps {
    folder: FolderType;
    onClick: () => void;
    onDelete: (e: React.MouseEvent) => void;
}

export function FolderCard({ folder, onClick, onDelete }: FolderCardProps) {
    const thumbs = (folder.photos ?? []).slice(0, 4);

    return (
        <div
            onClick={onClick}
            className={cn(
                "group relative flex flex-col rounded-2xl border border-border bg-card",
                "hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5",
                "transition-all duration-200 cursor-pointer overflow-hidden"
            )}
        >
            {/* Thumbnail strip */}
            <div className="relative h-36 bg-muted/50 overflow-hidden">
                {thumbs.length > 0 ? (
                    <div className={cn("grid h-full", thumbs.length === 1 ? "grid-cols-1" : thumbs.length === 2 ? "grid-cols-2" : "grid-cols-2 grid-rows-2")}>
                        {thumbs.map((p: any) => (
                            <div key={p.id} className="overflow-hidden">
                                <img
                                    src={resolveUrl(`/uploads/${p.user_id}/${p.filename}`)}
                                    alt={p.original_filename}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    loading="lazy"
                                />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full">
                        <div className="gradient-primary rounded-2xl p-4 opacity-40">
                            <Images className="h-10 w-10 text-primary-foreground" />
                        </div>
                    </div>
                )}

                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-card/80 via-transparent to-transparent" />

                {/* Delete button */}
                <Button
                    size="icon"
                    variant="destructive"
                    className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity rounded-full shadow-md"
                    onClick={onDelete}
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            </div>

            {/* Info */}
            <div className="flex items-center gap-3 p-3">
                <div className="gradient-primary rounded-lg p-1.5 shrink-0">
                    <Folder className="h-4 w-4 text-primary-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">{folder.name}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                        {folder.photo_count} {folder.photo_count === 1 ? "photo" : "photos"}
                    </p>
                </div>
            </div>
        </div>
    );
}
