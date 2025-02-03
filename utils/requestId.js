// Function to generate a requestId
function generateRequestId() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'; // Allowed characters
    const minLength = 12; // Minimum length
    const maxLength = 16; // Maximum length
  
    // Generate a random length between 12 and 16
    const requestIdLength = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;
  
    let requestId = '';
    for (let i = 0; i < requestIdLength; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      requestId += characters[randomIndex];
    }
  
    return requestId;
  }
  
  // Export the function
  module.exports = generateRequestId;
  