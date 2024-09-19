import React, { useState } from 'react';
import { Dropdown } from 'react-bootstrap';

const MenuComponent = ({ onItemSelect }) => {
  const [selectedItem, setSelectedItem] = useState("Select");

  const menuItems = [
    { id: 'sendNotification', label: 'Send Notification' },
    { id: 'sendSurvey', label: 'Send Survey' },
    { id: 'sendEvent', label: 'Send Event'},
    { id: 'reviewNotifications', label: 'History Notification' },
    { id: 'reviewSurveys', label: 'History Surveys' },
    { id: 'reviewEvents', label: 'History Event'},
    { id: 'processEmployeeCsv', label: 'Import/Export Employees'},
    { id: 'processEmployee', label: 'Add/Remove Individual Employee'},
    { id: 'processWorkflow', label: 'Process Workflow'},
    // Add other items as necessary
  ];

  const handleSelect = (eventKey) => {
    const item = menuItems.find(item => item.id === eventKey);
    setSelectedItem(item.label);
    if (onItemSelect) {
      onItemSelect(item); // Invoke the callback with the selected item
    }
  };

  return (
    <Dropdown onSelect={handleSelect}>
      <Dropdown.Toggle variant="success" id="dropdown-basic">
        {selectedItem}
      </Dropdown.Toggle>
      <Dropdown.Menu>
        {menuItems.map(item => (
          <Dropdown.Item key={item.id} eventKey={item.id}>{item.label}</Dropdown.Item>
        ))}
      </Dropdown.Menu>
    </Dropdown>
  );
};

export default MenuComponent;
