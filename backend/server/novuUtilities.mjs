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
  const filteredValuesToSend = formattedValues.map(({ email, phone, ...rest }) => {
    const toSend = { ...rest };

    if (sendOptions.email === 'true' && email) {
      toSend.email = email;
    }

    if (sendOptions.sms === 'true' && phone) {
      toSend.phone = phone;
    }

    return toSend;
  });

  try {
    await novu.trigger('rtut-general', {
      to: filteredValuesToSend,
      payload: {
        messageType: "NOTIFICATION",
        messageContent,
        subject,
        sender,
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
        const uid = generateUniqueId(employee.firstName.toUpperCase(), employee.lastName.toUpperCase());
    
        // Using findDocument utility to check if employee is already a subscriber
        const response = await novu.subscribers.get(uid);
        console.log(response.data);
        // if (!existingSubscriber) {
        //     // Using sendNotification utility for identifying a subscriber if not existing
        //     await sendNotification('subscribers.identify', { subscriberId: uid }, {
        //         firstName: employee.firstName.toUpperCase(),
        //         lastName: employee.lastName.toUpperCase(),
        //         phone: "+1" + employee.phone,
        //         email: employee.email,
        //     });
        // }
      }

      console.log('Employees processed successfully');
  } catch (error) {
      console.error('Error:', error);
  }
}