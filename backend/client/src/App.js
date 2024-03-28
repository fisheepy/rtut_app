import React, { useState, useEffect } from 'react';
import './App.css';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import NotificationCenterComponent from './notificationCenterComponent';
import LoginComponent from './loginComponent';
import SurveyCenterComponent from './surveyCenterComponent';
import UtilitiesCenterComponent from './utilitiesCenterComponent';
import { SelectedEmployeesProvider } from './selectedEmployeesContext';

function App() {
  const [loggedIn, setLoggedIn] = useState(true);
  const [value, setValue] = useState(0);
  const [userData, setUserData] = useState({ firstName: null, lastName: null });
  const [lastActivityTime, setLastActivityTime] = useState(Date.now());

  const handleLoginSuccess = (data) => {
    setUserData(data);
    setLastActivityTime(Date.now());
  };

  const handleLoginStatusChange = (status) => {
    setLoggedIn(status);
  };

  const handleLogout = () => {
    setLoggedIn(false);
    setUserData({ firstName: null, lastName: null });
  };

  const handleActivity = () => {
    setLastActivityTime(Date.now());
  };

  const handleTabChange = (event, newTabValue) => {
    setValue(newTabValue);
  };

  function CustomTabPanel({ value, index, children }) {
    return (
      <div role="tabpanel" hidden={value !== index}>
        {value === index && <Box p={3}>{children}</Box>}
      </div>
    );
  }

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsedTime = now - lastActivityTime;

      if (elapsedTime >= 30 * 60 * 1000) {
        handleLogout();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lastActivityTime]);

  return (
    <div>
      {!loggedIn ? (
        <LoginComponent onLoginStatusChange={handleLoginStatusChange} onLoginSuccess={handleLoginSuccess} />
      ) : (
        <SelectedEmployeesProvider>
          <div>
            <p>Welcome, {userData.firstName}!</p>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={value} onChange={handleTabChange} aria-label="basic tabs example">
                <Tab label="Notification Center" />
                <Tab label="Survey Center" />
                <Tab label="Utility" />
              </Tabs>
            </Box>
            <CustomTabPanel value={value} index={0}>
              <NotificationCenterComponent />
            </CustomTabPanel>
            <CustomTabPanel value={value} index={1}>
              <SurveyCenterComponent />
            </CustomTabPanel>
            <CustomTabPanel value={value} index={2}>
              <UtilitiesCenterComponent />
            </CustomTabPanel>
          </div>
        </SelectedEmployeesProvider>
      )}
    </div>
  );
}

export default App;
