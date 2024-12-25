'use client'

import { useState, useEffect, useCallback } from 'react'

const PAGE_SIZE = 12;

interface CryptoData {
  name: string
  symbol: string
  image: string
  current_price: number
  price_change_percentage_24h: number
}

interface PaginationData {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
}

interface ApiResponse {
  data: CryptoData[]
  pagination: PaginationData
}

const formatPrice = (price: number) => {
  if (!price && price !== 0) return 'N/A';
  
  try {
    if (price >= 1) {
      return price.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    } else {
      return price.toLocaleString('en-US', {
        minimumFractionDigits: 4,
        maximumFractionDigits: 6
      });
    }
  } catch (error) {
    console.error('Error formatting price:', error);
    return 'N/A';
  }
};

const validateCryptoData = (item: any): item is CryptoData => {
  if (!item || typeof item !== 'object') {
    console.log('Invalid crypto item:', item);
    return false;
  }

  const requiredFields = ['name', 'symbol', 'current_price', 'price_change_percentage_24h'];
  for (const field of requiredFields) {
    if (!(field in item)) {
      console.log(`Missing required field: ${field}`);
      return false;
    }
  }

  return true;
};

const isValidApiResponse = (data: any): data is ApiResponse => {
  console.log('Validating API response:', JSON.stringify(data, null, 2));

  if (!data || typeof data !== 'object') {
    console.log('Response is not an object:', data);
    return false;
  }

  // Validate data array
  if (!Array.isArray(data.data)) {
    console.log('data is not an array:', data.data);
    return false;
  }

  // Validate each crypto item
  for (const item of data.data) {
    if (!validateCryptoData(item)) {
      console.log('Invalid crypto item in data array');
      return false;
    }
  }

  // Validate pagination
  if (!data.pagination || typeof data.pagination !== 'object') {
    console.log('pagination is missing or not an object:', data.pagination);
    return false;
  }

  const { page, pageSize, totalItems, totalPages } = data.pagination;
  
  if (!Number.isInteger(page) || page < 1) {
    console.log('Invalid page number:', page);
    return false;
  }

  if (!Number.isInteger(pageSize) || pageSize < 1) {
    console.log('Invalid pageSize:', pageSize);
    return false;
  }

  if (!Number.isInteger(totalItems) || totalItems < 0) {
    console.log('Invalid totalItems:', totalItems);
    return false;
  }

  if (!Number.isInteger(totalPages) || totalPages < 0) {
    console.log('Invalid totalPages:', totalPages);
    return false;
  }

  console.log('API response is valid');
  return true;
};

export default function Home() {
  const [cryptoData, setCryptoData] = useState<CryptoData[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async (page: number) => {
    try {
      setIsLoading(true)
      setError(null)
      
      const url = `https://worker-production-fe23.up.railway.app/api/crypto?page=${page}&pageSize=${PAGE_SIZE}`;
      console.log('Fetching data from:', url);
      
      const response = await fetch(url);
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`Network response was not ok: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Raw API response:', JSON.stringify(data, null, 2));
      
      if (!isValidApiResponse(data)) {
        throw new Error('Invalid API response format');
      }

      console.log('Setting crypto data:', data.data);
      console.log('Setting total pages:', data.pagination.totalPages);
      
      setCryptoData(data.data);
      setTotalPages(data.pagination.totalPages);
    } catch (err: any) {
      console.error('Fetch error:', err);
      setError(err.message);
      setCryptoData([]);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      if (mounted) {
        await fetchData(currentPage);
      }
    };

    loadData();

    const interval = setInterval(() => {
      if (mounted) {
        loadData();
      }
    }, 60000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [currentPage, fetchData]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handleRetry = () => {
    fetchData(currentPage);
  };

  if (isLoading && cryptoData.length === 0) {
    return (
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Crypto Tracker</h1>
        <div>Loading...</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Crypto Tracker</h1>
        <div className="text-red-500 mb-4">Error: {error}</div>
        <button 
          onClick={handleRetry}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Retry
        </button>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Crypto Tracker</h1>
      {isLoading && <div className="text-gray-500 mb-4">Refreshing data...</div>}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {cryptoData.map((crypto, index) => (
          <div 
            key={index}
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center gap-3 mb-4">
              {crypto.image && (
                <img 
                  src={crypto.image} 
                  alt={crypto.name} 
                  className="w-8 h-8"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              )}
              <div>
                <h2 className="text-xl font-semibold">{crypto.name}</h2>
                <p className="text-gray-500">{crypto.symbol}</p>
              </div>
            </div>
            
            <div className="mt-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Price:</span>
                <span className="text-lg font-semibold">
                  ${formatPrice(Number(crypto.current_price))}
                </span>
              </div>
              
              <div className="flex justify-between items-center mt-2">
                <span className="text-gray-600">1h Change:</span>
                <span className={`font-semibold ${
                  Number(crypto.price_change_percentage_24h) >= 0 
                    ? 'text-green-600' 
                    : 'text-red-600'
                }`}>
                  {Number(crypto.price_change_percentage_24h) >= 0 ? '+' : ''}
                  {Number(crypto.price_change_percentage_24h).toFixed(2)}%
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {cryptoData.length > 0 && (
        <div className="flex justify-center items-center gap-4">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className={`px-4 py-2 rounded ${
              currentPage === 1
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            Previous
          </button>
          
          <span className="text-gray-600">
            Page {currentPage} of {totalPages}
          </span>
          
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className={`px-4 py-2 rounded ${
              currentPage === totalPages
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            Next
          </button>
        </div>
      )}
    </main>
  );
}
