import { findDocument } from './mongodbUtilities.mjs';
import { sendNotification, generateUniqueId } from './novuUtilities.mjs'; // Assuming sendNotification fits the use case

const collection_name = 'employees';

async function processEmployee(employee) {
    const uid = generateUniqueId(employee.firstName.toUpperCase(), employee.lastName.toUpperCase());
    
    // Using findDocument utility to check if employee is already a subscriber
    const existingSubscriber = await findDocument(collection_name, { subscriberId: uid });
    
    if (!existingSubscriber) {
        // Using sendNotification utility for identifying a subscriber if not existing
        await sendNotification('subscribers.identify', { subscriberId: uid }, {
            firstName: employee.firstName.toUpperCase(),
            lastName: employee.lastName.toUpperCase(),
            phone: "+1" + employee.phone,
            email: employee.email,
        });
    }
}

async function main() {
    try {
        // Using findDocument utility to retrieve employees
        const employees = await findDocument(collection_name, {});

        // Process each employee
        for (const employee of employees) {
            await processEmployee(employee);
        }

        console.log('Employees processed successfully');
    } catch (error) {
        console.error('Error:', error);
    }
}

main();
