import axios from "axios";
import { getDeviceId, getVisitorId } from "../utils/visitorId.util";

const api = axios.create({
  baseURL: "/api",
});

api.interceptors.request.use((config) => {
  const visitorId = getVisitorId();
  if (visitorId) config.headers.set("X-Browser-Fingerprint", visitorId);
  const deviceId = getDeviceId();
  if (deviceId) config.headers.set("X-Device-Id", deviceId);
  return config;
});

export default api;
