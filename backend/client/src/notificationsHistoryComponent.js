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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button
} from '@mui/material';

const NotificationsHistoryModule = () => {
  const [notifications, setNotifications] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentNotification, setCurrentNotification] = useState(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [executionStatus, setExecutionStatus] = useState('Status:');

  const fetchNotifications = async () => {
    try {
      const loginName = JSON.parse(localStorage.getItem('loginName'));
      const response = await axios.get(`/notifications?lastName=${loginName.lastName}&firstName=${loginName.firstName}`);
      const sortedNotifications = response.data.sort((a, b) => new Date(b.currentDataTime) - new Date(a.currentDataTime));
      setNotifications(sortedNotifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleRowClick = (notification) => {
    setCurrentNotification(notification);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
  };

  const ConfirmationDialog = () => (
    <Dialog
      open={isConfirmOpen}
      onClose={() => setIsConfirmOpen(false)}
    >
      <DialogTitle>Confirm Delete</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Are you sure you want to delete this notification? This action cannot be undone.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setIsConfirmOpen(false)}>Cancel</Button>
        <Button onClick={handleDeleteNotification} color="secondary">Delete</Button>
      </DialogActions>
    </Dialog>
  );

  const handleDeleteNotification = async () => {
    console.log("Delete Notification:", currentNotification);
    try {
      const transactionId = currentNotification.transactionId;
      console.log(transactionId);
      
      // Delete from Novu cloud
      await axios.post('/call-function-delete-notification', { transactionId: transactionId });
      setExecutionStatus(`Notification deleted successfully.`);
      // Refresh notifications
      fetchNotifications();
    } catch (error) {
      console.error('Error deleting notification:', error);
      setExecutionStatus(`Failed to delete notification.`);
    }
    // Close both dialogs after action
    setIsDialogOpen(false);
    setIsConfirmOpen(false);
  };

  return (
    <div>
      <h3>Execution Status</h3>
      <p>{executionStatus}</p>
      <h2>History Notifications</h2>
      <TableContainer component={Paper}>
        <Table aria-label="simple table">
          <TableHead>
            <TableRow>
              <TableCell>Sender</TableCell>
              <TableCell>Subject</TableCell>
              <TableCell>Send Timestamp</TableCell>
              <TableCell>Details</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {notifications.map((notification) => (
              <TableRow key={notification._id} >
                <TableCell>{notification.sender}</TableCell>
                <TableCell>{notification.subject}</TableCell>
                <TableCell>{new Date(notification.currentDataTime).toLocaleString()}</TableCell>
                <TableCell>
                  <Button variant="outlined" onClick={() => handleRowClick(notification)}>
                    Results
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {/* Dialog for displaying notification details */}
      <Dialog open={isDialogOpen} onClose={handleCloseDialog} maxWidth="lg" fullWidth>
        <DialogTitle>Notification Details</DialogTitle>
        <DialogContent>
          <DialogContentText>
            <strong>Sender:</strong> {currentNotification?.sender}
            <br />
            <strong>Subject:</strong> {currentNotification?.subject}
            <br />
            <strong>Date:</strong> {new Date(currentNotification?.currentDataTime).toLocaleString()}
            <br />
            <strong>Content:</strong> {currentNotification?.messageContent}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Close</Button>
          <Button onClick={() => setIsConfirmOpen(true)} color="secondary">Delete</Button>
        </DialogActions>
      </Dialog>
      <ConfirmationDialog />
    </div>
  );
};

export default NotificationsHistoryModule;
