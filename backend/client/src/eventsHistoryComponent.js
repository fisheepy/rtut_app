import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
} from '@mui/material';

const EventsHistoryModule = () => {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const loginName = JSON.parse(localStorage.getItem('loginName'));
        const response = await axios.get(`/events?lastName=${loginName.lastName}&firstName=${loginName.firstName}`);
        setEvents(response.data);
      } catch (error) {
        console.error('Error fetching events:', error);
      }
    };

    fetchEvents();
  }, []);

  const handleEditClick = (event) => {
    setSelectedEvent(event);
    setIsEditDialogOpen(true);
  };

  const handleDeleteClick = (event) => {
    setSelectedEvent(event);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      await axios.post(`/call-function-delete-event`, { eventId: selectedEvent._id });
      setEvents((prevEvents) => prevEvents.filter((e) => e._id !== selectedEvent._id));
      setIsDeleteDialogOpen(false);
    } catch (error) {
      console.error('Error deleting event:', error);
    }
  };

  const handleEditSubmit = async () => {
    try {
      await axios.post(`/call-function-update-event`, { eventId: selectedEvent._id, updatedEvent: selectedEvent });
      setEvents((prevEvents) => prevEvents.map((e) => (e._id === selectedEvent._id ? selectedEvent : e)));
      setIsEditDialogOpen(false);
    } catch (error) {
      console.error('Error updating event:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSelectedEvent((prevEvent) => ({
      ...prevEvent,
      [name]: value,
    }));
  };

  return (
    <div>
      <h2>Events</h2>
      <TableContainer component={Paper}>
        <Table aria-label="simple table">
          <TableHead>
            <TableRow>
              <TableCell>Title</TableCell>
              <TableCell>Start Date</TableCell>
              <TableCell>End Date</TableCell>
              <TableCell>Creator</TableCell>
              <TableCell>Location</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {events.map((event) => (
              <TableRow key={event._id}>
                <TableCell>{event.title}</TableCell>
                <TableCell>{event.startDate}</TableCell>
                <TableCell>{event.endDate}</TableCell>
                <TableCell>{event.creator}</TableCell>
                <TableCell>{event.location}</TableCell>
                <TableCell>
                  <Button variant="outlined" onClick={() => handleEditClick(event)}>Edit</Button>
                  <Button variant="outlined" color="secondary" onClick={() => handleDeleteClick(event)}>Delete</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Edit Event Dialog */}
      <Dialog open={isEditDialogOpen} onClose={() => setIsEditDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit Event</DialogTitle>
        <DialogContent>
          {selectedEvent && (
            <form>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Title"
                    name="title"
                    value={selectedEvent.title}
                    onChange={handleChange}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Start Date"
                    name="startDate"
                    type="datetime-local"
                    value={selectedEvent.startDate}
                    onChange={handleChange}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="End Date"
                    name="endDate"
                    type="datetime-local"
                    value={selectedEvent.endDate}
                    onChange={handleChange}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Creator"
                    name="creator"
                    value={selectedEvent.creator}
                    onChange={handleChange}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Location"
                    name="location"
                    value={selectedEvent.location}
                    onChange={handleChange}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Detail"
                    name="detail"
                    value={selectedEvent.detail}
                    onChange={handleChange}
                    multiline
                    rows={4}
                  />
                </Grid>
              </Grid>
            </form>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleEditSubmit} color="primary">Save</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onClose={() => setIsDeleteDialogOpen(false)}>
        <DialogTitle>Delete Event</DialogTitle>
        <DialogContent>
          Are you sure you want to delete this event?
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="secondary">Delete</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default EventsHistoryModule;
