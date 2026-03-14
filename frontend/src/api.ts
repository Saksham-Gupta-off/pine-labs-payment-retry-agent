import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:8000",
});

export const getUser = () => api.get("/api/user").then((r) => r.data);
export const getProducts = () => api.get("/api/products").then((r) => r.data);
export const getProduct = (id: string) => api.get(`/api/product/${id}`).then((r) => r.data);

export const recommendPayment = (productId?: string) =>
  api.post("/api/payment/recommend", { product_id: productId }).then((r) => r.data);

export const executePayment = (instrumentId: string, productId?: string) =>
  api
    .post("/api/payment/execute", { instrument_id: instrumentId, product_id: productId })
    .then((r) => r.data);

export const getTransactions = () =>
  api.get("/api/transactions").then((r) => r.data);

export const getDashboard = () =>
  api.get("/api/dashboard").then((r) => r.data);

export const armFailure = (
  errorCode: string,
  count: number = 1,
  instrumentType?: string,
  instrumentId?: string
) =>
  api
    .post("/api/demo/arm-failure", {
      error_code: errorCode,
      count,
      instrument_type: instrumentType || null,
      instrument_id: instrumentId || null,
    })
    .then((r) => r.data);

export const removeRule = (index: number) =>
  api.post("/api/demo/remove-rule", { index }).then((r) => r.data);

export const clearFailure = () =>
  api.post("/api/demo/clear").then((r) => r.data);

export const getDemoStatus = () =>
  api.get("/api/demo/status").then((r) => r.data);

export const clearTransactions = () =>
  api.delete("/api/transactions").then((r) => r.data);

export const searchProducts = (query: string) =>
  api.post("/api/products/search", { query }).then((r) => r.data);

export const getInstruments = () => api.get("/api/instruments").then((r) => r.data);
export const addInstrument = (data: any) => api.post("/api/instruments", data).then((r) => r.data);
export const deleteInstrument = (id: string) => api.delete(`/api/instruments/${id}`).then((r) => r.data);

export default api;
