import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import EmployeeSelectionComponent from './employeeSelectionComponent';
import { SelectedEmployeesContext } from './selectedEmployeesContext';

function NotificationCenterComponent() {
    const [subject, setSubject] = useState('');
    const [sender, setSender] = useState('');
    const [editContent, setEditContent] = useState('');
    const [executionStatus, setExecutionStatus] = useState('Status:');
    const { selectedEmployees } = useContext(SelectedEmployeesContext);
    const [sendOptions, setSendOptions] = useState({
        app: true,
        sms: false,
        email: false,
    });

    const handleCheckboxChange = (event) => {
        const { name, checked } = event.target;
        // Update the state based on the checkbox that was clicked
        setSendOptions(prev => ({
            ...prev,
            [name]: checked,
        }));
    };

    const handleEditChange = (event) => {
        setEditContent(event.target.value);
    };

    const handleSendNotification = () => {
        // Prepare notification data
        const notificationData = {
            subject,
            sender,
            body: editContent,
            selectedEmployees,
            sendApp: sendOptions.app,
            sendEmail: sendOptions.email,
            sendSms: sendOptions.sms,
        };

        // Send notification data to the server
        axios.post('/call-function-send-notification', notificationData)
            .then(response => {
                const timeStamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
                setExecutionStatus(`Status:${timeStamp}:\tSend notifications succeeded!`);
            })
            .catch(error => {
                const timeStamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
                setExecutionStatus(`Status:${timeStamp}:\tSend notifications failed!`);
            });
    };

    return (
        <div>
            <h3>Execution Status</h3>
            <p className="execution-status">{executionStatus}</p>
            <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '20px' }}>
                <h3>Compose Notification</h3>
                <input
                    type="text"
                    placeholder="Subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    style={{ marginBottom: '10px', width: '50vw' }} // Adjust width here
                />
                <input
                    type="text"
                    placeholder="Sender"
                    value={sender}
                    onChange={(e) => setSender(e.target.value)}
                    style={{ marginBottom: '10px', width: '50vw' }} // Adjust width here
                />
                <textarea
                    value={editContent}
                    onChange={handleEditChange}
                    placeholder="Type here to compose notification..."
                    rows={10}
                    cols={50}
                    style={{ marginBottom: '10px', width: '50vw' }} // Adjust width here
                />
                <button onClick={handleSendNotification}
                    style={{ width: '300px' }}>Send Notification</button>
                <div>
                    <h3>Notification Method</h3>
                    <label>
                        <input
                            type="checkbox"
                            name="app"
                            checked={sendOptions.app}
                            onChange={handleCheckboxChange}
                        />
                        App
                    </label>
                    <label>
                        <input
                            type="checkbox"
                            name="sms"
                            checked={sendOptions.sms}
                            onChange={handleCheckboxChange}
                        />
                        SMS
                    </label>
                    <label>
                        <input
                            type="checkbox"
                            name="email"
                            checked={sendOptions.email}
                            onChange={handleCheckboxChange}
                        />
                        Email
                    </label>
                </div>
            </div>
            <hr />
            <EmployeeSelectionComponent />
            <hr />
        </div>
    );
}

export default NotificationCenterComponent;
