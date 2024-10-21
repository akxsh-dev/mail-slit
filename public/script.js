// Check if URL has the authorization code as a query parameter
const urlParams = new URLSearchParams(window.location.search);
const authCode = urlParams.get('code');

if (authCode) {
    // Send the auth code to the backend for token creation and S3 upload
    fetch('/auth/code', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code: authCode })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert("Authorization successful, tokens generated and uploaded!");
        } else {
            alert("Error: " + data.message);
        }
    })
    .catch(error => {
        console.error("Error sending code to the backend:", error);
    });
}

// Event listeners for the buttons and dropdown
document.getElementById('authButton').addEventListener('click', () => {
  fetchEmails();
});

document.getElementById('sortOptions').addEventListener('change', () => {
  fetchEmails();
});

// Function to fetch emails from the backend
function fetchEmails() {
  fetch('http://localhost:3001/getEmails')
      .then(response => response.json())
      .then(data => {
          const emailList = document.getElementById('emails');
          emailList.innerHTML = '';  // Clear any existing content

          if (data.error) {
              // Display the error message returned from the backend
              emailList.innerText = `Error: ${data.error}`;
          } else {
              // Get sorting option
              const sortOption = document.getElementById('sortOptions').value;
              const entries = Object.entries(data);

              // Sort entries based on the selected option
              entries.sort((a, b) => {
                  const countA = a[1];
                  const countB = b[1];

                  if (sortOption === 'highest') {
                      return countB - countA; // Highest to Lowest
                  } else {
                      return countA - countB; // Lowest to Highest
                  }
              });

              // Populate sorted email list with unsubscribe buttons
              entries.forEach(([sender, count]) => {
                  const emailItem = document.createElement('div');
                  emailItem.textContent = `${sender}: ${count} emails `;

                  // Create unsubscribe button
                  const unsubscribeButton = document.createElement('button');
                  unsubscribeButton.textContent = 'Unsubscribe';
                  unsubscribeButton.className = 'unsubscribe-button';
                  unsubscribeButton.onclick = () => unsubscribe(sender);

                  emailItem.appendChild(unsubscribeButton);
                  emailList.appendChild(emailItem);
              });
          }
      })
      .catch(err => {
          console.error('Error fetching emails:', err);
          document.getElementById('emails').innerText = 'Error fetching emails';
      });
}

// Function to unsubscribe from a sender
function unsubscribe(sender) {
  // Send a request to unsubscribe
  fetch(`http://localhost:3001/unsubscribe`, {
      method: 'POST',
      headers: {
          'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sender })
  })
  .then(response => response.json())
  .then(data => {
      if (data.success) {
          alert(`Successfully unsubscribed from ${sender}`);
          fetchEmails(); // Refresh the email list after unsubscribing
      } else {
          alert(`Failed to unsubscribe from ${sender}: ${data.error}`);
      }
  })
  .catch(err => {
      console.error('Error unsubscribing:', err);
      alert('An error occurred while unsubscribing.');
  });
}
