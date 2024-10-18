// index.js
// Import necessary modules
const fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis');
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path'); // Import path module
const s3 = require('./awsConfig.js');
require('dotenv').config();

// Initialize the Express application
const app = express();
app.use(bodyParser.json());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve the index.html file when visiting the root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly',
                'https://www.googleapis.com/auth/gmail.modify'];
const bucketName = 'mailslit-oauth-tokens';
const tokenKey = 'tokens/token.json'; // Adjust the path as needed
let oAuth2Client;

// Upload token to S3
async function uploadToken(token) {
    const params = {
        Bucket: bucketName,
        Key: tokenKey,
        Body: JSON.stringify(token),
        ContentType: 'application/json',
    };

    try {
        await s3.putObject(params).promise();
        console.log('Token uploaded successfully.');
    } catch (error) {
        console.error('Error uploading token:', error);
    }
}

// Download token from S3
async function downloadToken() {
    const params = {
        Bucket: bucketName,
        Key: tokenKey,
    };

    try {
        const data = await s3.getObject(params).promise();
        return JSON.parse(data.Body.toString('utf-8'));
    } catch (error) {
        console.error('Error downloading token:', error);
        return null; // Handle as appropriate
    }
}

// Load client secrets from a local file and authorize the client
fs.readFile('client_id.json', (err, content) => {
    if (err) {
        return console.error('Error loading client secret file:', err);
    }
    authorize(JSON.parse(content));
});

// Function to authorize the client and obtain the OAuth2 client
async function authorize(credentials) {
    const { client_secret, client_id, redirect_uris } = credentials.web;
    oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    // Load token from S3 instead of local file
    const token = await downloadToken();
    if (token) {
        oAuth2Client.setCredentials(token);
        console.log('Tokens loaded from S3, ready to fetch emails!');
    } else {
        getAccessToken(oAuth2Client);
    }
}

// Function to get a new access token
function getAccessToken(oAuth2Client) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    });

    console.log('Authorize this app by visiting this url:', authUrl);

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    rl.question('Enter the code from that page here: ', async (code) => {
        rl.close();
        oAuth2Client.getToken(code, async (err, token) => {
            if (err) {
                console.error('Error retrieving access token', err);
                return;
            }
            console.log('Retrieved token:', token);
            oAuth2Client.setCredentials(token);
            await uploadToken(token); // Upload token to S3
            console.log('Tokens stored in S3, ready to fetch emails!');
        });
    });
}

// Route to fetch emails containing the word "unsubscribe"
app.get('/getEmails', async (req, res) => {
    if (!oAuth2Client) {
        return res.status(500).json({ error: 'OAuth2 client not initialized.' });
    }

    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

    try {
        const response = await gmail.users.messages.list({
            userId: 'me',
            q: 'unsubscribe', // Fetch emails containing the word "unsubscribe"
            maxResults: 100,
        });

        const messages = response.data.messages;
        if (!messages || messages.length === 0) {
            return res.json({ message: 'No subscription emails found.' });
        } else {
            const emails = await Promise.all(
                messages.map(async (message) => {
                    const msg = await gmail.users.messages.get({
                        userId: 'me',
                        id: message.id,
                    });
                    return msg.data;
                })
            );

            const emailCount = emails.reduce((acc, email) => {
                const sender = email.payload.headers.find(header => header.name === 'From').value;

                // Extract the email address from the sender string
                const emailRegex = /<(.+?)>/;
                const emailMatch = emailRegex.exec(sender);
                const emailAddress = emailMatch ? emailMatch[1] : sender; // Use the match or fallback to the original sender

                acc[emailAddress] = (acc[emailAddress] || 0) + 1;
                return acc;
            }, {});

            res.json(emailCount);
        }
    } catch (error) {
        console.error('Error fetching emails:', error); // Log the error object
        res.status(500).json({ error: 'Error fetching emails', details: error.message }); // Return error details
    }
});

// Route to unsubscribe from an email sender
app.post('/unsubscribe', async (req, res) => {
    const { sender } = req.body;

    if (!sender) {
        return res.status(400).json({ success: false, error: 'Sender is required.' });
    }

    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

    try {
        const response = await gmail.users.messages.list({
            userId: 'me',
            q: `from:${sender}`, // Search for messages from the sender
            maxResults: 100,
        });

        const messages = response.data.messages;

        if (messages && messages.length > 0) {
            for (const message of messages) {
                await gmail.users.messages.modify({
                    userId: 'me',
                    id: message.id,
                    requestBody: {
                        addLabelIds: ['SPAM'], // Marking email as spam
                    },
                });
            }
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error unsubscribing:', error); // Log the error object
        res.status(500).json({ success: false, error: 'Error unsubscribing', details: error.message });
    }
});

// OAuth2 Web-Based Flow Additions

// Initialize OAuth2 Client
function initOAuth2Client() {
    const client_id = process.env.CLIENT_ID;
    const client_secret = process.env.CLIENT_SECRET;
    const redirect_uris = process.env.REDIRECT_URI || 'https://your-vercel-deployment-url/oauth2callback';
    oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris);
}

// Route to handle OAuth2 callback
app.get('/oauth2callback', async (req, res) => {
    const code = req.query.code;
    if (!code) {
        return res.status(400).send('No code provided.');
    }

    try {
        const { tokens } = await oAuth2Client.getToken(code);
        oAuth2Client.setCredentials(tokens);
        await uploadToken(tokens); // Upload tokens to S3
        res.redirect('/');
    } catch (error) {
        console.error('Error during OAuth callback:', error);
        res.status(500).send('OAuth callback failed.');
    }
});

// Route to trigger OAuth2 authorization
app.get('/authorize', (req, res) => {
    if (!oAuth2Client) {
        initOAuth2Client();
    }
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    });
    res.redirect(authUrl);
});

// Start the server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
