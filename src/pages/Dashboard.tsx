import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PhotoCard } from "@/components/PhotoCard";
import { fetchDashboardData, type DashboardStats, type Photo } from "@/lib/api";
import { Images, Users, Activity, HardDrive, Upload, Sparkles, Loader2, Heart, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ModalViewer } from "@/components/ModalViewer";

const iconMap = {
  totalPhotos: Images,
  peopleDetected: Users,
  recentActivity: Activity,
  storageUsed: HardDrive,
};

const labelMap: Record<string, string> = {
  totalPhotos: "Total Photos",
  peopleDetected: "People Detected",
  recentActivity: "Recent Activity",
  storageUsed: "Storage Used",
};

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentPhotos, setRecentPhotos] = useState<Photo[]>([]);
  const [favoritePhotos, setFavoritePhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewerPhotos, setViewerPhotos] = useState<Photo[]>([]);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const navigate = useNavigate();

  const loadData = async () => {
    try {
      const data = await fetchDashboardData();
      setStats(data.stats);
      setRecentPhotos(data.recentPhotos);
      setFavoritePhotos(data.favoritePhotos);
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openViewer = (photos: Photo[], index: number) => {
    setViewerPhotos(photos);
    setViewerIndex(index);
  };

  const statEntries = stats
    ? [
      { key: "totalPhotos", value: stats.totalPhotos.toLocaleString() },
      { key: "peopleDetected", value: String(stats.peopleDetected) },
      { key: "recentActivity", value: String(stats.recentActivity) },
      { key: "storageUsed", value: stats.storageUsed },
    ]
    : [];

  return (
    <div className="space-y-10 animate-fade-in pb-10">
      {/* Welcome */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Welcome back
          </h1>
          <p className="text-muted-foreground mt-1">Here's what's happening with your photos.</p>
        </div>
        <Button className="gradient-primary text-primary-foreground rounded-full" onClick={() => navigate("/app/upload")}>
          <Upload className="h-4 w-4 mr-2" />
          Quick Upload
        </Button>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statEntries.map((stat, i) => {
            const Icon = iconMap[stat.key as keyof typeof iconMap];
            return (
              <Card
                key={stat.key}
                className="hover:shadow-md transition-shadow animate-fade-in opacity-0"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="gradient-primary rounded-xl p-2.5">
                    <Icon className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{labelMap[stat.key]}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="grid gap-10">
        {/* Recent Photos */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">Most Recent</h2>
          </div>
          {recentPhotos.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {recentPhotos.map((photo, i) => (
                <PhotoCard
                  key={photo.id}
                  id={photo.id}
                  url={photo.url}
                  title={photo.title}
                  isFavorite={photo.is_favorite}
                  hideDelete={true}
                  onClick={() => openViewer(recentPhotos, i)}
                  onChanged={loadData}
                />
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-muted-foreground mb-4">No photos yet. Upload some to get started!</p>
                <Button variant="outline" size="sm" onClick={() => navigate("/app/upload")}>
                  Upload Now
                </Button>
              </CardContent>
            </Card>
          )}
        </section>

        {/* Favorite Photos */}
        {favoritePhotos.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Heart className="h-5 w-5 text-red-500 fill-red-500" />
              <h2 className="text-xl font-bold">Your Favorites</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {favoritePhotos.map((photo, i) => (
                <PhotoCard
                  key={photo.id}
                  id={photo.id}
                  url={photo.url}
                  title={photo.title}
                  isFavorite={photo.is_favorite}
                  hideDelete={true}
                  onClick={() => openViewer(favoritePhotos, i)}
                  onChanged={loadData}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Viewer */}
      {viewerIndex !== null && (
        <ModalViewer
          images={viewerPhotos}
          currentIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onNavigate={setViewerIndex}
        />
      )}
    </div>
  );
}
