import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
  timeout: 10000,
});

export const getErrorMessage = (error) =>
  error.response?.data?.detail || error.message || "Unable to connect to the fleet service.";
