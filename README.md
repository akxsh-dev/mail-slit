# Email Subscription Scanner

A Node.js application that utilizes the Gmail API to fetch and organize subscription emails from your Gmail account. The application filters emails containing the word "unsubscribe" and counts the number of emails received from each sender.

## Features

- OAuth 2.0 authentication to securely access Gmail API.
- Fetches emails containing the word "unsubscribe".
- Groups emails by sender and counts the number of emails per sender.
- Frontend and backend functionality integrated using Express.

## Prerequisites

Before you begin, ensure you have the following installed:

- [Node.js](https://nodejs.org/) (version 14 or higher)
- [npm](https://www.npmjs.com/) (Node package manager)
