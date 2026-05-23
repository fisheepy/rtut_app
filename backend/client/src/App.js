import React, { useState, useEffect } from 'react';
import './App.css';
import EmployeeSelectionComponent from './employeeSelectionComponent';
import { SelectedEmployeesProvider } from './selectedEmployeesContext';
import MenuComponent, { menuItems } from './menuComponent';
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
  const [checkingSession, setCheckingSession] = useState(true);
  const [userData, setUserData] = useState({ firstName: null, lastName: null });
  const [selectedItem, setSelectedItem] = useState(menuItems[0]);
  const [componentKey, setComponentKey] = useState(menuItems[0].id);

  useEffect(() => {
    fetch('/api/admin-auth/me')
      .then(response => {
        if (!response.ok) {
          throw new Error('No active admin session');
        }
        return response.json();
      })
      .then(data => {
        const sessionUser = data.user;
        setUserData(sessionUser);
        setLoggedIn(true);
        localStorage.setItem('loginName', JSON.stringify({
          firstName: sessionUser.firstName,
          lastName: sessionUser.lastName,
        }));
      })
      .catch(() => {
        setLoggedIn(false);
        setUserData({ firstName: null, lastName: null });
        localStorage.removeItem('user');
        localStorage.removeItem('loginName');
        window.location.href = '/admin';
      })
      .finally(() => {
        setCheckingSession(false);
      });
  }, []);

  useEffect(() => {
    setComponentKey(selectedItem.id);
  }, [selectedItem]);

  const handleItemSelect = (item) => {
    setSelectedItem(item);
  };

  const RenderSelectedComponent = componentMapping[componentKey];

  const handleLogout = async () => {
    await fetch('/api/admin-auth/logout', { method: 'POST' }).catch(() => {});
    setLoggedIn(false);
    setUserData({ firstName: null, lastName: null });
    localStorage.removeItem('user');
    localStorage.removeItem('loginName');
    window.location.href = '/admin';
  };

  if (checkingSession) {
    return (
      <div className="console-loading">
        <div className="console-spinner" />
        <p>Checking admin session...</p>
      </div>
    );
  }

  const showEmployeeSelection = componentKey !== 'reviewNotifications' &&
    componentKey !== 'reviewSurveys' &&
    componentKey !== 'reviewEvents' &&
    componentKey !== 'processEmployee';

  return (
    <div className="console-page">
      {loggedIn ? (
        <SelectedEmployeesProvider>
          <div className="console-shell">
            <aside className="console-sidebar">
              <div className="console-brand">
                <span className="console-brand-mark">RT</span>
                <div>
                  <strong>App Console</strong>
                  <small>Employee app operations</small>
                </div>
              </div>
              <MenuComponent onItemSelect={handleItemSelect} selectedItemId={componentKey} />
            </aside>

            <main className="console-main">
              <header className="console-topbar">
                <div>
                  <a className="console-back-link" href="/admin">Back to Tool Hub</a>
                  <h1>{selectedItem?.label || 'App Console'}</h1>
                  <p>{selectedItem?.description || 'Manage RTUT operational tools.'}</p>
                </div>
                <div className="console-user-panel">
                  <span>{userData.firstName} {userData.lastName}</span>
                  <small>{userData.email || userData.type || 'Admin'}</small>
                  <button onClick={handleLogout} type="button">Logout</button>
                </div>
              </header>

              <section className="console-workspace">
                <div className="console-module-panel">
                  {RenderSelectedComponent ? <RenderSelectedComponent userData={userData} /> : "Please select a menu item."}
                </div>
                {showEmployeeSelection && (
                  <div className="console-module-panel employee-panel">
                    <EmployeeSelectionComponent />
                  </div>
                )}
              </section>
            </main>
          </div>
        </SelectedEmployeesProvider>
      ) : null}
    </div>
  );
}

export default App;
