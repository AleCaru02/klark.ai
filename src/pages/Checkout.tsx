import { Navigate, useSearchParams } from "react-router-dom";

export default function Checkout() {
  const [searchParams] = useSearchParams();
  const params = new URLSearchParams();
  const plan = searchParams.get("plan");
  const ref = searchParams.get("ref");

  if (plan) params.set("plan", plan);
  if (ref) params.set("ref", ref);

  const query = params.toString();
  return <Navigate to={`/analisi-flusso${query ? `?${query}` : ""}`} replace />;
}
