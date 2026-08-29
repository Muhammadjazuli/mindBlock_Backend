import axios from "axios";
import { API_BASE_URL } from "./config";
import { setupInterceptors } from "./interceptors";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

if (typeof window !== "undefined") {
  setupInterceptors(api);
}

export default api;
