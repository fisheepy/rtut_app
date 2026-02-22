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

    const recipientPreview = useMemo(() => {
        return selectedEmployees.map((employee) => {
            const firstName = employee['First Name'] || employee.firstName || '';
            const lastName = employee['Last Name'] || employee.lastName || '';
            const fullName = `${firstName} ${lastName}`.trim() || employee.Name || 'Unknown Name';
            const location = employee.Location || employee.location || '-';
            const department = employee['Home Department'] || employee.homeDepartment || '-';
            const id = employee.username || employee._id || fullName;
            return { id, fullName, location, department };
        }).sort((a, b) => a.fullName.localeCompare(b.fullName));
    }, [selectedEmployees]);

    const previewLimit = 20;
    const previewEmployees = recipientPreview.slice(0, previewLimit);
    const remainingCount = Math.max(recipientPreview.length - previewLimit, 0);

    const handleCheckboxChange = (event) => {
        const { name, checked } = event.target;
        setSendOptions(prev => ({
            ...prev,
            [name]: checked,
        }));
    };

    const handleEditChange = (event) => {
        setEditContent(event.target.value);
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

            <Dialog open={openConfirmDialog} onClose={() => setOpenConfirmDialog(false)} maxWidth="md" fullWidth>
                <DialogTitle>Confirm Send Notification</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Please confirm the exact employees below. Notification will be sent only to this list.
                    </DialogContentText>

                    <FormGroup row>
                        <FormControlLabel control={<Checkbox checked={sendOptions.app} disabled />} label="App" />
                        <FormControlLabel control={<Checkbox checked={sendOptions.email} disabled />} label="Email" />
                        <FormControlLabel control={<Checkbox checked={sendOptions.sms} disabled />} label="SMS" />
                    </FormGroup>

                    <Typography sx={{ mt: 1 }}><strong>Subject:</strong> {subject || '-'}</Typography>
                    <Typography><strong>Sender:</strong> {sender || '-'}</Typography>
                    <Typography><strong>Admin User:</strong> {`${userData.firstName} ${userData.lastName}`}</Typography>

                    <Box sx={{ display: 'flex', gap: 1, my: 2, flexWrap: 'wrap' }}>
                        <Chip color="warning" label={`Selected: ${recipientPreview.length}`} />
                        <Chip color="info" label={`Previewing first: ${previewEmployees.length}`} />
                    </Box>

                    <Box sx={{ border: '1px solid #e4e7ec', borderRadius: 2, maxHeight: 340, overflowY: 'auto', background: '#fcfcfd' }}>
                        {recipientPreview.length === 0 ? (
                            <Typography sx={{ p: 2, color: '#b42318', fontWeight: 600 }}>
                                No employees are selected. Please select employees before sending notification.
                            </Typography>
                        ) : (
                            <List dense>
                                {previewEmployees.map((employee, index) => (
                                    <React.Fragment key={employee.id}>
                                        <ListItem>
                                            <ListItemText
                                                primary={`${index + 1}. ${employee.fullName}`}
                                                secondary={`Location: ${employee.location} • Department: ${employee.department}`}
                                                primaryTypographyProps={{ fontWeight: 600 }}
                                            />
                                        </ListItem>
                                        {index < previewEmployees.length - 1 && <Divider component="li" />}
                                    </React.Fragment>
                                ))}
                            </List>
                        )}
                    </Box>

                    {remainingCount > 0 && (
                        <Typography sx={{ mt: 1, color: '#475467' }}>
                            ...and {remainingCount} more employee(s) in the selected notification list.
                        </Typography>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenConfirmDialog(false)}>Cancel</Button>
                    <Button onClick={handleConfirmSendNotification} autoFocus disabled={recipientPreview.length === 0}>
                        Confirm & Send Notification
                    </Button>
                </DialogActions>
            </Dialog>
        </div >
    );
}

export default NotificationCenterComponent;
