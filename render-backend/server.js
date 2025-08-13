// Render.com backend server for GitHub OAuth token exchange
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for your domains
app.use(cors({
    origin: [
        'https://politic-in.github.io',
        'https://data.politic.in'
    ],
    credentials: true
}));

app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'GitHub OAuth Backend running on Render',
        timestamp: new Date().toISOString()
    });
});

// Token exchange endpoint
app.post('/api/github/token', async (req, res) => {
    const { code } = req.body;
    
    if (!code) {
        return res.status(400).json({ error: 'Code is required' });
    }
    
    try {
        // Exchange code for token with GitHub
        const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                client_id: process.env.GITHUB_CLIENT_ID,
                client_secret: process.env.GITHUB_CLIENT_SECRET,
                code: code
            })
        });
        
        const tokenData = await tokenResponse.json();
        
        if (tokenData.error) {
            console.error('GitHub OAuth error:', tokenData);
            return res.status(400).json({ 
                error: tokenData.error_description || tokenData.error 
            });
        }
        
        // Return the access token
        res.json({ 
            access_token: tokenData.access_token,
            token_type: tokenData.token_type || 'bearer',
            scope: tokenData.scope
        });
        
    } catch (error) {
        console.error('Token exchange error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Render.com keeps services awake with health checks
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Environment:', process.env.NODE_ENV || 'development');
});