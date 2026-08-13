import { useQuery } from "@tanstack/react-query"

export default function HealthCheck() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const response = await fetch("http://localhost:5000/health")

      if (!response.ok) {
        throw new Error("Health check failed")
      }

      return response.json()
    },
  })

  if (isLoading) {
    return <p>Checking backend...</p>
  }

  if (isError) {
    return <p>Backend is offline</p>
  }

  return <p>Backend: {data.status}</p>
}