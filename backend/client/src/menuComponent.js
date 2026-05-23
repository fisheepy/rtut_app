import React from 'react';
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import PersonAddAltOutlinedIcon from '@mui/icons-material/PersonAddAltOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';

export const menuItems = [
  { id: 'sendNotification', label: 'Send Notification', group: 'Communications', description: 'Push, email, and SMS announcements.', icon: NotificationsActiveOutlinedIcon, accent: 'blue' },
  { id: 'sendSurvey', label: 'Send Survey', group: 'Communications', description: 'Build and send employee surveys.', icon: AssignmentOutlinedIcon, accent: 'green' },
  { id: 'sendEvent', label: 'Send Event', group: 'Communications', description: 'Create app calendar events.', icon: EventAvailableOutlinedIcon, accent: 'orange' },
  { id: 'reviewNotifications', label: 'Notification History', group: 'Review', description: 'Audit sent notifications.', icon: HistoryOutlinedIcon, accent: 'blue' },
  { id: 'reviewSurveys', label: 'Survey History', group: 'Review', description: 'Review surveys and responses.', icon: HistoryOutlinedIcon, accent: 'green' },
  { id: 'reviewEvents', label: 'Event History', group: 'Review', description: 'Manage published events.', icon: HistoryOutlinedIcon, accent: 'orange' },
  { id: 'processEmployeeCsv', label: 'Employee Import', group: 'Operations', description: 'Import and export employee files.', icon: UploadFileOutlinedIcon, accent: 'purple' },
  { id: 'processEmployee', label: 'Employee Maintenance', group: 'Operations', description: 'Add or remove individual employees.', icon: PersonAddAltOutlinedIcon, accent: 'teal' },
  { id: 'processWorkflow', label: 'App Workflow', group: 'Operations', description: 'Run onboarding and activation workflows.', icon: AccountTreeOutlinedIcon, accent: 'slate' },
];

const MenuComponent = ({ onItemSelect, selectedItemId }) => {
  const handleSelect = (eventKey) => {
    const item = menuItems.find(item => item.id === eventKey);
    if (onItemSelect) {
      onItemSelect(item);
    }
  };

  const groups = menuItems.reduce((acc, item) => {
    acc[item.group] = acc[item.group] || [];
    acc[item.group].push(item);
    return acc;
  }, {});

  return (
    <nav className="console-nav" aria-label="App Console modules">
      {Object.entries(groups).map(([group, items]) => (
        <section className="console-nav-section" key={group}>
          <p>{group}</p>
          {items.map(item => {
            const Icon = item.icon;
            const isActive = selectedItemId === item.id;
            return (
              <button
                className={`console-nav-item ${isActive ? 'active' : ''}`}
                data-accent={item.accent}
                key={item.id}
                onClick={() => handleSelect(item.id)}
                type="button"
              >
                <span className="console-nav-icon"><Icon fontSize="small" /></span>
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </span>
              </button>
            );
          })}
        </section>
      ))}
    </nav>
  );
};

export default MenuComponent;
