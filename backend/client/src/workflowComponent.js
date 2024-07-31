import React, { useState, useContext } from 'react';
import { SelectedEmployeesContext } from './selectedEmployeesContext';
import { Button, DialogContentText, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import axios from 'axios';

function WorkflowModule() {
    const [executionStatus, setExecutionStatus] = useState('Status:');
    const { selectedEmployees } = useContext(SelectedEmployeesContext);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const handleSendOnboarding = async () => {
        const timeStamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
        try {
            // Replace with actual API endpoint and data format
            await axios.post('/api/send-onboarding', { selectedEmployees: selectedEmployees });
            setExecutionStatus(`Status:${timeStamp}:\tOnboarding notifications sent successfully.`);
        } catch (error) {
            setExecutionStatus(`Status:${timeStamp}:\tFailed to send onboarding notifications.`);
        } finally {
            setIsDialogOpen(false);
        }
    };

    return (
        <div>
            <div>
                <Typography variant="h6">Execution Status</Typography>
                <Typography>{executionStatus}</Typography>
            </div>
            <Button variant="contained" color="primary" onClick={() => setIsDialogOpen(true)}>
                Start Onboarding Workflow
            </Button>
            <Dialog open={isDialogOpen} onClose={() => setIsDialogOpen(false)}>
                <DialogTitle>Confirm Notification</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to send notifications to the selected employees?
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setIsDialogOpen(false)} color="primary">
                        Cancel
                    </Button>
                    <Button onClick={handleSendOnboarding} color="primary">
                        Confirm
                    </Button>
                </DialogActions>
            </Dialog>
        </div>
    );
}

export default WorkflowModule;
