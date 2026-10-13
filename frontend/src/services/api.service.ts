import axios from "axios";
import { getVisitorId } from "../utils/visitorId.util";

const api = axios.create({
  baseURL: "/api",
});

api.interceptors.request.use((config) => {
  const visitorId = getVisitorId();
  if (visitorId) config.headers.set("X-Browser-Fingerprint", visitorId);
  return config;
});

export default api;
