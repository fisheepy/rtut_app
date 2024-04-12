import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';

const NotificationsHistoryModule = () => {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
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

    fetchNotifications();
  }, []);

  return (
    <div>
      <h2>Notifications</h2>
      <TableContainer component={Paper}>
        <Table aria-label="simple table">
          <TableHead>
            <TableRow>
              <TableCell>Sender</TableCell>
              <TableCell>Subject</TableCell>
              <TableCell>Send Timestamp</TableCell>
              <TableCell>Content</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {notifications.map((notification) => (
              <TableRow key={notification._id}>
                <TableCell>{notification.sender}</TableCell>
                <TableCell>{notification.subject}</TableCell>
                <TableCell>{new Date(notification.currentDataTime).toLocaleString()}</TableCell>
                <TableCell>{notification.messageContent}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
};

export default NotificationsHistoryModule;
