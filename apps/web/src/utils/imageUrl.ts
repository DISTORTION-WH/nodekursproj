import api from "../services/api";

const DEFAULT_AVATAR =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='32' fill='%235865f2'/%3E%3Ctext x='50%25' y='54%25' text-anchor='middle' fill='white' font-size='28' font-family='sans-serif' dy='.1em'%3E%3F%3C/text%3E%3C/svg%3E";

export const getImageUrl = (url: string | null | undefined) => {
  if (!url) return DEFAULT_AVATAR;
  if (url.startsWith("http")) {
    return url;
  }
  return api.defaults.baseURL + url;
};