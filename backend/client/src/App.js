import React, { useState, useEffect } from 'react';
import './App.css';
import LoginComponent from './loginComponent';
import EmployeeSelectionComponent from './employeeSelectionComponent';
import { SelectedEmployeesProvider } from './selectedEmployeesContext';
import MenuComponent from './menuComponent';
import NotificationCenterModule from './notificationCenterComponent';
import SurveyCenterComponent from './surveyCenterComponent';

const componentMapping = {
  'createNotification': NotificationCenterModule,
  'createSurvey': SurveyCenterComponent,
  // Add other mappings as necessary.
};

const menuItems = [
  {
    id: 'notification',
    label: 'Notification',
    subItems: [
      { id: 'createNotification', label: 'Create Notification' },
      { id: 'reviewNotification', label: 'Review Notifications' },
    ],
  },
  { 
    id: 'survey',
    label: 'Survey',
    subItems: [
      { id: 'createSurvey', label: 'Create Survey'},
      { id: 'reviewSurvey', label: 'Review Survey'},
    ],
  },
  {
    id: 'utility',
    label: 'Utility',
    subItems: [
      { id: 'tools', label: 'Tools' },
      { id: 'settings', label: 'Settings' },
    ],
  },
  { id: 'userProfile', label: 'User Profile' },
];

function App() {
  const [loggedIn, setLoggedIn] = useState(true);
  const [userData, setUserData] = useState({ firstName: null, lastName: null });
  const [lastActivityTime, setLastActivityTime] = useState(Date.now());
  const [selectedItem, setSelectedItem] = useState(menuItems[0]);

  const handleMenuItemSelect = (item) => {
    setSelectedItem(item);
  };

  console.log(selectedItem);
  const RenderSelectedComponent = componentMapping[selectedItem.id];
  console.log(RenderSelectedComponent);

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
            <MenuComponent items={menuItems} onSelect={handleMenuItemSelect} />
            <div className="display-area" style={{ flex: 1, padding: '20px' }}>
            {RenderSelectedComponent ? <RenderSelectedComponent /> : "Please select a menu item."}
            </div>
            <div className="display-area" style={{ flex: 1, padding: '20px' }}>
              <EmployeeSelectionComponent />
            </div>
          </div>
        </SelectedEmployeesProvider>
      )}
    </div>
  );
}

export default App;
