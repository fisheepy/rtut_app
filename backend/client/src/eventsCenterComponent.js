import React, { useState, useEffect, useContext, useMemo } from 'react';
import axios from 'axios';
import {
    TextField,
    Button,
    Grid,
    Paper,
    Typography,
    FormControlLabel,
    Checkbox,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
    Box,
    Chip,
    List,
    ListItem,
    ListItemText,
    Divider,
} from '@mui/material';
import moment from 'moment';
import { SelectedEmployeesContext } from './selectedEmployeesContext';

const EventsCenterComponent = ({ event, setEvents, handleClose }) => {
    const [executionStatus, setExecutionStatus] = useState('Status:');
    const [formData, setFormData] = useState({
        title: '',
        startDate: '',
        endDate: '',
        creator: '',
        location: '',
        detail: '',
        isRecurring: false,
        recurrenceType: 'weekly',
        monthDay: 1,
        allDay: false,
        recurrenceEndDate: '', 
    });
    const { selectedEmployees } = useContext(SelectedEmployeesContext);
    const [openConfirmDialog, setOpenConfirmDialog] = useState(false);

    const recipientPreview = useMemo(() => {
        return selectedEmployees.map((employee) => {
            const firstName = employee['First Name'] || employee.firstName || '';
            const lastName = employee['Last Name'] || employee.lastName || '';
            const fullName = `${firstName} ${lastName}`.trim() || employee.Name || 'Unknown Name';
            const empLocation = employee.Location || employee.location || '-';
            const department = employee['Home Department'] || employee.homeDepartment || '-';
            const id = employee.username || employee._id || fullName;
            return { id, fullName, location: empLocation, department };
        }).sort((a, b) => a.fullName.localeCompare(b.fullName));
    }, [selectedEmployees]);

    const previewLimit = 20;
    const previewEmployees = recipientPreview.slice(0, previewLimit);
    const remainingCount = Math.max(recipientPreview.length - previewLimit, 0);

    useEffect(() => {
        if (event) {
            setFormData({
                title: event.title || '',
                startDate: event.startDate || '',
                endDate: event.endDate || '',
                creator: event.creator || '',
                location: event.location || '',
                detail: event.detail || '',
                allDay: event.allDay || false,
                isRecurring: event.isRecurring || false,
                recurrenceType: event.recurrenceType || 'weekly',
                monthDay: event.monthDay || 1,
                recurrenceEndDate: event.recurrenceEndDate || '',
            });
        }
    }, [event]);

    const handleChange = (e) => {
        const { name, value } = e.target;

        setFormData(prevState => {
            let newFormData = { ...prevState, [name]: value };

            if (name === "startDate") {
                // If startDate is changed, check if it is after the current endDate
                if (moment(value).isAfter(moment(prevState.endDate))) {
                    newFormData.endDate = value; // Set endDate to be the same as startDate
                }
            }

            if (name === "endDate") {
                // If endDate is changed, check if it is before the current startDate
                if (moment(value).isBefore(moment(prevState.startDate))) {
                    newFormData.startDate = value; // Set startDate to be the same as endDate
                }
            }

            return newFormData;
        });
    };

    const handleCheckboxChange = (e) => {
        const { name, checked } = e.target;
        setFormData(prevState => ({
            ...prevState,
            [name]: checked
        }));
    };

    const executeSendEvents = async () => {
        const createEvent = async (eventData) => {
            try {
                await axios.post('/call-function-send-event', eventData);
                const timeStamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
                setExecutionStatus(prev => `${prev}\nStatus:${timeStamp}:\tSend event succeeded!`);
            } catch (error) {
                const timeStamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
                setExecutionStatus(prev => `${prev}\nStatus:${timeStamp}:\tSend event failed! Error: ${error.message}`);
            }
        };
    
        const createRecurringEvents = () => {
            let currentDate = moment(formData.startDate);
            const endRecurrenceDate = moment(formData.recurrenceEndDate);
            const events = [];
    
            while (currentDate.isBefore(endRecurrenceDate) || currentDate.isSame(endRecurrenceDate, 'day')) {
                const endEventDate = formData.allDay
                    ? currentDate.clone().endOf('day').startOf('day')
                    : moment(formData.endDate).clone().add(currentDate.diff(moment(formData.startDate)), 'milliseconds');
    
                events.push({
                    ...formData,
                    startDate: currentDate.toISOString(),
                    endDate: endEventDate.toISOString(),
                });
    
                if (formData.recurrenceType === 'weekly') {
                    currentDate.add(1, 'weeks');
                } else if (formData.recurrenceType === 'bi-weekly') {
                    currentDate.add(2, 'weeks');
                } else if (formData.recurrenceType === 'monthly') {
                    currentDate.add(1, 'months');
                }
            }
    
            return events;
        };
    
        const sendEventInBatches = async (eventData, employees, batchSize) => {
            const totalBatches = Math.ceil(employees.length / batchSize);
            const timeStamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
    
            for (let i = 0; i < totalBatches; i++) {
                const batch = employees.slice(i * batchSize, (i + 1) * batchSize);
    
                const eventWithBatch = {
                    ...eventData,
                    selectedEmployees: batch,
                };
    
                try {
                    await createEvent({ data: eventWithBatch });
                    setExecutionStatus(prev => `${prev}\nStatus:${timeStamp}:\tBatch ${i + 1} of ${totalBatches} sent successfully.`);
                } catch (error) {
                    setExecutionStatus(prev => `${prev}\nStatus:${timeStamp}:\tBatch ${i + 1} of ${totalBatches} failed! Error: ${error.message}`);
                }
            }
        };
    
        if (formData.isRecurring) {
            const events = createRecurringEvents();
            for (const event of events) {
                await sendEventInBatches(event, selectedEmployees, 100);
            }
        } else {
            await sendEventInBatches(formData, selectedEmployees, 100);
        }

        setOpenConfirmDialog(false);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setOpenConfirmDialog(true);
    };
    

    return (
        <Paper style={{ padding: 16 }}>
            <div>
                <h3>Execution Status</h3>
                <p className="execution-status">{executionStatus}</p>
            </div>
            <Typography variant="h6">{event ? 'Edit Event' : 'Create Event'}</Typography>
            <form onSubmit={handleSubmit}>
                <Grid container alignItems="flex-start" spacing={2}>
                    <Grid item xs={12}>
                        <TextField
                            name="title"
                            label="Title"
                            fullWidth
                            value={formData.title}
                            onChange={handleChange}
                        />
                    </Grid>
                    <Grid item xs={6}>
                        <TextField
                            name="startDate"
                            label="Start Date"
                            type={formData.allDay ? "date" : "datetime-local"}
                            fullWidth
                            InputLabelProps={{
                                shrink: true,
                            }}
                            value={formData.startDate}
                            onChange={handleChange}
                        />
                    </Grid>
                    <Grid item xs={6}>
                        <TextField
                            name="endDate"
                            label="End Date"
                            type={formData.allDay ? "date" : "datetime-local"}
                            fullWidth
                            InputLabelProps={{
                                shrink: true,
                            }}
                            value={formData.endDate}
                            onChange={handleChange}
                        />
                    </Grid>
                    <Grid item xs={12}>
                        <TextField
                            name="creator"
                            label="Creator"
                            fullWidth
                            value={formData.creator}
                            onChange={handleChange}
                        />
                    </Grid>
                    <Grid item xs={12}>
                        <TextField
                            name="location"
                            label="Location"
                            fullWidth
                            value={formData.location}
                            onChange={handleChange}
                        />
                    </Grid>
                    <Grid item xs={12}>
                        <TextField
                            name="detail"
                            label="Detail"
                            fullWidth
                            multiline
                            rows={4}
                            value={formData.detail}
                            onChange={handleChange}
                        />
                    </Grid>
                    <Grid item xs={12}>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={formData.allDay}
                                    onChange={handleCheckboxChange}
                                    name="allDay"
                                />
                            }
                            label="All Day"
                        />
                    </Grid>
                    <Grid item style={{ marginTop: 16 }}>
                        <Button
                            type="submit"
                            variant="contained"
                            color="primary"
                        >
                            {event ? 'Update' : 'Create'}
                        </Button>
                    </Grid>
                </Grid>
                <Grid item xs={12}>
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={formData.isRecurring}
                                onChange={() => setFormData(prev => ({ ...prev, isRecurring: !prev.isRecurring }))}
                            />
                        }
                        label="Is Recurring"
                    />
                </Grid>

                {formData.isRecurring && (
                    <>
                        <Grid item xs={12}>
                            <FormControl fullWidth>
                                <InputLabel>Recurrence Type</InputLabel>
                                <Select
                                    name="recurrenceType"
                                    value={formData.recurrenceType}
                                    onChange={handleChange}
                                >
                                    <MenuItem value="weekly">Weekly</MenuItem>
                                    <MenuItem value="bi-weekly">Bi-weekly</MenuItem>
                                    <MenuItem value="monthly">Monthly</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={6}>
                            <TextField
                                name="recurrenceEndDate"
                                label="Recurrence End Date"
                                type="date"
                                fullWidth
                                InputLabelProps={{
                                    shrink: true,
                                }}
                                value={formData.recurrenceEndDate}
                                onChange={handleChange}
                            />
                        </Grid>
                    </>
                )}
            </form>

            <Dialog open={openConfirmDialog} onClose={() => setOpenConfirmDialog(false)} maxWidth="md" fullWidth>
                <DialogTitle>Confirm Send Event</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Please confirm the exact employees below. Event will be sent only to this list.
                    </DialogContentText>

                    <Typography sx={{ mt: 1 }}><strong>Title:</strong> {formData.title || '-'}</Typography>
                    <Typography><strong>Creator:</strong> {formData.creator || '-'}</Typography>
                    <Typography><strong>Event Location:</strong> {formData.location || '-'}</Typography>

                    <Box sx={{ display: 'flex', gap: 1, my: 2, flexWrap: 'wrap' }}>
                        <Chip color="warning" label={`Selected: ${recipientPreview.length}`} />
                        <Chip color="info" label={`Previewing first: ${previewEmployees.length}`} />
                    </Box>

                    <Box sx={{ border: '1px solid #e4e7ec', borderRadius: 2, maxHeight: 340, overflowY: 'auto', background: '#fcfcfd' }}>
                        {recipientPreview.length === 0 ? (
                            <Typography sx={{ p: 2, color: '#b42318', fontWeight: 600 }}>
                                No employees are selected. Please select employees before sending event.
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
                            ...and {remainingCount} more employee(s) in the selected event list.
                        </Typography>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenConfirmDialog(false)}>Cancel</Button>
                    <Button onClick={executeSendEvents} color="primary" disabled={recipientPreview.length === 0}>
                        Confirm & Send Event
                    </Button>
                </DialogActions>
            </Dialog>
        </Paper>
    );
};

export default EventsCenterComponent;
