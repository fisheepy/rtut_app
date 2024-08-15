import React, { useState, useEffect, useContext } from 'react';
import './App.css';
import LoginComponent from './loginComponent';
import EmployeeSelectionComponent from './employeeSelectionComponent';
import { SelectedEmployeesProvider } from './selectedEmployeesContext';
import MenuComponent from './menuComponent';
import NotificationCenterModule from './notificationCenterComponent';
import SurveyCenterComponent from './surveyCenterComponent';
import UtilityToolsComponent from './utilityToolsComponent';
import NotificationsHistoryModule from './notificationsHistoryComponent';
import SurveysHistoryModule from './surveysHistoryComponent';
import UtilitiesCenterComponent from './utilitiesCenterComponent';
import EventsHistoryModule from './eventsHistoryComponent';
import EventsCenterComponent from './eventsCenterComponent';
import WorkflowModule from './workflowComponent';
import 'bootstrap/dist/css/bootstrap.min.css';

const componentMapping = {
  'sendNotification': NotificationCenterModule,
  'sendSurvey': SurveyCenterComponent,
  'sendEvent': EventsCenterComponent,
  'processEmployeeCsv': UtilityToolsComponent,
  'reviewNotifications': NotificationsHistoryModule,
  'reviewSurveys': SurveysHistoryModule,
  'processEmployee': UtilitiesCenterComponent,
  'reviewEvents': EventsHistoryModule,
  'processWorkflow': WorkflowModule,
};

function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [userData, setUserData] = useState({ firstName: null, lastName: null });
  const [lastActivityTime, setLastActivityTime] = useState(Date.now());
  const [selectedItem, setSelectedItem] = useState([]);
  const [componentKey, setComponentKey] = useState(null);

  useEffect(() => {
    // Check localStorage for existing login state
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUserData(parsedUser);
      setLoggedIn(true);
    }
  }, []);

  useEffect(() => {
    // Perform any setup or actions required when selectedItem changes
    setComponentKey(selectedItem.id);

    // Optional: Any cleanup actions can go here in the return function
    return () => {
      // Cleanup actions
    };
  }, [selectedItem]);

  const handleItemSelect = (item) => {
    setSelectedItem(item);
  };

  const RenderSelectedComponent = componentMapping[componentKey];

  const handleLoginSuccess = (data) => {
    setUserData(data);
    setLastActivityTime(Date.now());
    setLoggedIn(true);
    // Save user data to localStorage
    localStorage.setItem('user', JSON.stringify(data));
  };

  const handleLoginStatusChange = (status) => {
    setLoggedIn(status);
  };

  const handleLogout = () => {
    setLoggedIn(false);
    setUserData({ firstName: null, lastName: null });
    // Remove user data from localStorage
    localStorage.removeItem('user');
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
            <MenuComponent onItemSelect={handleItemSelect} />
            <div className="display-area" style={{ flex: 1, padding: '20px' }}>
              {RenderSelectedComponent ? <RenderSelectedComponent /> : "Please select a menu item."}
            </div>
            {
              componentKey !== 'reviewNotifications' &&
              componentKey !== 'reviewSurveys' &&
              componentKey !== 'reviewEvents' &&
              componentKey !== 'sendEvent' &&
              componentKey !== 'processEmployee' && (
                <div className="display-area" style={{ flex: 1, padding: '20px' }}>
                  <EmployeeSelectionComponent />
                </div>
              )}
          </div>
        </SelectedEmployeesProvider>
      )}
    </div>
  );
}

export default App;
