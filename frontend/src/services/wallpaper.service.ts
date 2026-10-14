import api from "./api.service";

export type Wallpaper = {
  file: string;
  name: string;
  kind: "image" | "video";
  width?: number;
  height?: number;
  size: number;
  createdAt: string;
  url: string;
  thumbnailUrl?: string;
};

const list = async (): Promise<Wallpaper[]> =>
  (await api.get("/wallpapers")).data;

const upload = async (file: File): Promise<Wallpaper> => {
  const form = new FormData();
  form.append("file", file);
  return (await api.post("/wallpapers", form)).data;
};

const remove = async (file: string) => {
  await api.delete(`/wallpapers/${file}`);
};

const wallpaperService = { list, upload, remove };

export default wallpaperService;
