document.getElementById('authButton').addEventListener('click', () => {
  fetchEmails();
});

document.getElementById('sortOptions').addEventListener('change', () => {
  fetchEmails();
});

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
