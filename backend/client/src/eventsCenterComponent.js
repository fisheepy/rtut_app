import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import {
    TextField,
    Button,
    Typography,
    FormControlLabel,
    Checkbox,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
} from '@mui/material';
import moment from 'moment';
import { SelectedEmployeesContext } from './selectedEmployeesContext';
import BulkRecipientConfirmDialog from './bulkRecipientConfirmDialog';

const EventsCenterComponent = ({ event }) => {
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
            const next = { ...prevState, [name]: value };
            if (name === 'startDate' && moment(value).isAfter(moment(prevState.endDate))) {
                next.endDate = value;
            }
            if (name === 'endDate' && moment(value).isBefore(moment(prevState.startDate))) {
                next.startDate = value;
            }
            return next;
        });
    };

    const handleCheckboxChange = (e) => {
        const { name, checked } = e.target;
        setFormData(prevState => ({ ...prevState, [name]: checked }));
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

                if (formData.recurrenceType === 'weekly') currentDate.add(1, 'weeks');
                else if (formData.recurrenceType === 'bi-weekly') currentDate.add(2, 'weeks');
                else if (formData.recurrenceType === 'monthly') currentDate.add(1, 'months');
            }
            return events;
        };

        const sendEventInBatches = async (eventData, employees, batchSize) => {
            const totalBatches = Math.ceil(employees.length / batchSize);
            const timeStamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });

            for (let i = 0; i < totalBatches; i++) {
                const batch = employees.slice(i * batchSize, (i + 1) * batchSize);
                const eventWithBatch = { ...eventData, selectedEmployees: batch };
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
            for (const oneEvent of events) {
                await sendEventInBatches(oneEvent, selectedEmployees, 100);
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
        <div className="compact-tool event-compose">
            <div className="compact-tool-header">
                <div>
                    <Typography variant="h6">{event ? 'Edit Event' : 'Create Event'}</Typography>
                    <Typography className="compact-tool-status">{executionStatus}</Typography>
                </div>
                <Button type="submit" form="event-compose-form" variant="contained" color="primary">{event ? 'Update' : 'Create Event'}</Button>
            </div>

            <form id="event-compose-form" onSubmit={handleSubmit}>
                <div className="event-compose-grid">
                    <TextField name="title" label="Title" fullWidth size="small" value={formData.title} onChange={handleChange} />
                    <TextField name="creator" label="Creator" fullWidth size="small" value={formData.creator} onChange={handleChange} />
                    <TextField name="location" label="Location" fullWidth size="small" value={formData.location} onChange={handleChange} />
                    <TextField name="startDate" label="Start Date" type={formData.allDay ? 'date' : 'datetime-local'} fullWidth size="small" InputLabelProps={{ shrink: true }} value={formData.startDate} onChange={handleChange} />
                    <TextField name="endDate" label="End Date" type={formData.allDay ? 'date' : 'datetime-local'} fullWidth size="small" InputLabelProps={{ shrink: true }} value={formData.endDate} onChange={handleChange} />
                    <div className="event-toggle-row">
                        <FormControlLabel control={<Checkbox checked={formData.allDay} onChange={handleCheckboxChange} name="allDay" />} label="All Day" />
                        <FormControlLabel control={<Checkbox checked={formData.isRecurring} onChange={() => setFormData(prev => ({ ...prev, isRecurring: !prev.isRecurring }))} />} label="Recurring" />
                    </div>
                    <TextField className="event-detail-field" name="detail" label="Detail" fullWidth multiline rows={2} size="small" value={formData.detail} onChange={handleChange} />

                    {formData.isRecurring && (
                        <>
                            <FormControl fullWidth size="small">
                                <InputLabel>Recurrence Type</InputLabel>
                                <Select name="recurrenceType" value={formData.recurrenceType} onChange={handleChange} label="Recurrence Type">
                                    <MenuItem value="weekly">Weekly</MenuItem>
                                    <MenuItem value="bi-weekly">Bi-weekly</MenuItem>
                                    <MenuItem value="monthly">Monthly</MenuItem>
                                </Select>
                            </FormControl>
                            <TextField name="recurrenceEndDate" label="Recurrence End Date" type="date" fullWidth size="small" InputLabelProps={{ shrink: true }} value={formData.recurrenceEndDate} onChange={handleChange} />
                        </>
                    )}
                </div>
            </form>

            <BulkRecipientConfirmDialog
                open={openConfirmDialog}
                onClose={() => setOpenConfirmDialog(false)}
                onConfirm={executeSendEvents}
                title="Confirm Send Event"
                instruction="Please confirm the exact employees below. Event will be sent only to this list."
                confirmLabel="Confirm & Send Event"
                emptyMessage="No employees are selected. Please select employees before sending event."
                selectedEmployees={selectedEmployees}
                metadata={[
                    { label: 'Title', value: formData.title },
                    { label: 'Creator', value: formData.creator },
                    { label: 'Event Location', value: formData.location },
                ]}
            />
        </div>
    );
};

export default EventsCenterComponent;
