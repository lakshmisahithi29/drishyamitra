export const mockPhotos = Array.from({ length: 12 }, (_, i) => ({
  id: `photo-${i + 1}`,
  url: `https://picsum.photos/seed/${i + 10}/400/300`,
  title: `Photo ${i + 1}`,
  date: new Date(2025, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toLocaleDateString(),
  isFavorite: i % 3 === 0,
}));

export const mockPeople = [
  { id: "p1", name: "Aarav Sharma", avatar: "https://i.pravatar.cc/150?img=1", photoCount: 24 },
  { id: "p2", name: "Priya Patel", avatar: "https://i.pravatar.cc/150?img=5", photoCount: 18 },
  { id: "p3", name: "Rohan Gupta", avatar: "https://i.pravatar.cc/150?img=3", photoCount: 31 },
  { id: "p4", name: "Ananya Singh", avatar: "https://i.pravatar.cc/150?img=9", photoCount: 12 },
  { id: "p5", name: "Vikram Reddy", avatar: "https://i.pravatar.cc/150?img=11", photoCount: 7 },
  { id: "p6", name: "Meera Joshi", avatar: "https://i.pravatar.cc/150?img=16", photoCount: 22 },
];

export const mockMessages = [
  { id: "m1", role: "assistant" as const, content: "Hello! I'm your Drishyamitra AI assistant. I can help you search, organize, and manage your photos. What would you like to do?" },
  { id: "m2", role: "user" as const, content: "Show me photos from last weekend" },
  { id: "m3", role: "assistant" as const, content: "I found 8 photos from last weekend. They include 3 landscape shots, 2 group photos, and 3 candid moments. Would you like me to create an album from these?" },
];

export const mockStats = {
  totalPhotos: 1284,
  peopleDetected: 23,
  recentActivity: 47,
  storageUsed: "3.2 GB",
};
