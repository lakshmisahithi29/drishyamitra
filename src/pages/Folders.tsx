import { useState, useEffect, useCallback } from "react";
import { FolderCard } from "@/components/FolderCard";
import { PhotoCard } from "@/components/PhotoCard";
import { ModalViewer } from "@/components/ModalViewer";
import { Button } from "@/components/ui/button";
import {
    fetchFolders,
    fetchFolder,
    deleteFolder,
    type Folder,
    type Photo,
} from "@/lib/api";
import {
    FolderOpen,
    ChevronLeft,
    Loader2,
    MessageCircle,
    Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Folders() {
    const navigate = useNavigate();
    const [folders, setFolders] = useState<Folder[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
    const [folderLoading, setFolderLoading] = useState(false);
    const [viewerIndex, setViewerIndex] = useState<number | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Folder | null>(null);
    const [deleting, setDeleting] = useState(false);

    const loadFolders = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchFolders();
            setFolders(data);
        } catch {
            toast.error("Failed to load folders");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadFolders();
    }, [loadFolders]);

    const openFolder = async (folder: Folder) => {
        setFolderLoading(true);
        setSelectedFolder(folder);
        try {
            const detailed = await fetchFolder(folder.id);
            setSelectedFolder(detailed);
        } catch {
            toast.error("Failed to load folder contents");
        } finally {
            setFolderLoading(false);
        }
    };

    const closeFolder = () => {
        setSelectedFolder(null);
        setViewerIndex(null);
    };

    const handleDeleteRequest = (e: React.MouseEvent, folder: Folder) => {
        e.stopPropagation();
        setDeleteTarget(folder);
    };

    const handleConfirmDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await deleteFolder(deleteTarget.id);
            setFolders((prev) => prev.filter((f) => f.id !== deleteTarget.id));
            if (selectedFolder?.id === deleteTarget.id) closeFolder();
            toast.success(`Folder "${deleteTarget.name}" deleted`);
        } catch {
            toast.error("Failed to delete folder");
        } finally {
            setDeleting(false);
            setDeleteTarget(null);
        }
    };

    const photos: Photo[] = (selectedFolder?.photos ?? []) as Photo[];

    /* ─── Detail View ─── */
    if (selectedFolder !== null) {
        return (
            <div className="space-y-6 animate-fade-in">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-full gap-1.5"
                        onClick={closeFolder}
                    >
                        <ChevronLeft className="h-4 w-4" />
                        Back
                    </Button>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <div className="gradient-primary rounded-lg p-1.5">
                                <FolderOpen className="h-5 w-5 text-primary-foreground" />
                            </div>
                            <h1 className="text-2xl font-bold truncate">{selectedFolder.name}</h1>
                        </div>
                        <p className="text-muted-foreground text-sm mt-0.5 ml-11">
                            {selectedFolder.photo_count ?? photos.length} photos
                        </p>
                    </div>

                    <Button
                        size="sm"
                        variant="destructive"
                        className="rounded-full gap-1.5 shrink-0"
                        onClick={(e) => handleDeleteRequest(e, selectedFolder)}
                    >
                        <Trash2 className="h-4 w-4" />
                        Delete Folder
                    </Button>
                </div>

                {/* Photos grid */}
                {folderLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : photos.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                        {photos.map((photo, i) => (
                            <PhotoCard
                                key={photo.id}
                                id={photo.id}
                                url={photo.url}
                                title={photo.title}
                                isFavorite={photo.is_favorite}
                                onClick={() => setViewerIndex(i)}
                                onChanged={() => openFolder(selectedFolder)}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="gradient-primary rounded-full p-4 mb-4 opacity-60">
                            <FolderOpen className="h-8 w-8 text-primary-foreground" />
                        </div>
                        <h3 className="font-semibold text-lg">This folder is empty</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            Photos added via the Chat Assistant will appear here.
                        </p>
                    </div>
                )}

                {viewerIndex !== null && (
                    <ModalViewer
                        images={photos}
                        currentIndex={viewerIndex}
                        onClose={() => setViewerIndex(null)}
                        onNavigate={setViewerIndex}
                    />
                )}
            </div>
        );
    }

    /* ─── List View ─── */
    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h1 className="text-2xl md:text-3xl font-bold">Folders</h1>
                <p className="text-muted-foreground mt-1">
                    Organize your photos into collections.
                </p>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : folders.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {folders.map((folder) => (
                        <FolderCard
                            key={folder.id}
                            folder={folder}
                            onClick={() => openFolder(folder)}
                            onDelete={(e) => handleDeleteRequest(e, folder)}
                        />
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                    <div className="gradient-primary rounded-full p-5 mb-5">
                        <FolderOpen className="h-10 w-10 text-primary-foreground" />
                    </div>
                    <h3 className="font-semibold text-xl mb-2">No folders yet</h3>
                    <p className="text-muted-foreground text-sm max-w-xs mb-6">
                        Ask the AI Chat Assistant to create a folder for you. For example:
                    </p>
                    <div className="flex flex-col gap-2 text-sm text-left bg-muted/50 rounded-2xl p-4 border border-border max-w-sm w-full">
                        <code className="text-primary font-medium">
                            "Create a folder named 'Exam Papers' with all my exam photos"
                        </code>
                        <code className="text-primary font-medium">
                            "Make a folder called 'Favorites' with my starred photos"
                        </code>
                    </div>
                    <Button
                        className="mt-6 gradient-primary text-primary-foreground rounded-full gap-2"
                        onClick={() => navigate("/app/chat")}
                    >
                        <MessageCircle className="h-4 w-4" />
                        Open Chat Assistant
                    </Button>
                </div>
            )}

            {/* Delete confirmation dialog */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete folder?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will delete the folder <strong>"{deleteTarget?.name}"</strong> but won't delete the photos inside it. This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmDelete}
                            disabled={deleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Delete Folder
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
