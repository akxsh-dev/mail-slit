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
    console.log('Serving index.html file');
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly',
                'https://www.googleapis.com/auth/gmail.modify'];
const bucketName = 'mailslit-oauth-tokens';
const tokenKey = 'tokens/token.json'; // Adjust the path as needed
// let oAuth2Client;

function getOAuth2Client() {
    const client_id = process.env.CLIENT_ID;
    const client_secret = process.env.CLIENT_SECRET;
    const redirect_uri = process.env.REDIRECT_URI;
    console.log('Using redirect_uri:', redirect_uri); // Log the redirect_uri

    if (!client_id || !client_secret || !redirect_uri) {
        console.error('Missing OAuth2 client credentials or redirect URI');
        throw new Error('Missing OAuth2 client credentials or redirect URI');
    }

    return new google.auth.OAuth2(client_id, client_secret, redirect_uri);
}


// Upload token to S3
async function uploadToken(token) {
    console.log('Uploading token to S3');
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
    console.log('Downloading token from S3');
    const params = {
        Bucket: bucketName,
        Key: tokenKey,
    };

    try {
        const data = await s3.getObject(params).promise();
        console.log('Token downloaded successfully');
        return JSON.parse(data.Body.toString('utf-8'));
    } catch (error) {
        console.error('Error downloading token:', error);
        return null; // Handle as appropriate
    }
}

// Route to fetch emails containing the word "unsubscribe"
app.post('/getEmails', async (req, res) => {
    const { code } = req.body;
    console.log('Received code:', code);

    if (!code) {
        console.error('No code provided');
        return res.status(400).json({ error: 'No code provided.' });
    }

    try {
        const oAuth2Client = getOAuth2Client();

        // Explicitly set redirect_uri before exchanging code for tokens
        console.log('Setting redirect_uri before exchanging code for tokens');
        oAuth2Client.redirectUri = process.env.REDIRECT_URI;

        // Exchange the authorization code for access tokens
        console.log('Exchanging authorization code for tokens');
        const { tokens } = await oAuth2Client.getToken({
            code,
            redirect_uri: process.env.REDIRECT_URI, // Explicitly set redirect_uri
        });
        console.log('Tokens received:', tokens);
        oAuth2Client.setCredentials(tokens);

        // Optionally, upload tokens to S3 for storage
        await uploadToken(tokens);

        // Initialize Gmail API client
        console.log('Initializing Gmail API client');
        const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

        // Fetch emails containing the word "unsubscribe"
        console.log('Fetching emails containing "unsubscribe"');
        const response = await gmail.users.messages.list({
            userId: 'me',
            q: 'unsubscribe',
            maxResults: 100,
        });

        const messages = response.data.messages;

        if (!messages || messages.length === 0) {
            console.log('No subscription emails found');
            return res.json({ message: 'No subscription emails found.' });
        } else {
            console.log(`Found ${messages.length} subscription emails`);
            // Fetch full message data for each message
            const emails = await Promise.all(
                messages.map(async (message) => {
                    console.log(`Fetching message with ID: ${message.id}`);
                    const msg = await gmail.users.messages.get({
                        userId: 'me',
                        id: message.id,
                        format: 'metadata',
                        metadataHeaders: ['From'],
                    });
                    return msg.data;
                })
            );

            // Count emails from each sender
            console.log('Counting emails from each sender');
            const emailCount = emails.reduce((acc, email) => {
                const headers = email.payload.headers;
                const fromHeader = headers.find(header => header.name === 'From');
                if (fromHeader) {
                    const sender = fromHeader.value;

                    // Extract the email address from the sender string
                    const emailRegex = /<(.+?)>/;
                    const emailMatch = emailRegex.exec(sender);
                    const emailAddress = emailMatch ? emailMatch[1] : sender.trim();

                    acc[emailAddress] = (acc[emailAddress] || 0) + 1;
                }
                return acc;
            }, {});

            console.log('Filtering emails sent more than 5 times');
            const filteredEmails = Object.entries(emailCount).filter(([_, count]) => count > 5);
            console.log('Filtered emails:', filteredEmails);

            res.json({ filteredEmails: Object.fromEntries(filteredEmails) });  //sending the filtered emails to the front-end
        }
    } catch (error) {
        console.error('Error fetching emails:', error);
        res.status(500).json({ error: 'Error fetching emails', details: error.message });
    }
});


