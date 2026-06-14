import { X, ChevronLeft, ChevronRight, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useRef, useEffect } from "react";

interface ModalViewerProps {
  images: { url: string; title: string }[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export function ModalViewer({ images, currentIndex, onClose, onNavigate }: ModalViewerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const current = images[currentIndex];

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  if (!current) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-foreground/90 backdrop-blur-md flex items-center justify-center animate-fade-in"
    >
      <div className="absolute top-4 right-4 flex gap-2 z-10">
        <Button
          variant="ghost"
          size="icon"
          className="text-primary-foreground hover:bg-primary-foreground/20 rounded-full"
          onClick={toggleFullscreen}
          title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
        >
          {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-primary-foreground hover:bg-primary-foreground/20 rounded-full"
          onClick={onClose}
        >
          <X className="h-6 w-6" />
        </Button>
      </div>

      {currentIndex > 0 && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-4 text-primary-foreground hover:bg-primary-foreground/20 rounded-full z-10"
          onClick={() => onNavigate(currentIndex - 1)}
        >
          <ChevronLeft className="h-8 w-8" />
        </Button>
      )}

      {currentIndex < images.length - 1 && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-4 text-primary-foreground hover:bg-primary-foreground/20 rounded-full z-10"
          onClick={() => onNavigate(currentIndex + 1)}
        >
          <ChevronRight className="h-8 w-8" />
        </Button>
      )}

      <div className="relative max-h-[90vh] max-w-[95vw] overflow-hidden rounded-lg shadow-2xl flex items-center justify-center">
        <img
          src={current.url}
          alt={current.title}
          className="max-h-[85vh] max-w-[90vw] object-contain"
        />
        <div className="absolute bottom-4 left-0 right-0 text-center bg-black/40 backdrop-blur-md py-2 px-4 text-primary-foreground text-sm font-medium">
          {current.title} — {currentIndex + 1} / {images.length}
        </div>
      </div>
    </div>
  );
}
