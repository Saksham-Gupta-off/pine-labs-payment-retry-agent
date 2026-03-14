import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:8000",
});

export const getUser = () => api.get("/api/user").then((r) => r.data);
export const getProduct = () => api.get("/api/product").then((r) => r.data);

export const executePayment = (instrumentId?: string) =>
  api
    .post("/api/payment/execute", { instrument_id: instrumentId })
    .then((r) => r.data);

export const getTransactions = () =>
  api.get("/api/transactions").then((r) => r.data);

export const getDashboard = () =>
  api.get("/api/dashboard").then((r) => r.data);

export const armFailure = (errorCode: string) =>
  api.post("/api/demo/arm-failure", { error_code: errorCode }).then((r) => r.data);

export const clearFailure = () =>
  api.post("/api/demo/clear").then((r) => r.data);

export const getDemoStatus = () =>
  api.get("/api/demo/status").then((r) => r.data);

export const clearTransactions = () =>
  api.delete("/api/transactions").then((r) => r.data);

export default api;
