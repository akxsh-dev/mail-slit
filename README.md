# Email Subscription Scanner
Project Overview
The Email Subscription Scanner is a web-based application that helps users efficiently manage and unsubscribe from email subscriptions. Built using Node.js and the Gmail API, this tool automates the process of finding emails related to subscriptions and provides an easy way to unsubscribe from them directly through the interface.

Users can scan their Gmail inbox for subscription-related emails, view them categorized by sender, and with a single click, unsubscribe from unwanted email lists. This helps users declutter their inbox and reduce spam, enhancing productivity.

#Key Features
Email Scan for Subscriptions: Automatically scans the user's Gmail inbox for emails that contain "unsubscribe" links or are identified as promotional subscriptions.

Unsubscribe Functionality: Users can easily unsubscribe from unwanted emails directly from the web interface by clicking an "Unsubscribe" button for each sender. The system uses the Gmail API to mark these emails as "Spam" or unsubscribe if supported by the email provider.

OAuth2 Authentication: Utilizes Google OAuth2 for secure access to the user's Gmail account, ensuring that permissions are appropriately handled for reading and managing emails.

Custom Email Categorization: Emails are categorized based on the sender, allowing users to see how many emails they have received from each subscription source, helping them make informed decisions about unsubscribing.

Built with React & Node.js: The application’s front-end is powered by React for a dynamic user interface, while the back-end is built with Node.js to handle Gmail API requests and manage email data.

#Technologies Used
Front-end: React, HTML, CSS
Back-end: Node.js, Express.js
Google APIs: Gmail API for fetching emails and managing subscriptions
OAuth 2.0: Secure authentication with Google
Version Control: Git & GitHub for source code management
#How It Works
User Authentication: The user logs in via Google OAuth2, granting the app permission to read their Gmail inbox.
Email Scanning: The app searches for emails that contain the term "unsubscribe" or are categorized as promotional.
Unsubscribe Process: Users can click on the "Unsubscribe" button to stop receiving emails from a particular sender.
Inbox Clean-Up: The app automatically marks unwanted emails as "Spam" or initiates the unsubscribe process.
