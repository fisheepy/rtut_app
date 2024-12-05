import React, { useState, useContext, useCallback } from 'react';
import { SelectedEmployeesContext } from './selectedEmployeesContext';
import { Button, DialogContentText, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';
import axios from 'axios';

function WorkflowModule() {
    const [executionStatus, setExecutionStatus] = useState('Status:');
    const { selectedEmployees } = useContext(SelectedEmployeesContext);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isConfirmOnboardingOpen, setIsConfirmOnboardingOpen] = useState(false); // State for onboarding confirmation
    const [isActivateDialogOpen, setIsActivateDialogOpen] = useState(false);
    const [fileForActivation, setFileForActivation] = useState(null);

    const handleSendOnboarding = async () => {
        const sendInBatches = async (employees, batchSize) => {
            const timeStamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
            const totalBatches = Math.ceil(employees.length / batchSize);

            try {
                for (let i = 0; i < totalBatches; i++) {
                    const batch = employees.slice(i * batchSize, (i + 1) * batchSize);
                    console.log(batch);
                    await axios.post('/call-function-send-onboarding', { batch });
                    setExecutionStatus(`Status:${timeStamp}:\tBatch ${i + 1} of ${totalBatches} sent successfully.`);
                }
            } catch (error) {
                setExecutionStatus(`Status:${timeStamp}:\tFailed to send a batch. Error: ${error.message}`);
            } finally {
                setIsConfirmOnboardingOpen(false);
            }
        };

        // Call the function with a batch size of 100
        sendInBatches(selectedEmployees, 100);
    };

    const handleActivateAppUsage = async () => {
        if (!fileForActivation) {
            setExecutionStatus('Status: No file selected for activation.');
            return;
        }

        const timeStamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
        try {
            Papa.parse(fileForActivation, {
                header: true,
                skipEmptyLines: true,
                complete: async (results) => {
                    const filteredData = results.data.map(({ Phone, Email, 'Payroll Name: Last Name': lastName, 'Payroll Name: First Name': firstName, 'Hire/Rehire Date': hireDate, 'Position Status': positionStatus, 'Home Department Description': homeDepartment, 'Job Title Description': jobTitle, 'Location Description': location, 'Reports To Name': reportTo, 'Worker Category Description': workCategory, 'Regular Pay Rate Description': payCategory, 'EEO Establishment': eeoEstablishment }) => ({
                        Phone,
                        Email,
                        lastName,
                        firstName,
                        hireDate,
                        positionStatus,
                        homeDepartment,
                        jobTitle,
                        location,
                        reportTo,
                        workCategory,
                        payCategory,
                        eeoEstablishment,
                    }));

                    await axios.post('/call-function-activate-app-usage', filteredData);

                    setExecutionStatus(`Status:${timeStamp}:\tActivation processed successfully.`);
                },
            });
        } catch (error) {
            console.error('Error processing activation:', error);
            setExecutionStatus(`Status:${timeStamp}:\tFailed to process activation.`);
        } finally {
            setIsActivateDialogOpen(false);
        }
    };

    const onDrop = useCallback(acceptedFiles => {
        setFileForActivation(acceptedFiles[0]);
        setExecutionStatus("Status: File ready for activation.");
    }, []);

    const onDropRejected = useCallback(rejectedFiles => {
        setExecutionStatus("Status: No valid CSV file selected.");
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        onDropRejected,
        accept: 'text/csv, application/vnd.ms-excel, .csv',
        maxFiles: 1,
        noClick: true,
        noKeyboard: true
    });

    return (
        <div>
            <div>
                <Typography variant="h6">Execution Status</Typography>
                <Typography>{executionStatus}</Typography>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px', alignItems: 'center' }}>
                <Button variant="contained" color="primary" onClick={() => setIsConfirmOnboardingOpen(true)} style={{ width: '200px' }}>
                    Start Onboarding Workflow
                </Button>
                <Button variant="contained" color="secondary" onClick={() => setIsActivateDialogOpen(true)} style={{ width: '200px' }}>
                    Activate App Usage
                </Button>
            </div>

            {/* Confirmation dialog for onboarding */}
            <Dialog open={isConfirmOnboardingOpen} onClose={() => setIsConfirmOnboardingOpen(false)}>
                <DialogTitle>Confirm Onboarding Workflow</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to start the onboarding workflow for the selected employees?
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setIsConfirmOnboardingOpen(false)} color="primary">
                        Cancel
                    </Button>
                    <Button onClick={handleSendOnboarding} color="primary">
                        Confirm
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={isActivateDialogOpen} onClose={() => setIsActivateDialogOpen(false)}>
                <DialogTitle>Upload Activation File</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Please upload a CSV file with the users to activate.
                    </DialogContentText>
                    <div {...getRootProps()} style={{
                        border: '2px dashed #007bff',
                        borderRadius: '5px',
                        padding: '20px',
                        textAlign: 'center',
                        marginTop: '20px',
                    }}>
                        <input {...getInputProps()} />
                        {isDragActive ? <p>Drop the CSV file here ...</p> : <p>Drag 'n' drop a CSV file here</p>}
                    </div>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setIsActivateDialogOpen(false)} color="primary">
                        Cancel
                    </Button>
                    <Button onClick={handleActivateAppUsage} color="primary">
                        Confirm
                    </Button>
                </DialogActions>
            </Dialog>
        </div>
    );
}

export default WorkflowModule;
