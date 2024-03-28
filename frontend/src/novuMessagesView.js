const { Novu } = require('@novu/node');

const novu = new Novu('600d3c9b796776ce850d7db532af437c');

const params = {
  page: 0, // optional
  limit: 20, // optional
  subscriberId: "eb2ca0b8d21197f40bf64cef853dfdf6c75b1b67d2274fb15077f41d8fe416a3",  //optional
}

// Fetch messages using Novu API
const fetchMessages = async () => {
    try {
      const messages = await novu.messages.list(params);
      console.log('Messages:', messages);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };
  
  // Call the function to fetch messages
  fetchMessages();