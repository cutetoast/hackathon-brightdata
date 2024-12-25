import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Endpoint to get cryptocurrency data
app.get('/api/crypto', async (req, res) => {
    try {
        const filePath = path.join(__dirname, 'coingecko_data.json');
        const data = await fs.readFile(filePath, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        console.error('Error reading crypto data:', error);
        res.status(500).json({ error: 'Failed to fetch cryptocurrency data' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
