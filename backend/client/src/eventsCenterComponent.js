import React, { useState, useEffect } from 'react';
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
} from '@mui/material';

const EventsCenterComponent = ({ event, setEvents, handleClose }) => {
    const [executionStatus, setExecutionStatus] = useState('Status:');
    const [formData, setFormData] = useState({
        title: '',
        startDate: '',
        endDate: '',
        creator: '',
        location: '',
        isRecurring: false,
        recurrenceType: 'weekly', // 'weekly' or 'monthly'
        recurrenceInterval: 1, // Numeric interval, used differently based on type
        monthDay: 1, // Day of the month for monthly recurrence
        weekNumber: 1, // Week of the month for weekly recurrence
        allDay: false, // Added for all-day events
    });

    // When component mounts or an event prop changes, update the form data
    useEffect(() => {
        if (event) {
            setFormData({
                title: event.title || '',
                startDate: event.startDate || '',
                endDate: event.endDate || '',
                creator: event.creator || '',
                location: event.location || '',
                isRecurring: event.isRecurring || false,
                recurrenceType: event.recurrenceType || 'weekly',
                recurrenceInterval: event.recurrenceInterval || 1,
                monthDay: event.monthDay || 1,
                weekNumber: event.weekNumber || 1,
                allDay: event.allDay || false,
            });
        }
    }, [event]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prevState => {
            const newState = {
                ...prevState,
                [name]: type === 'checkbox' ? checked : value
            };

            // Automatically set endDate to the same day as startDate for all-day events
            if (name === 'startDate' && prevState.allDay) {
                newState.endDate = value;
            }

            return newState;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Adjust dates for all-day events to ensure they are set correctly
        const adjustedFormData = {
            ...formData,
            startDate: formData.allDay ? new Date(formData.startDate).toISOString().split('T')[0] : formData.startDate,
            endDate: formData.allDay ? new Date(formData.endDate).toISOString().split('T')[0] : formData.endDate,
        };

        const eventData = {
            data: adjustedFormData,
        };
    
        axios.post('/call-function-send-event', eventData)
            .then(response => {
                const timeStamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
                setExecutionStatus(`Status:${timeStamp}:\tSend event succeeded!`);
            })
            .catch(error => {
                const timeStamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
                setExecutionStatus(`Status:${timeStamp}:\tSend event failed!`);
            });
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
                    <Grid item xs={12}>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    name="allDay"
                                    checked={formData.allDay}
                                    onChange={handleChange}
                                />
                            }
                            label="All Day Event"
                        />
                    </Grid>
                    <Grid item xs={6}>
                        <TextField
                            name="startDate"
                            label={formData.allDay ? "Start Date" : "Start Date and Time"}
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
                            label={formData.allDay ? "End Date" : "End Date and Time"}
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
                        <FormControlLabel
                            control={
                                <Checkbox
                                    name="isRecurring"
                                    checked={formData.isRecurring}
                                    onChange={handleChange}
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
                                        <MenuItem value="monthly">Monthly</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>

                            {formData.recurrenceType === 'monthly' ? (
                                <Grid item xs={6}>
                                    <TextField
                                        name="monthDay"
                                        label="Day of the Month"
                                        type="number"
                                        fullWidth
                                        value={formData.monthDay}
                                        onChange={handleChange}
                                        InputProps={{ inputProps: { min: 1, max: 31 } }}
                                    />
                                </Grid>
                            ) : (
                                <Grid item xs={6}>
                                    <TextField
                                        name="weekNumber"
                                        label="Week of the Month"
                                        type="number"
                                        fullWidth
                                        value={formData.weekNumber}
                                        onChange={handleChange}
                                        InputProps={{ inputProps: { min: 1, max: 5 } }}
                                    />
                                </Grid>
                            )}
                        </>
                    )}
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
            </form>
        </Paper>
    );
};

export default EventsCenterComponent;
