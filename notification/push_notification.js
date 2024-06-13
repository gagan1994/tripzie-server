const axios = require('axios');
const fcmUrl = 'https://fcm.googleapis.com/fcm/send';

function send_notfication(registrationTokens, notification) {
  console.log('Data from all promises:', registrationTokens);
  const postData = {
    'registration_ids': registrationTokens,
    "notification": {
      "body": notification.body,
      "title": notification.title
    },
    "data": notification.data
  };
  const customHeaders = {
    'Authorization': 'key=AAAAdg_f35E:APA91bEgdpg4AH4lanYL7-9s18P6EotNpFKCVT8cDGwcK-uFV13e12eJAOXWfJxBADRQSvi0kn24mTTZbQeNSlWNi8zTvuDWossEJ3vXi1wAFHetwQmwJzmSs9YhC2FLXRRfrRM1qdLb', // Example of an authorization header
    'Content-Type': 'application/json' // Replace with your custom headers
  };
  axios.post(fcmUrl, postData, { headers: customHeaders })
    .then((response) => {
      console.log('notificationResponse:', response.data);
    })
    .catch((error) => {
      console.error('notification Error:', error);
    });
}

module.exports = { send_notfication };
