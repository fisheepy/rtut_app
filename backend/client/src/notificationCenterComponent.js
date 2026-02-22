import React, { useState, useContext } from 'react';
import axios from 'axios';
import { SelectedEmployeesContext } from './selectedEmployeesContext';
import { Button, Checkbox, FormControlLabel, FormGroup, Typography, TextField } from '@mui/material';
import BulkRecipientConfirmDialog from './bulkRecipientConfirmDialog';
import React, { useState, useContext, useMemo } from 'react';
import axios from 'axios';
import { SelectedEmployeesContext } from './selectedEmployeesContext';
import {
    Button,
    DialogContentText,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Checkbox,
    FormControlLabel,
    FormGroup,
    Typography,
    TextField,
    Box,
    Chip,
    List,
    ListItem,
    ListItemText,
    Divider,
} from '@mui/material';

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
    const [openConfirmDialog, setOpenConfirmDialog] = useState(false);

    const handleCheckboxChange = (event) => {
        const { name, checked } = event.target;
        setSendOptions(prev => ({ ...prev, [name]: checked }));
    };

    const handleConfirmSendNotification = async () => {
        setOpenConfirmDialog(false);

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

                    await axios.post('/call-function-send-notification', notificationData);
                    setExecutionStatus(`Status:${timeStamp}:\tBatch ${i + 1} of ${totalBatches} sent successfully.`);
                }
            } catch (error) {
                setExecutionStatus(`Status:${timeStamp}:\tFailed to send a batch. Error: ${error.message}`);
            }
        };

        sendInBatches(selectedEmployees, 100);
    };

    const channelsSummary = (
        <FormGroup row>
            <FormControlLabel control={<Checkbox checked={sendOptions.app} disabled />} label="App" />
            <FormControlLabel control={<Checkbox checked={sendOptions.email} disabled />} label="Email" />
            <FormControlLabel control={<Checkbox checked={sendOptions.sms} disabled />} label="SMS" />
        </FormGroup>
    );

    return (
        <div>
            <div>
                <Typography variant="h6">Execution Status</Typography>
                <Typography>{executionStatus}</Typography>
                <Typography variant="h6">Compose Notification</Typography>
                <TextField label="Subject" variant="outlined" value={subject} onChange={(e) => setSubject(e.target.value)} style={{ width: '25%' }} />
                <TextField label="Sender" variant="outlined" value={sender} onChange={(e) => setSender(e.target.value)} style={{ width: '25%' }} />
            </div>
            <TextField
                label="Notification Content"
                multiline
                rows={10}
                placeholder="Type here to compose notification..."
                variant="outlined"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                fullWidth
                style={{ marginBottom: '10px', width: '50vw', marginTop: '10px' }}
            />
            <div>
                <FormControlLabel control={<Checkbox checked={sendOptions.app} onChange={handleCheckboxChange} name="app" />} label="App" />
                <FormControlLabel control={<Checkbox checked={sendOptions.email} onChange={handleCheckboxChange} name="email" />} label="Email" />
                <FormControlLabel control={<Checkbox checked={sendOptions.sms} onChange={handleCheckboxChange} name="sms" />} label="SMS" />
            </div>
            <Button variant="contained" onClick={() => setOpenConfirmDialog(true)} style={{ marginTop: '10px', width: '50%' }}>
                Send Notification
            </Button>

            <BulkRecipientConfirmDialog
                open={openConfirmDialog}
                onClose={() => setOpenConfirmDialog(false)}
                onConfirm={handleConfirmSendNotification}
                title="Confirm Send Notification"
                instruction="Please confirm the exact employees below. Notification will be sent only to this list."
                confirmLabel="Confirm & Send Notification"
                emptyMessage="No employees are selected. Please select employees before sending notification."
                selectedEmployees={selectedEmployees}
                topContent={channelsSummary}
                metadata={[
                    { label: 'Subject', value: subject },
                    { label: 'Sender', value: sender },
                    { label: 'Admin User', value: `${userData.firstName} ${userData.lastName}` },
                ]}
            />
        </div>
    );
}

export default NotificationCenterComponent;
