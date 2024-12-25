// Format numbers with commas and decimals
function formatNumber(num) {
    if (num === null || num === undefined) return 'N/A';
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(num);
}

// Format currency values
function formatCurrency(num) {
    if (num === null || num === undefined) return 'N/A';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(num);
}

// Update the table with cryptocurrency data
function updateTable(data) {
    const tableBody = document.querySelector('#cryptoTable tbody');
    tableBody.innerHTML = '';

    data.data.forEach(crypto => {
        const row = document.createElement('tr');
        
        // Add coin name and symbol with image
        const nameCell = document.createElement('td');
        nameCell.className = 'coin-info';
        nameCell.innerHTML = `
            <img src="${crypto.image}" alt="${crypto.name}" class="coin-icon">
            <div class="coin-name-container">
                <span class="coin-name">${crypto.name}</span>
                <span class="coin-symbol">${crypto.symbol.toUpperCase()}</span>
            </div>
        `;
        
        // Add price
        const priceCell = document.createElement('td');
        priceCell.textContent = formatCurrency(crypto.price);
        
        // Add 1h change with color
        const changeCell = document.createElement('td');
        const changeValue = crypto.change1h;
        const isPositive = !changeValue.includes('-');
        changeCell.className = isPositive ? 'positive-change' : 'negative-change';
        changeCell.textContent = changeValue;
        
        // Add market cap and volume
        const marketCapCell = document.createElement('td');
        marketCapCell.textContent = formatCurrency(crypto.marketCap);
        
        const volumeCell = document.createElement('td');
        volumeCell.textContent = formatCurrency(crypto.volume24h);
        
        row.appendChild(nameCell);
        row.appendChild(priceCell);
        row.appendChild(changeCell);
        row.appendChild(marketCapCell);
        row.appendChild(volumeCell);
        
        tableBody.appendChild(row);
    });

    // Update last updated time
    const lastUpdated = new Date(data.last_updated);
    document.getElementById('lastUpdated').textContent = lastUpdated.toLocaleString();
}

async function fetchData() {
    try {
        const response = await fetch('/api/crypto/data');
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const data = await response.json();
        updateTable(data);
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

// Initial fetch
fetchData();

// Refresh data every minute
setInterval(fetchData, 60000);
