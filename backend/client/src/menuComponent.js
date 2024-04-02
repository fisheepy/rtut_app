import React, { useState } from 'react';
import { Dropdown } from 'react-bootstrap';

const MenuComponent = ({ onItemSelect }) => {
  const [selectedItem, setSelectedItem] = useState("Select");

  const menuItems = [
    { id: 'sendNotification', label: 'Send Notification' },
    { id: 'sendSurvey', label: 'Send Survey' },
    { id: 'reviewNotifications', label: 'Review Notifications' },
    { id: 'reviewSurveys', label: 'Review Surveys' },
    { id: 'processEmployeeCsv', label: 'Import/Export Employees'}
    // Add other items as necessary
  ];

  const handleSelect = (eventKey) => {
    const item = menuItems.find(item => item.id === eventKey);
    console.log('Selected item in MenuComponent:', item);
    setSelectedItem(item.label);
    if (onItemSelect) {
      console.log(item);
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
