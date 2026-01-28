/**
 * Gallery Widget Template
 *
 * An image grid with lightbox - perfect for:
 * - Photo albums
 * - Product galleries
 * - Portfolio showcases
 * - Image search results
 */

import React, { useState } from "react";
import { X, ChevronLeft, ChevronRight, Download, Heart, Share2, Maximize2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useWidgetProps } from "../use-widget-props";
import { useWidgetState } from "../use-widget-state";
import { useTheme } from "../use-theme";
import { useDisplayMode } from "../use-display-mode";

type GalleryImage = {
  id: string;
  src: string;
  thumbnail?: string;
  title?: string;
  description?: string;
  author?: string;
};

type ToolOutput = {
  title?: string;
  images: GalleryImage[];
};

type WidgetState = {
  likedIds: string[];
  viewedIndex: number | null;
};

const defaultProps: ToolOutput = {
  title: "Photo Gallery",
  images: [
    {
      id: "1",
      src: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop",
      thumbnail: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop",
      title: "Mountain Sunrise",
      description: "A breathtaking view of the Alps at dawn",
      author: "John Doe",
    },
    {
      id: "2",
      src: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&h=600&fit=crop",
      thumbnail: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=400&h=300&fit=crop",
      title: "Forest Path",
      description: "Sunlight filtering through ancient trees",
      author: "Jane Smith",
    },
    {
      id: "3",
      src: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&h=600&fit=crop",
      thumbnail: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&h=300&fit=crop",
      title: "Tropical Beach",
      description: "Crystal clear waters and white sand",
      author: "Mike Johnson",
    },
    {
      id: "4",
      src: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&h=600&fit=crop",
      thumbnail: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400&h=300&fit=crop",
      title: "Starry Night",
      description: "The Milky Way over mountain peaks",
      author: "Sarah Wilson",
    },
    {
      id: "5",
      src: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=800&h=600&fit=crop",
      thumbnail: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=400&h=300&fit=crop",
      title: "Ocean Waves",
      description: "Powerful waves crashing on the shore",
      author: "Tom Brown",
    },
    {
      id: "6",
      src: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&h=600&fit=crop",
      thumbnail: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&h=300&fit=crop",
      title: "Misty Forest",
      description: "Morning fog in the redwood forest",
      author: "Emily Davis",
    },
  ],
};

export default function App() {
  const props = useWidgetProps<ToolOutput>(defaultProps);
  const theme = useTheme() ?? "light";
  const displayMode = useDisplayMode() ?? "inline";
  const [widgetState, setWidgetState] = useWidgetState<WidgetState>({
    likedIds: [],
    viewedIndex: null,
  });

  const isDark = theme === "dark";
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setWidgetState((prev) => ({ ...prev, viewedIndex: index }));
  };

  const closeLightbox = () => setLightboxIndex(null);

  const goToPrev = () => {
    if (lightboxIndex === null) return;
    const newIndex = lightboxIndex === 0 ? props.images.length - 1 : lightboxIndex - 1;
    setLightboxIndex(newIndex);
  };

  const goToNext = () => {
    if (lightboxIndex === null) return;
    const newIndex = lightboxIndex === props.images.length - 1 ? 0 : lightboxIndex + 1;
    setLightboxIndex(newIndex);
  };

  const toggleLike = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setWidgetState((prev) => {
      const likedIds = prev?.likedIds ?? [];
      const isLiked = likedIds.includes(id);
      return {
        ...prev,
        likedIds: isLiked ? likedIds.filter((i) => i !== id) : [...likedIds, id],
      };
    });
  };

  const isLiked = (id: string) => widgetState?.likedIds?.includes(id) ?? false;

  const currentImage = lightboxIndex !== null ? props.images[lightboxIndex] : null;

  const handleRequestFullscreen = () => {
    if (window.openai?.requestDisplayMode) {
      window.openai?.requestDisplayMode({ mode: "fullscreen" });
    } else if (window.webplus?.requestDisplayMode) {
      window.webplus?.requestDisplayMode({ mode: "fullscreen" });
    }
  };

  return (
    <div className={`w-full rounded-2xl border overflow-hidden ${isDark ? "bg-gray-900 border-gray-700" : "bg-white border-gray-200"}`}>
      {/* Header */}
      <div className={`flex items-center justify-between p-4 border-b ${isDark ? "border-gray-700" : "border-gray-100"}`}>
        <div>
          {props.title && (
            <h2 className={`text-lg font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
              {props.title}
            </h2>
          )}
          <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
            {props.images.length} photos
          </p>
        </div>
        {displayMode !== "fullscreen" && (
          <button
            onClick={handleRequestFullscreen}
            className={`p-2 rounded-full transition-colors ${isDark ? "hover:bg-gray-800 text-gray-400" : "hover:bg-gray-100 text-gray-500"}`}
            aria-label="Fullscreen"
          >
            <Maximize2 className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Gallery Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 p-1">
        {props.images.map((image, index) => (
          <div
            key={image.id}
            className="relative aspect-square overflow-hidden cursor-pointer group"
            onClick={() => openLightbox(index)}
          >
            <img
              src={image.thumbnail || image.src}
              alt={image.title || `Image ${index + 1}`}
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />

            {/* Like button overlay */}
            <button
              onClick={(e) => toggleLike(image.id, e)}
              className={`absolute top-2 right-2 p-1.5 rounded-full transition-all opacity-0 group-hover:opacity-100 ${
                isLiked(image.id)
                  ? "bg-red-500 text-white"
                  : "bg-black/50 text-white hover:bg-black/70"
              }`}
            >
              <Heart className={`w-4 h-4 ${isLiked(image.id) ? "fill-current" : ""}`} />
            </button>

            {/* Title overlay */}
            {image.title && (
              <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-white text-sm font-medium truncate">{image.title}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxIndex !== null && currentImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
            onClick={closeLightbox}
          >
            {/* Close button */}
            <button
              onClick={closeLightbox}
              className="absolute top-4 right-4 p-2 text-white/80 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Navigation */}
            <button
              onClick={(e) => { e.stopPropagation(); goToPrev(); }}
              className="absolute left-4 p-2 text-white/80 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-8 h-8" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); goToNext(); }}
              className="absolute right-4 p-2 text-white/80 hover:text-white transition-colors"
            >
              <ChevronRight className="w-8 h-8" />
            </button>

            {/* Image */}
            <motion.div
              key={lightboxIndex}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-4xl max-h-[80vh] mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={currentImage.src}
                alt={currentImage.title || ""}
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
              />

              {/* Image info */}
              <div className="mt-4 text-center text-white">
                {currentImage.title && (
                  <h3 className="text-xl font-semibold">{currentImage.title}</h3>
                )}
                {currentImage.description && (
                  <p className="text-white/70 mt-1">{currentImage.description}</p>
                )}
                {currentImage.author && (
                  <p className="text-white/50 text-sm mt-2">Photo by {currentImage.author}</p>
                )}
                <p className="text-white/40 text-sm mt-2">
                  {lightboxIndex + 1} / {props.images.length}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      {(widgetState?.likedIds?.length ?? 0) > 0 && (
        <div className={`px-4 py-3 border-t text-sm ${isDark ? "border-gray-700 text-gray-400" : "border-gray-100 text-gray-500"}`}>
          <Heart className="w-4 h-4 inline mr-1 text-red-500 fill-red-500" />
          {widgetState?.likedIds?.length} photo{widgetState?.likedIds?.length !== 1 ? "s" : ""} liked
        </div>
      )}
    </div>
  );
}
