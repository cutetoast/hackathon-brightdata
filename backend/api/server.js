require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = process.env.PORT || 3001;

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Get crypto data with pagination
app.get('/api/crypto', async (req, res) => {
  try {
    console.log('Received request with query:', req.query);
    
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 12;

    console.log('Fetching data with page:', page, 'pageSize:', pageSize);

    const { data: rows, error } = await supabase
      .from('crypto_data')
      .select('*')
      .order('last_updated', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }
    
    console.log('Raw rows from Supabase:', rows);
    
    if (!rows || rows.length === 0) {
      console.log('No data found in Supabase');
      return res.json({
        data: [],
        pagination: {
          page,
          pageSize,
          totalItems: 0,
          totalPages: 0
        }
      });
    }

    // Parse the JSONB data and ensure it's an array
    let cryptoData = rows[0].data;
    console.log('Type of cryptoData:', typeof cryptoData);
    
    if (typeof cryptoData === 'string') {
      console.log('Parsing string data');
      cryptoData = JSON.parse(cryptoData);
    }
    
    if (!Array.isArray(cryptoData)) {
      console.log('Converting non-array to array');
      cryptoData = [cryptoData];
    }

    console.log('Total items in cryptoData:', cryptoData.length);

    // Calculate pagination
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const totalItems = cryptoData.length;
    const totalPages = Math.ceil(totalItems / pageSize);

    console.log('Pagination calculation:', {
      startIndex,
      endIndex,
      totalItems,
      totalPages
    });

    // Get paginated data
    const paginatedData = cryptoData.slice(startIndex, endIndex).map(crypto => {
      const cleanName = crypto.name.replace(/\\n/g, '').trim();
      return {
        name: cleanName,
        symbol: crypto.symbol || cleanName.split(' ').pop(),
        image: crypto.image,
        current_price: parseFloat(crypto.price) || 0,
        price_change_percentage_24h: parseFloat(crypto.change1h) || 0
      };
    });

    const response = {
      data: paginatedData,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages
      }
    };

    console.log('Sending response:', JSON.stringify(response, null, 2));
    res.json(response);
  } catch (error) {
    console.error('Error fetching crypto data:', error);
    res.status(500).json({ error: 'Failed to fetch crypto data' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
