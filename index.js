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

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
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

  console.log('Current OAuth2 Client Credentials:', oAuth2Client.credentials); // Log current credentials

  const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

  try {
      const response = await gmail.users.messages.list({
          userId: 'me',
          q: 'unsubscribe',
          maxResults: 10,
      });

      const messages = response.data.messages;
      if (!messages || messages.length === 0) {
          return res.json({ message: 'No subscription emails found.' });
      }

      const emails = await Promise.all(
          messages.map(async (message) => {
              const msg = await gmail.users.messages.get({
                  userId: 'me',
                  id: message.id,
              });
              return msg.data;
          })
      );

      res.json(emails);
  } catch (error) {
      console.error('Error fetching emails:', error);
      res.status(500).json({ error: 'Error fetching emails' });
  }
});




function listEmails(auth, res) {
  const gmail = google.gmail({ version: 'v1', auth });
  
  gmail.users.messages.list(
    {
      userId: 'me',
      q: 'unsubscribe',
      maxResults: 10,
    },
    async (err, response) => {
      if (err) {
        console.error('The API returned an error:', err);
        return res.status(500).send('Failed to fetch messages');
      }

      const messages = response.data.messages || [];
      if (!messages.length) {
        return res.json({ message: 'No subscription emails found' });
      }

      const emailData = [];

      for (const message of messages) {
        try {
          const email = await gmail.users.messages.get({ userId: 'me', id: message.id });
          emailData.push({ id: message.id, snippet: email.data.snippet });
        } catch (error) {
          console.error('Error retrieving email:', error);
        }
      }

      // Return the emails as a JSON response
      res.json(emailData);
    }
  );
}


// Serve static files from the 'public' directory
app.use(express.static('public'));

// Start the server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
