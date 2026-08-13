import { useQuery } from "@tanstack/react-query"

export function useHealthCheck() {
  const { isSuccess, isError, isLoading } = useQuery({
    queryKey: ["healthCheck"],
    queryFn: async () => {
      const res = await fetch("http://localhost:5000/health")
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