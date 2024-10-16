// Import necessary modules
const fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis');
const express = require('express');
const bodyParser = require('body-parser');
require('dotenv').config();

// Initialize the Express application
const app = express();
app.use(bodyParser.json());

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly',
                'https://www.googleapis.com/auth/gmail.modify'];
const TOKEN_PATH = 'token.json';

let oAuth2Client;

// Load client secrets from a local file and authorize the client
fs.readFile('client_id.json', (err, content) => {
    if (err) {
        return console.error('Error loading client secret file:', err);
    }
    authorize(JSON.parse(content));
});

// Function to authorize the client and obtain the OAuth2 client
function authorize(credentials) {
    const { client_secret, client_id, redirect_uris } = credentials.web;
    oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    fs.readFile(TOKEN_PATH, (err, token) => {
        if (err) {
            return getAccessToken(oAuth2Client);
        }
        oAuth2Client.setCredentials(JSON.parse(token));
        console.log('Tokens loaded, ready to fetch emails!');
    });
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

    rl.question('Enter the code from that page here: ', (code) => {
        rl.close();
        oAuth2Client.getToken(code, (err, token) => {
            if (err) {
                console.error('Error retrieving access token', err); // Log detailed error
                return; // Exit early if there's an error
            }
            console.log('Retrieved token:', token); // Log the retrieved token
            oAuth2Client.setCredentials(token);
            fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
                if (err) {
                    console.error('Error writing token to file:', err); // Log error for file writing
                    return;
                }
                console.log('Token stored to', TOKEN_PATH);
            });
            console.log('Tokens stored, ready to fetch emails!');
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
        // Here, you would implement the actual unsubscription logic
        // The logic could be a specific action like marking the email as spam or managing subscriptions

        // Example: Marking the sender's emails as spam (you can adjust the logic as needed)
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

// Serve static files from the 'public' directory
app.use(express.static('public'));

// Start the server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
