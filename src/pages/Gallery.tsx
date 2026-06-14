import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PhotoCard } from "@/components/PhotoCard";
import { FolderCard } from "@/components/FolderCard";
import { ModalViewer } from "@/components/ModalViewer";
import {
  fetchPhotos,
  fetchFolders,
  fetchFolder,
  deleteFolder,
  type Photo,
  type Folder,
} from "@/lib/api";
import {
  Search,
  Users,
  Calendar,
  Heart,
  Loader2,
  FolderOpen,
  ChevronLeft,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
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
import { useNavigate } from "react-router-dom";

const filters = [
  { label: "People", icon: Users },
  { label: "Date", icon: Calendar },
  { label: "Favorites", icon: Heart },
  { label: "Folders", icon: FolderOpen },
];

export default function Gallery() {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);

  // Folder state
  const [folders, setFolders] = useState<Folder[]>([]);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
  const [folderDetailLoading, setFolderDetailLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Folder | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isFoldersView = activeFilter === "Folders";

  // ─── Load photos ───
  const loadPhotos = useCallback(async () => {
    if (isFoldersView) return;
    setLoading(true);
    try {
      const res = await fetchPhotos({
        search: search || undefined,
        favorites: activeFilter === "Favorites" ? true : undefined,
        per_page: 100,
      });
      setPhotos(res.photos);
    } catch {
      setPhotos([]);
    } finally {
      setLoading(false);
    }
  }, [search, activeFilter, isFoldersView]);

  useEffect(() => {
    const timer = setTimeout(loadPhotos, 300);
    return () => clearTimeout(timer);
  }, [loadPhotos]);

  // ─── Load folders when Folders tab is active ───
  const loadFolders = useCallback(async () => {
    setFoldersLoading(true);
    try {
      const data = await fetchFolders();
      setFolders(data);
    } catch {
      toast.error("Failed to load folders");
    } finally {
      setFoldersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isFoldersView) {
      loadFolders();
      setSelectedFolder(null);
    }
  }, [isFoldersView, loadFolders]);

  // ─── Folder actions ───
  const openFolder = async (folder: Folder) => {
    setFolderDetailLoading(true);
    setSelectedFolder(folder);
    try {
      const detailed = await fetchFolder(folder.id);
      setSelectedFolder(detailed);
    } catch {
      toast.error("Failed to load folder contents");
    } finally {
      setFolderDetailLoading(false);
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

  const handlePhotoChange = () => {
    loadPhotos();
  };

  const folderPhotos: Photo[] = (selectedFolder?.photos ?? []) as Photo[];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ─── Folder Detail View ─── */}
      {isFoldersView && selectedFolder ? (
        <>
          {/* Detail header */}
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
                {selectedFolder.photo_count ?? folderPhotos.length} photos
              </p>
            </div>
            <Button
              size="sm"
              variant="destructive"
              className="rounded-full gap-1.5 shrink-0"
              onClick={(e) => handleDeleteRequest(e, selectedFolder)}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>

          {folderDetailLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : folderPhotos.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {folderPhotos.map((photo, i) => (
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
              images={folderPhotos}
              currentIndex={viewerIndex}
              onClose={() => setViewerIndex(null)}
              onNavigate={setViewerIndex}
            />
          )}
        </>
      ) : (
        <>
          {/* ─── Normal Gallery + Folder List ─── */}
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Gallery</h1>
            <p className="text-muted-foreground mt-1">Browse and manage your photos.</p>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search photos..."
                className="pl-9 bg-muted/50 border-0"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={isFoldersView}
              />
            </div>
            <div className="flex gap-2">
              {filters.map((f) => (
                <Button
                  key={f.label}
                  variant={activeFilter === f.label ? "default" : "outline"}
                  size="sm"
                  className={cn("rounded-full", activeFilter === f.label && "gradient-primary text-primary-foreground")}
                  onClick={() => setActiveFilter(activeFilter === f.label ? null : f.label)}
                >
                  <f.icon className="h-4 w-4 mr-1.5" />
                  {f.label}
                </Button>
              ))}
            </div>
          </div>

          {/* ─── Folders grid (when Folders tab is active) ─── */}
          {isFoldersView ? (
            foldersLoading ? (
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
                  Open Chat Assistant
                </Button>
              </div>
            )
          ) : (
            /* ─── Photos grid (normal view) ─── */
            <>
              {loading ? (
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
                      onChanged={handlePhotoChange}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="gradient-primary rounded-full p-4 mb-4">
                    <Search className="h-8 w-8 text-primary-foreground" />
                  </div>
                  <h3 className="font-semibold text-lg">No photos found</h3>
                  <p className="text-sm text-muted-foreground mt-1">Try adjusting your search or filters.</p>
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
            </>
          )}
        </>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete folder?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the folder <strong>"{deleteTarget?.name}"</strong> but won't
              delete the photos inside it. This cannot be undone.
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
