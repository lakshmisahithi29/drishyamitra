const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

/** Helper to resolve backend URLs */
export function resolveUrl(path: string | undefined | null): string {
    if (!path) return "";
    if (path.startsWith("http") || path.startsWith("blob:") || path.startsWith("data:")) return path;
    const base = API_BASE.replace("/api", "");
    return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
}

/** Get stored JWT token */
function getToken(): string | null {
    try {
        return localStorage.getItem("drishyamitra_token");
    } catch (e) {
        console.error("Failed to get token from localStorage", e);
        return null;
    }
}

/** Store JWT token */
export function setToken(token: string) {
    try {
        localStorage.setItem("drishyamitra_token", token);
    } catch (e) {
        console.error("Failed to store token in localStorage", e);
    }
}

/** Remove JWT token */
export function clearToken() {
    try {
        localStorage.removeItem("drishyamitra_token");
    } catch (e) {
        console.error("Failed to clear token from localStorage", e);
    }
}

/** Check if user is authenticated */
export function isAuthenticated(): boolean {
    const token = getToken();
    if (!token) return false;

    // Simple basic check for JWT format
    return token.split('.').length === 3;
}

/** Build headers with JWT */
function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = { ...extra };
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
}

/** Generic fetch wrapper with error handling */
async function apiFetch<T = any>(
    path: string,
    options: RequestInit = {}
): Promise<T> {
    const url = `${API_BASE}${path}`;
    try {
        const res = await fetch(url, {
            ...options,
            headers: {
                ...authHeaders(),
                ...(options.headers as Record<string, string> || {}),
            },
        });

        if (!res.ok) {
            const body = await res.json().catch(() => ({ error: res.statusText }));
            const errorMessage = body.error || `Request failed: ${res.status}`;
            console.error(`API Error [${res.status}] ${url}:`, body);
            throw new Error(errorMessage);
        }

        return res.json();
    } catch (error: any) {
        console.error(`Fetch Error ${url}:`, error);
        throw error;
    }
}

// ─── Auth ───────────────────────────────────────

export async function signup(name: string, email: string, password: string) {
    const data = await apiFetch<{ token: string; message: string }>("/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
    });
    setToken(data.token);
    return data;
}

export async function login(email: string, password: string) {
    const data = await apiFetch<{ token: string }>("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
    });
    setToken(data.token);
    return data;
}

export async function fetchMe() {
    return apiFetch<{ id: number; name: string; email: string }>("/auth/me");
}

export function logout() {
    clearToken();
}

// ─── Dashboard ──────────────────────────────────

export interface DashboardStats {
    totalPhotos: number;
    peopleDetected: number;
    recentActivity: number;
    storageUsed: string;
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
    return apiFetch<DashboardStats>("/dashboard/stats");
}

export interface DashboardData {
    stats: DashboardStats;
    recentPhotos: Photo[];
    favoritePhotos: Photo[];
}

export async function fetchDashboardData(): Promise<DashboardData> {
    return apiFetch<DashboardData>("/dashboard/data");
}

// ─── Photos ─────────────────────────────────────

export interface Photo {
    id: number;
    url: string;
    title: string;
    filename: string;
    original_filename: string;
    mime_type: string;
    file_size: number;
    is_favorite: boolean;
    uploaded_at: string;
    date: string;
    categories: string[];
    tags: string[];
    faces_count: number;
    faces?: Face[];
}

export interface PhotoListResponse {
    photos: Photo[];
    total: number;
    page: number;
    pages: number;
    has_next: boolean;
}

export async function fetchPhotos(params?: {
    category?: string;
    tag?: string;
    person_id?: number;
    search?: string;
    favorites?: boolean;
    page?: number;
    per_page?: number;
}): Promise<PhotoListResponse> {
    const query = new URLSearchParams();
    if (params?.category) query.set("category", params.category);
    if (params?.tag) query.set("tag", params.tag);
    if (params?.person_id) query.set("person_id", String(params.person_id));
    if (params?.search) query.set("search", params.search);
    if (params?.favorites) query.set("favorites", "true");
    if (params?.page) query.set("page", String(params.page));
    if (params?.per_page) query.set("per_page", String(params.per_page));
    const qs = query.toString();
    return apiFetch<PhotoListResponse>(`/photos${qs ? `?${qs}` : ""}`);
}

