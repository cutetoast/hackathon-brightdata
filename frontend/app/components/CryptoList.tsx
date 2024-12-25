'use client'

import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(res => res.json())

export default function CryptoList() {
const { data, error, isLoading } = useSWR(
  `${process.env.NEXT_PUBLIC_API_URL}/api/crypto`, // Use the environment variable for the API URL
  fetcher
);

  if (error) return <div>Failed to load</div>
  if (isLoading) return <div>Loading...</div>

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {data?.map((crypto: any) => (
        <div key={crypto.id} className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-xl font-semibold">{crypto.name}</h2>
          <p className="text-gray-600">${crypto.current_price}</p>
          <p className={`${
            crypto.price_change_percentage_24h >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {crypto.price_change_percentage_24h.toFixed(2)}%
          </p>
        </div>
      ))}
    </div>
  )
}
