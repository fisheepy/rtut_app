import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { TextField, Button, Grid, Paper, Typography } from '@mui/material';

const EventsCenterComponent = ({ event, setEvents, handleClose }) => {
    const [executionStatus, setExecutionStatus] = useState('Status:');

    const [formData, setFormData] = useState({
        title: '',
        startDate: '',
        endDate: '',
        creator: '',
        location: ''
    });

    // When component mounts or an event prop changes, update the form data
    useEffect(() => {
        if (event) {
            setFormData({
                title: event.title || '',
                startDate: event.startDate || '',
                endDate: event.endDate || '',
                creator: event.creator || '',
                location: event.location || ''
            });
        }
    }, [event]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prevState => ({
            ...prevState,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const eventData = {
            data: formData,
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
                    <Grid item xs={6}>
                        <TextField
                            name="startDate"
                            label="Start Date"
                            type="datetime-local"
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
                            type="datetime-local"
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
