import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { SelectedEmployeesContext } from './selectedEmployeesContext';
import { Button, DialogContentText, Dialog, DialogActions, DialogContent, DialogTitle, Checkbox, FormControlLabel, FormGroup, Typography, TextField } from '@mui/material';

function NotificationCenterComponent({ userData }) {
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
    const [openConfirmDialog, setOpenConfirmDialog] = useState(false); // State to control the confirmation dialog

    const handleCheckboxChange = (event) => {
        const { name, checked } = event.target;
        // Update the state based on the checkbox that was clicked
        setSendOptions(prev => ({
            ...prev,
            [name]: checked,
        }));
    };

    const prepareRecipientNames = () => {
        return selectedEmployees.map(emp => emp.Name).join('/ ');
    };

    const handleEditChange = (event) => {
        setEditContent(event.target.value);
    };

    const handleOpenConfirmDialog = () => {
        setOpenConfirmDialog(true);
    };

    const handleCloseConfirmDialog = () => {
        setOpenConfirmDialog(false);
    };

    const handleConfirmSendNotification = async () => {
        setOpenConfirmDialog(false); // Close the dialog
    
        const sendInBatches = async (employees, batchSize) => {
            const totalBatches = Math.ceil(employees.length / batchSize);
            const timeStamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
    
            try {
                for (let i = 0; i < totalBatches; i++) {
                    const batch = employees.slice(i * batchSize, (i + 1) * batchSize);
    
                    const notificationData = {
                        subject,
                        sender,
                        body: editContent,
                        selectedEmployees: batch,
                        sendApp: sendOptions.app,
                        sendEmail: sendOptions.email,
                        sendSms: sendOptions.sms,
                        adminUser: {
                            firstName: userData.firstName,
                            lastName: userData.lastName,
                            email: userData.email,
                        },
                    };
    
                    // Send the current batch to the backend
                    await axios.post('/call-function-send-notification', notificationData);
    
                    // Update execution status for success
                    setExecutionStatus(
                        `Status:${timeStamp}:\tBatch ${i + 1} of ${totalBatches} sent successfully.`
                    );
                }
            } catch (error) {
                setExecutionStatus(
                    `Status:${timeStamp}:\tFailed to send a batch. Error: ${error.message}`
                );
            }
        };
    
        // Call the function with a batch size of 100
        sendInBatches(selectedEmployees, 100);
    };

    return (
        <div>
            <div>
                <Typography variant="h6">Execution Status</Typography>
                <Typography>{executionStatus}</Typography>
                <Typography variant="h6">Compose Notification</Typography>
                <TextField
                    label="Subject"
                    variant="outlined"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    style={{ width: '25%', }}
                />
                <TextField
                    label="Sender"
                    variant="outlined"
                    value={sender}
                    onChange={(e) => setSender(e.target.value)}
                    style={{ width: '25%', }}
                />
            </div>
            <TextField
                label="Notification Content" 
                multiline 
                rows={10} 
                placeholder="Type here to compose notification..." 
                variant="outlined" 
                value={editContent} 
                onChange={handleEditChange} 
                fullWidth 
                style={{ marginBottom: '10px', width: '50vw',marginTop:'10px' }} 
            />
            <div>
                <FormControlLabel control={<Checkbox checked={sendOptions.app} onChange={handleCheckboxChange} name="app" />} label="App" />
                <FormControlLabel control={<Checkbox checked={sendOptions.email} onChange={handleCheckboxChange} name="email" />} label="Email" />
                <FormControlLabel control={<Checkbox checked={sendOptions.sms} onChange={handleCheckboxChange} name="sms" />} label="SMS" />
            </div>
            <Button variant="contained" onClick={handleOpenConfirmDialog} style={{ marginTop: '10px', width: '50%' }}>
                Send Notification
            </Button>
            {/* Confirmation Dialog */}
            <Dialog open={openConfirmDialog} onClose={handleCloseConfirmDialog}>
                <DialogTitle>Confirm Send Notification</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to send this notification?<br />
                        <FormGroup>
                            <FormControlLabel control={<Checkbox checked={sendOptions.app} disabled />} label="App" />
                            <FormControlLabel control={<Checkbox checked={sendOptions.email} disabled />} label="Email" />
                            <FormControlLabel control={<Checkbox checked={sendOptions.sms} disabled />} label="SMS" />
                        </FormGroup>
                        {/* Display summary of the notification */}
                        <strong>Subject: {subject}</strong><br />
                        <strong>Sender: {sender}</strong><br />
                        <strong>Content: {editContent}</strong><br />
                        <strong>Recipients:</strong> {prepareRecipientNames()}<br />
                        <strong>Admin User:</strong> {`${userData.firstName} ${userData.lastName}`}<br />
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseConfirmDialog}>Cancel</Button>
                    <Button onClick={handleConfirmSendNotification} autoFocus>
                        Confirm
                    </Button>
                </DialogActions>
            </Dialog>
        </div >
    );
}

export default NotificationCenterComponent;
