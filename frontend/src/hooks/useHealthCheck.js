import { useQuery } from "@tanstack/react-query"

const HEALTH_CHECK_URL = "http://localhost:5000/health"

// Polls the backend's /health endpoint every 5s so the UI can show
// an accurate online/offline status badge.
export function useHealthCheck() {
  const { isSuccess, isError, isLoading } = useQuery({
    queryKey: ["healthCheck"],
    queryFn: async () => {
      const res = await fetch(HEALTH_CHECK_URL)
      if (!res.ok) throw new Error("Server error")
      return res.json()
    },
    refetchInterval: 5000,
    retry: false,
  })

  return {
    isOnline: isSuccess,
    isOffline: isError,
    isLoading,
  }
}