export async function fetchPhoto(id: number): Promise<Photo> {
    return apiFetch<Photo>(`/photos/${id}`);
}

export async function uploadPhoto(
    file: File,
    categories: string[],
    tags: string[],
    faceNames: { name: string }[]
): Promise<{ photo: Photo; faces_detected: number }> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("categories_json", JSON.stringify(categories));
    formData.append("tags_json", JSON.stringify(tags));
    formData.append("face_names_json", JSON.stringify(faceNames));

    const token = getToken();
    const res = await fetch(`${API_BASE}/photos/upload`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error || `Upload failed: ${res.status}`);
    }
    return res.json();
}

export async function analyzePhoto(file: File): Promise<{
    faces: any[];
    duplicates: any[];
    faces_count: number;
    is_duplicate: boolean;
}> {
    const formData = new FormData();
    formData.append("file", file);

    const token = getToken();
    const res = await fetch(`${API_BASE}/photos/analyze`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error || `Analysis failed: ${res.status}`);
    }
    return res.json();
}

export async function toggleFavorite(id: number): Promise<Photo> {
    return apiFetch<Photo>(`/photos/${id}/favorite`, { method: "PATCH" });
}

export async function deletePhoto(id: number): Promise<void> {
    await apiFetch(`/photos/${id}`, { method: "DELETE" });
}

export async function batchDeletePhotos(photoIds: number[]): Promise<{ message: string; deleted_count: number }> {
    return apiFetch("/photos/batch-delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo_ids: photoIds }),
    });
}

// ─── Faces ──────────────────────────────────────

export interface Face {
    id: number;
    photo_id: number;
    person_id: number | null;
    person_name: string | null;
    x: number;
    y: number;
    width: number;
    height: number;
    confidence: number;
    has_embedding: boolean;
    embedding_model: string | null;
}

export async function detectFaces(file: File): Promise<Face[]> {
    const token = getToken();
    const res = await fetch(`${API_BASE}/faces/detect`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: file,
    });
    if (!res.ok) throw new Error("Face detection failed");
    const data = await res.json();
    return data.faces || [];
}

export async function assignFaceName(faceId: number, name: string): Promise<Face> {
    return apiFetch<Face>(`/faces/${faceId}/assign`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ person_name: name }),
    });
}

// ─── Persons ────────────────────────────────────

export interface Person {
    id: number;
    name: string;
    avatar: string | null;
    photoCount: number;
}

export async function fetchPersons(): Promise<Person[]> {
    return apiFetch<Person[]>("/persons");
}

export async function fetchPersonPhotos(personId: number): Promise<Photo[]> {
    const data = await apiFetch<{ photos: Photo[] }>(`/persons/${personId}/photos`);
    return data.photos;
}

// ─── Categories & Tags ──────────────────────────

export interface Category {
    id: number;
    name: string;
}

export async function fetchCategories(): Promise<Category[]> {
    return apiFetch<Category[]>("/categories");
}

export async function fetchTags(): Promise<{ id: number; name: string }[]> {
    return apiFetch("/tags");
}

// ─── Chat ───────────────────────────────────────

export interface ChatMessage {
    role: "user" | "assistant";
    content: string;
}

export interface ActionResult {
    type: "photos" | "delete_confirmation" | "duplicates" | "stats" | "count" | "persons" | "info" | "error" | "folder_created" | "folders";
    requires_confirmation?: boolean;
    data: Record<string, any>;
}

export interface ChatResponse {
    role: "assistant";
    content: string;
    action_results: ActionResult[];
}

export async function sendChatMessage(
    message: string,
    history: ChatMessage[] = []
): Promise<ChatResponse> {
    return apiFetch<ChatResponse>("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history }),
    });
}

// ─── Folders ────────────────────────────────────

export interface Folder {
    id: number;
    name: string;
    photo_count: number;
    created_at: string;
    photos?: Photo[];
}

export async function fetchFolders(): Promise<Folder[]> {
    return apiFetch<Folder[]>("/folders");
}

export async function fetchFolder(folderId: number): Promise<Folder> {
    return apiFetch<Folder>(`/folders/${folderId}`);
}

export async function createFolder(name: string, photoIds: number[] = []): Promise<Folder> {
    return apiFetch<Folder>("/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, photo_ids: photoIds }),
    });
}

export async function deleteFolder(folderId: number): Promise<void> {
    await apiFetch(`/folders/${folderId}`, { method: "DELETE" });
}
