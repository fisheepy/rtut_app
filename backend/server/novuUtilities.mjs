import { Novu } from '@novu/node';
import crypto from 'crypto';

const novu = new Novu(process.env.NOVU_API);

function generateUniqueId(firstName, lastName) {
  const nameString = `${firstName}${lastName}`;
  const hash = crypto.createHash('sha256');
  hash.update(nameString);
  return hash.digest('hex');
}

export const triggerSurveyNotification = async (formattedValues, surveyQuestionsString, subject, sender, uniqueId) => {
  try {
    await novu.trigger('rtut-survey', {
      to: formattedValues,
      payload: {
        messageType: "SURVEY",
        messageContent: surveyQuestionsString,
        subject: subject,
        sender: sender,
        uniqueId: uniqueId
      }
    });
    console.log('Survey sent successfully');
  } catch (error) {
    console.error('Error triggering survey notification:', error.message);
  }
};

export async function sendNovuNotification(formattedValues, messageContent, subject, sender, sendOptions) {
  const filteredValuesToSend = formattedValues.map(({ Email, Phone, ...rest }) => {
    const toSend = { ...rest };

    if (sendOptions.email === 'true' && Email) {
      toSend.email = Email;
    }
    
    if (sendOptions.sms === 'true' && Phone) {
      toSend.phone = Phone;
    }

    return toSend;
  });
  
  console.log(filteredValuesToSend);

  try {
    await novu.trigger('rtut-general', {
      to: filteredValuesToSend,
      payload: {
        messageType: "NOTIFICATION",
        messageContent,
        subject,
        sender,
        sendOptions,
      }
    });
    console.log('Notifications sent successfully');
  } catch (error) {
    console.error('Error triggering Novu notification:', error);
    throw error;
  }
}

export async function sendNotification(triggerIdentifier, to, payload) {
  try {
    await novu.trigger(triggerIdentifier, {
      to,
      payload,
    });
    console.log('Notification sent successfully');
  } catch (error) {
    console.error('Error sending notification:', error);
    throw error;
  }
}

export async function listNotifications(subscriberId) {
  try {
    const params = {
      subscriberId: subscriberId  //optional
    }
    await novu.messages.list(params);
    console.log('Notification listed successfully');
  } catch (error) {
    console.error('Error listing notification:', error);
    throw error;
  }
}

export async function updateEmployeesToNovuSubscribers(employees) {
  try {
      // Process each employee
      for (const employee of employees) {
        const uid = generateUniqueId(employee['First Name'].toUpperCase(), employee['Last Name'].toUpperCase());
    
        // Using findDocument utility to check if employee is already a subscriber
        const response = await novu.subscribers.get(uid);
        const subscriber = response.data;
        if (subscriber) {
          // Start with mandatory fields
          const subscriberData = {
              firstName: employee['First Name'],
              lastName: employee['Last Name'],
          };
      
          // Add email if it's a valid value
          if (employee['Email'] && typeof employee['Email'] === 'string' && employee['Email'].includes('@')) {
              subscriberData.email = employee['Email'];
          }
      
          // Add phone if it's a valid value
          if (employee['Phone'] && typeof employee['Phone'] === 'string' && employee['Phone'].trim().length > 0) {
              subscriberData.phone = employee['Phone'];
          }
      
          await novu.subscribers.identify(uid, subscriberData);
      }
        console.log('Renew', employee['First Name']);
      }

      console.log('Employees processed successfully');
  } catch (error) {
      console.error('Error:', error);
  }
}