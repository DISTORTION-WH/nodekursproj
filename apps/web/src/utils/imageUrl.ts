import api from "../services/api";

export const getImageUrl = (url: string | null | undefined) => {
  if (!url) return "/default-avatar.png";
  if (url.startsWith("http")) {
    return url;
  }
  return api.defaults.baseURL + url;
};