// Route to unsubscribe from an email sender
app.post('/unsubscribe', async (req, res) => {
    const { sender } = req.body;
    console.log('Received request to unsubscribe from sender:', sender);

    if (!sender) {
        console.error('Sender is required but not provided');
        return res.status(400).json({ success: false, error: 'Sender is required.' });
    }

    try {
        // Get the OAuth2 client
        console.log('Getting OAuth2 client');
        const oAuth2Client = getOAuth2Client();

        // Download the token from S3 and set the credentials
        console.log('Downloading token from S3');
        const token = await downloadToken();
        if (!token) {
            console.error('Failed to retrieve token from S3');
            return res.status(500).json({ success: false, error: 'Failed to retrieve token from S3' });
        }
        console.log('Token retrieved successfully');
        oAuth2Client.setCredentials(token);

        // Initialize Gmail API client
        console.log('Initializing Gmail API client');
        const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

        // Search for messages from the specified sender
        console.log(`Searching for messages from sender: ${sender}`);
        const response = await gmail.users.messages.list({
            userId: 'me',
            q: `from:${sender}`, // Search for messages from the sender
            maxResults: 100,
        });

        console.log('Messages search response:', response.data);
        const messages = response.data.messages;

        if (messages && messages.length > 0) {
            console.log(`Found ${messages.length} messages from sender: ${sender}`);
            for (const message of messages) {
                console.log(`Marking message with ID: ${message.id} as spam`);
                await gmail.users.messages.modify({
                    userId: 'me',
                    id: message.id,
                    requestBody: {
                        addLabelIds: ['SPAM'], // Marking email as spam
                    },
                });
                console.log(`Message with ID: ${message.id} marked as spam`);
            }
        } else {
            console.log(`No messages found from sender: ${sender}`);
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
    console.log('Initializing OAuth2 client with redirect URI:', redirect_uris);
    oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris);
}

// Route to handle OAuth2 callback
app.get('/oauth2callback', async (req, res) => {
    const code = req.query.code;
    console.log('Received OAuth2 callback with code:', code);
    if (!code) {
        console.error('No code provided in OAuth2 callback');
        return res.status(400).send('No code provided.');
    }

    try {
        const oAuth2Client = getOAuth2Client();

        // Exchange the authorization code for tokens
        console.log('Exchanging authorization code for tokens');
        const { tokens } = await oAuth2Client.getToken({
            code,
            redirect_uri: process.env.REDIRECT_URI, // Explicitly set redirect_uri
        });
        console.log('Tokens received:', tokens);
        oAuth2Client.setCredentials(tokens);

        // Upload tokens to S3
        await uploadToken(tokens);
        console.log('Token uploaded successfully.');

        // Redirect to the frontend (e.g., home page)
        res.redirect('/');
    } catch (error) {
        console.error('Error during OAuth callback:', error);
        res.status(500).send('OAuth callback failed.');
    }
});

// Route to trigger OAuth2 authorization
app.get('/authorize', (req, res) => {
    try {
        const oAuth2Client = getOAuth2Client();
        console.log('Generating authorization URL');
        const authUrl = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
            redirect_uri: process.env.REDIRECT_URI,
        });
        console.log('Redirecting to authorization URL:', authUrl);
        res.redirect(authUrl);
    } catch (error) {
        console.error('Error during authorization:', error);
        res.status(500).send('Internal Server Error');
    }
});


// Start the server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});